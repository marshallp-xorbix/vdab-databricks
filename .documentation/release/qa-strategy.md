# QA Strategy — What We Test, and Where

**Last Updated:** 2026-07-18
**Applies to:** VDAB `dev`, `stg`, `prd` and the promotion pipeline in [`.pipelines/azure-pipelines.yml`](../../.pipelines/azure-pipelines.yml)
**Companion document:** [Release & Deployment Workflow](./release-workflow.md)

This document defines what gets tested in each environment and — just as importantly — what does
**not**. It exists to make QA scope a decision we made once, on principle, rather than a negotiation
we re-run under pressure before every release.

---

## 1. The governing principle

> **We build one artifact and promote that exact artifact to every environment.
> Therefore: test the *code* once, and test the *differences* everywhere else.**

The pipeline compiles, tests, and packages a single environment-agnostic zip (`vdab-build`) in the
`Build` stage. The `dev`, `stg`, and `prd` stages contain **no build steps** — they download that same
artifact and deploy it ([`templates/deploy.yml`](../../.pipelines/templates/deploy.yml)). Nothing is
recompiled, re-bundled, or re-configured per environment.

This works because the SPA resolves everything environment-specific at runtime rather than at build
time: the API base URL is same-origin, the Databricks OAuth redirect is computed from
`window.location.origin`, and Application Insights configuration is fetched from `GET /api/config` at
startup.

The consequence is precise and worth stating plainly:

**The binary running in production is byte-for-byte the binary signed off in staging.** A functional
test re-run in production is testing code that is *incapable* of having changed since staging. It
cannot discover a code defect that staging did not already have the opportunity to find. It can only
produce information about the **environment** — configuration, credentials, network, DNS, and
third-party accounts.

So the question "what should we test in production?" has a derivable answer rather than a negotiable
one: **test exactly the things that differ between staging and production.** That set is small, it is
enumerable, and it is enumerated below.

### What this argument is *not*

It is not "test less in production." It is "test something different in production." The production
pass in [§5](#5-the-production-verification-pass) is not a trimmed-down regression suite — it is
**complete coverage of production-specific risk**, which is a different and better thing than a
partial re-run of a suite that already passed against the identical binary.

---

## 2. What is identical by construction, and what varies

This is the evidence behind the principle. Everything in the left column is guaranteed identical
across environments because it ships inside the artifact. Everything in the right column is injected
per environment by Bicep, Key Vault, or DNS — and is therefore only ever exercised for real in the
environment it belongs to.

| Identical in every environment (in the artifact) | Varies per environment (injected at deploy) |
| --- | --- |
| All backend C# — controllers, services, repositories, validators | App Service instance, SKU, and `AlwaysOn` |
| All frontend JS/CSS bundles and routing | Custom domains + TLS certificates (`prd` only) |
| EF Core model, migrations, and the migrations bundle | Lakebase Postgres branch (`dev` / `stg` / `prd`) |
| Business rules, authorization policies, validation | Key Vault instance and every secret in it |
| Feature-flag *values* — see [§7](#7-known-gaps) | **Stripe sandbox vs. live mode, keys, price IDs, webhook secret** |
| `appsettings.json` defaults baked into the build | Azure Communication Services resource + sender domain |
| API contract shapes and error mapping | JWT issuer / audience / signing key |
| | CORS `AllowedOrigins` and `FrontendUrl` (email link base) |
| | Application Insights resource |
| | Blob storage accounts (Data Protection keys, GeoLite, audit archive) |
| | GeoLite2 credentials and the uploaded `.mmdb` |
| | Databricks access token (workspace URL is shared — see below) |
| | Deployment slot + slot swap (**`prd` only**) |

### The two entries that carry most of the risk

**Stripe is the sharpest production-only risk in the system.** One Stripe account backs all three
environments: `dev` and `stg` each have their **own sandbox**, and `prd` is that account's **live
(non-sandbox) mode**. This is the right shape — it gives dev and staging genuine isolation from each
other, so dev QA cannot corrupt staging's subscription state, while keeping a single account of
record.

The consequence for testing is that **sandbox objects and live objects are entirely separate
populations.** Products, prices, webhook endpoints, and customer-portal configuration created in a
sandbox do not exist in live mode and do not propagate to it — which is why all three environments
carry **different price IDs**. Nothing in any non-production environment exercises the live price
catalog, the live webhook signing secret, or a real card, and test cards are rejected in live mode.
This is the one area where "it worked in staging" carries materially less weight, and it earns a real
end-to-end transaction in production.

The shared account does narrow the risk usefully: account-level identity — business profile, branding,
statement descriptor — is one thing rather than something that can drift per environment. The
production risk is confined to **mode-scoped** objects, which is exactly what
[§5.3](#53-billing--the-one-deliberate-live-transaction) targets.

**Databricks is the opposite risk, and it splits in two.** Both halves live in one workspace
(`dbc-bc2a5dd3-798c.cloud.databricks.com`), but they are isolated very differently:

- **Lakebase** is separated by **project** — `prd` has its own, `dev` and `stg` share another. That is
  a real boundary, and it means database isolation is in good shape.
- **AI model serving is not separated at all.** All three environments call the same serving endpoint
  (`databricks-claude-sonnet-4-6`); only the access token differs.

The testing consequence is that the AI integration is *thoroughly* exercised before production — there
is nothing environment-specific left to verify — but non-production activity consumes the same
capacity, rate limits, and budget that production users depend on. That is an operational risk during
launch week rather than a QA gap, and it is tracked as
[backlog 4.2](./release-backlog.md#42--story--separate-the-ai-model-serving-workspace-prd-vs-devstg).
Once the workspaces are split, the serving endpoint **becomes** a per-environment difference and moves
into the [§5](#5-the-production-verification-pass) verification pass.

---

## 3. What each environment is for

| Environment | Purpose | Expected stability | Testing performed here |
| --- | --- | --- | --- |
| **Local** (Aspire) | Isolated development of one feature or fix | **Broken often, by design.** Build and test failures are a normal part of working | The author exercising their own change; full suite green before pushing |
| **dev** | Integration — does this change still work alongside everything else that merged | **High flux.** Periods of instability are expected and are not incidents | The author re-testing their change *and neighboring code*, now integrated |
| **stg** | Release validation and sign-off | **Protected.** Stability is the product here, and unplanned deployments are the main threat to it | Full regression, feature acceptance, billing lifecycle in the `stg` sandbox, cross-browser, accessibility, performance |
| **prd** | Serving customers | **Live** | The [§5](#5-the-production-verification-pass) verification pass — nothing more |

**Local and dev are deliberately similar**, and the overlap is the point. Before pushing, pull
`develop` and confirm it builds and works locally. Catching a collision on your own machine costs one
person an hour; catching it in `dev` costs everyone working in `dev` that afternoon. The shared
environment should absorb the integration problems that genuinely cannot be found locally, not the
ones that could have been.

### 3.1 Promoting into staging is a scheduling decision, not just a quality one

This is the promotion that is easiest to get wrong, because it looks like a technical decision and is
not.

**Staging is a shared QA resource that runs in cycles.** Deploying into it while a cycle is in
progress does not merely add new code to test — it **invalidates testing already completed against the
previous build.** A regression pass that finished yesterday describes a build that is no longer
deployed. The cost is not the new testing; it is the re-testing, and it is paid by people who had
already finished.

So a PR author and reviewer cannot make this call on their own. They are the right people to judge
*"is this change correct"* — they are structurally the wrong people to judge *"is now a safe moment to
disturb staging,"* because that depends on QA-cycle state they do not hold.

| Decision | Question | Who |
| --- | --- | --- |
| Merge to `develop` | Is this change correct and reviewed? | Author + reviewer |
| **Publish to `stg`** | **Is now a safe time to reset the QA baseline?** | **Whoever holds the QA cycle** — QA lead or release coordinator, with the dev lead |
| Publish to `prd` | Should we ship this now? | Per [Release Workflow §3](./release-workflow.md#3-approval-design) |

**Expect several dev builds to bundle into one staging publish.** At any real change frequency,
publishing to staging on every merge would mean QA never gets a stable target — the baseline resets
faster than a regression pass completes. Batching is the normal case, not an exception.

**The pipeline already works this way.** Each merge to `develop` produces one release candidate that
auto-deploys `dev` and then *holds* at the staging gate. Approving a candidate bundles everything
merged since the last staging publish; superseded candidates are abandoned. The mechanism for batching
is already there — what is missing is the explicit convention about **who** decides and **when**. See
[deployment guide 1](../deployment/1-overview.md#cicd-flow--build-once-promote-the-same-artifact).

### 3.2 The line that matters most

**Staging owns correctness. Production owns configuration.** Every question of the form "does this
feature behave properly" belongs to staging. Every question of the form "is this environment wired up
properly" belongs to production. When someone proposes a production test, the useful challenge is:
*which of those two questions is it answering?* If it is the first, staging already answered it
against the same binary.

---

## 4. Test coverage by type and environment

| Test type | Local | dev | stg | prd |
| --- | --- | --- | --- | --- |
| Unit / component (xUnit, ~110 files) | ✅ | Build stage, once | — | — |
| Architecture + migration-drift tests | ✅ | Build stage, once | — | — |
| Feature / acceptance testing of new work | — | ✅ primary | ✅ confirm | ❌ |
| **Full regression suite** | — | — | ✅ **primary and only** | ❌ |
| Cross-browser / responsive / accessibility | — | ⬜ spot | ✅ | ❌ |
| Performance / load | — | — | ✅ | ⬜ observe only |
| Security review, authz boundaries | — | ⬜ | ✅ | ❌ |
| Billing lifecycle (Stripe **sandbox**) | ⬜ | ✅ | ✅ full | ❌ |
| **Live-mode payment path** | — | — | ❌ impossible | ✅ **once** |
| **External contract / config verification** | — | ⬜ | ⬜ | ✅ **primary** |
| Post-deploy smoke | — | ⬜ | ✅ | ✅ |

✅ = required · ⬜ = optional/opportunistic · ❌ = deliberately excluded · — = not applicable

The regression suite runs **once per release candidate, in staging.** It does not run again in
production, because the artifact it validated is the artifact production receives.

Existing feature-level test cases live alongside this document — see
[`qa_subscription_and_account_management_test_cases.md`](../qa_subscription_and_account_management_test_cases.md).
Those are **staging** test cases. They are not a production checklist and should not be re-run
against live Stripe.

---

## 5. The production verification pass

This is the complete production test scope. Every item exists because it maps to a real
environment-level difference from [§2](#2-what-is-identical-by-construction-and-what-varies) — not
because it is a "critical user journey." Critical user journeys were validated in staging against
this same build.

**Target duration: ~60–90 minutes.** Run it immediately after the slot swap, with a named owner and a
recorded pass/fail per line.

### 5.1 Reachability and identity

- [ ] `https://app.vdab.ai` loads; TLS certificate valid and not near expiry.
- [ ] `https://app.vdab.io` loads; TLS certificate valid.
- [ ] `https://xorbix-vdab-prd.azurewebsites.net` loads (direct host still functional).
- [ ] Browser network tab shows API calls going to the **same origin** (no CORS failures, no dev/stg host leaking in).
- [ ] `GET /api/config` returns the **prd** Application Insights connection string — not dev's.
- [ ] Deployed build number matches the approved release candidate (confirms the swap actually happened).

### 5.2 Authentication — the gate on everything else

Uses the prd ACS resource, prd sender domain, prd JWT signing key, and prd Data Protection key ring.
None of those are exercised anywhere else.

- [ ] Request a passwordless sign-in code for a real mailbox; **code arrives**.
- [ ] Note the **sender address** and whether it landed in **inbox or spam** — this is a brand-new sending reputation. Check at least one Microsoft 365 and one Gmail recipient.
- [ ] Code authenticates successfully; session established.
- [ ] Session survives an app restart (proves Data Protection keys persist to prd blob storage, not to a container-local ring).
- [ ] Databricks OAuth: `https://app.vdab.ai/callback` and `https://app.vdab.io/callback` complete successfully — these callback URLs are registered per-origin and cannot be validated from any other environment.

### 5.3 Billing — the one deliberate live transaction

This is the only place we knowingly spend real money to buy information, and it is worth it: the
`dev` and `stg` sandboxes are separate object populations from live mode, so nothing outside
production has exercised prd's live keys, price catalog, webhook secret, or portal configuration.

- [ ] Plans page renders the **live** catalog; every **purchasable** plan's name, interval, and **price amount** matches the intended commercial offering (catches a mis-pasted live price ID — a class of defect staging structurally cannot catch).
- [ ] **Enterprise presents as not-yet-available** — no self-service checkout *and* no contact-sales path. This is the intended launch state: `SubscriptionTiers:Enterprise:SelfServiceCheckout` is `false` and `stripePriceIdEnterpriseMonthly` is deliberately empty in **every** environment. An Enterprise tier with no monthly price is **expected, not a defect** — do not raise it on launch day. (A yearly Enterprise price ID exists in each environment but is unused until the tier opens.)
- [ ] Complete **one** real checkout with a real card on the cheapest paid plan.
- [ ] Stripe dashboard (live mode) shows the customer, subscription, and invoice as expected.
- [ ] The **webhook** was received and signature-validated against the prd webhook secret — tenant `SubscriptionStatus` flips to `active` in the app without manual intervention.
- [ ] Customer portal opens and is correctly configured **in live mode** — portal configuration is set per mode and does not carry over from a sandbox, so a portal that works in staging proves nothing here. Confirm the invoice link resolves.
- [ ] **Then reverse it**: cancel the subscription and refund the charge. Record the Stripe IDs in the release notes so the test transaction is identifiable in month-end reporting.

### 5.4 Data and dependencies

- [ ] App serves authenticated requests — confirms prd Key Vault access via the **swapped-in slot identity** (the slot has its own managed identity; grants are duplicated in Bicep, so a swap is where an identity/RBAC gap would surface).
- [ ] Database is on the **prd** Lakebase branch and the applied migration matches the release.
- [ ] Create and read one real domain object end-to-end (proves EF, connection string, and pooling under prd config).
- [ ] Databricks connection using a prd-configured token succeeds (workspace is shared, so this validates the **token**, not the integration).
- [ ] Geolocation resolves on a request — `GeoLocationService` **fails soft** and logs a warning, so a missing `.mmdb` blob is silent unless deliberately checked.
- [ ] Application Insights is receiving prd telemetry — requests, dependencies, and exceptions all appearing.

### 5.5 Watch, don't test

For the first 24–48 hours the highest-value production activity is **observation, not execution**:

- [ ] Error rate and failed-request count in App Insights against the pre-release baseline.
- [ ] Response times on the main routes.
- [ ] Any exception type that did not appear in staging.
- [ ] Stripe webhook delivery failures.

Real traffic exercises breadth far better than a QA pass can, and it does so without polluting
production data. A monitored soft launch is a better regression signal than a manual regression run.

---

### 5.6 Most of this pass should become automated

The checklist above is deliberately manual for the first release, but it should not stay that way.
Nearly all of it is **configuration verification**, and configuration is best verified *from inside the
running application*, where it has actually been resolved from Key Vault, app settings, and managed
identity. An external script has to infer what the application resolved; the application knows.

Tracked as [backlog 3.5–3.7](./release-backlog.md#35--story--environment-validation-check-engine): one
check engine, surfaced both as an admin **Environment Validation** page and as a machine-readable
endpoint the pipeline can call after a deploy.

| Automates well | Stays manual, permanently |
| --- | --- |
| Every resolved-config check — App Insights resource, sender address, flag values, workspace URL, migration version | DNS, TLS, and custom-domain binding (external by nature) |
| **Stripe catalog comparison** — configured price IDs fetched live and checked against `SubscriptionTiers` amounts | The one live transaction — real money, real card |
| Dependency reachability — Key Vault, database round trip, Databricks endpoint | Email **inbox-vs-spam placement**, which needs human judgment |
| Silent-failure checks, especially GeoLite2 — the ones nobody thinks to run | Databricks OAuth browser flow |
| Webhook wiring — secret present, last receipt timestamp | Session-survives-restart (requires a restart) |

Two consequences worth noting:

**The Stripe catalog check removes most of the reason for the live transaction.** Once configured
price IDs are fetched from the live API and compared against config, the remaining thing a real
purchase proves is the *webhook round trip*. That does not eliminate [§5.3](#53-billing--the-one-deliberate-live-transaction),
but it shrinks it to a single narrow purpose and makes it defensible on its own terms.

**Prefer checks implied by normal operation over synthetic ones.** An authenticated admin page cannot
render at all without the database read path, the JWT signing key from Key Vault, the Data Protection
key ring, and the entire auth stack already working. *Reaching the validation page is itself a test
result* — which is why the page should say so rather than re-testing what its own existence proved.

---

## 6. Why full regression in production is not just unnecessary — it is costly

Worth having ready, because "more testing is always safer" is intuitive and wrong here.

| Cost | Detail |
| --- | --- |
| **Real money and real records** | Live Stripe rejects test cards. Full billing regression means real charges on real cards, generating customers, subscriptions, invoices, and refunds that permanently contaminate live financial reporting. |
| **Sending reputation** | Every regression run blasts real email from a brand-new sending domain. Bulk automated sends to test mailboxes is exactly the pattern that gets a new domain filtered — during the launch week when deliverability matters most. |
| **Contaminated telemetry** | QA traffic pollutes the App Insights baseline, error rates, and audit archive — the very signals needed to detect a genuine launch problem. It degrades the monitoring that *is* the real safety net. |
| **Shared Databricks workspace** | Test apps and catalog objects created during a prod QA pass are indistinguishable from customer objects in the one shared workspace. |
| **Release window burn** | A full regression pass is days; this verification pass is ~90 minutes. Every extra hour is an hour the newly-swapped release runs unverified in front of users — the opposite of the intended safety. |
| **False confidence, and false alarms** | A production regression that *passes* tells us almost nothing we did not know. A production regression that *fails* is, in the overwhelming majority of cases, test-data or environment state — burning release-day hours triaging a non-defect. |

---

## 7. When the team's instinct is right

The argument above is scoped, not absolute. Production testing legitimately expands when the
build-once guarantee is weakened or bypassed. Name these explicitly so they are recognized in the
moment rather than argued about:

1. **Live-only integrations.** Anything with no sandbox equivalent, or whose sandbox differs
   structurally from live. Stripe live mode is the standing example, which is why [§5.3](#53-billing--the-one-deliberate-live-transaction)
   exists.
2. **First-ever production deploy of a subsystem.** The initial production release is a legitimate
   special case — every item in [§5](#5-the-production-verification-pass) is being exercised for the
   first time and none of it has ever been proven. Later releases inherit the confidence; this one
   does not.
3. **Changes that did not travel in the artifact.** Bicep/app-setting changes, Key Vault rotations,
   DNS or certificate changes, and Stripe dashboard edits **bypass build-once entirely** — staging
   never saw them. Config-only changes deserve production verification proportional to their blast
   radius.
4. **A hotfix that skipped staging.** If the break-glass path was used, staging did not validate the
   artifact and the confidence it normally provides was not purchased. Expand production testing to
   cover what staging would have.
5. **Infrastructure differences that are not merely credentials.** Production runs S1/Standard with
   a slot and `AlwaysOn`; `dev` and `stg` run B1/Basic with neither. Cold-start, timeout, and
   concurrency behavior genuinely differ. This is an argument for production **load observation**,
   not for functional re-testing.

Everything else — "let's just make sure login still works," "let's re-run the tenant tests" — is
re-testing an unchanged binary.

---

## 8. Entry and exit criteria

**Promote to `stg` when:** the build stage is green (unit, architecture, and migration-drift tests
pass), the changes have been validated in `dev`, any schema change is confirmed backward-compatible,
**and QA confirms no cycle is in flight** — or explicitly accepts that the baseline is being reset and
completed testing discarded. Bundling several dev builds into one staging publish is the normal case;
see [§3.1](#31-promoting-into-staging-is-a-scheduling-decision-not-just-a-quality-one).

**Promote to `prd` when:**
- The full regression suite has passed **in staging, against this exact build number**.
- New/changed behavior has been accepted by QA and the PM in staging.
- Billing changes have been exercised end-to-end in the **`stg` Stripe sandbox**.
- Migrations are backward-compatible with the currently-live production build (see
  [Release Workflow §3](./release-workflow.md#3-rollback-and-migrations--the-false-comfort-trap)).
- Any environment-only change (Bicep, app settings, secrets, DNS) is called out on the release, since
  staging did not validate it.
- A named owner is available to run [§5](#5-the-production-verification-pass) and to decide on
  rollback.

**Roll back (swap the slot back) when:** any [§5.1](#51-reachability-and-identity) or
[§5.2](#52-authentication--the-gate-on-everything-else) item fails, the live payment path fails,
error rates rise materially above baseline, or a §5.4 failure has no fix within the release window.
Rollback is a swap-back and is cheap — treat it as a first resort, not an admission of failure.

---

## 9. Known gaps

These weaken the strategy above and should be closed. Ordered by how much they cost us.

1. **`/health` and `/alive` return 404 in every deployed environment.** They are mapped only under
   `if (app.Environment.IsDevelopment())` in
   [`ServiceDefaults/Extensions.cs:171`](../../Xorbix-Visual-Databricks-App-Builder.ServiceDefaults/Extensions.cs#L171),
   and no `ASPNETCORE_ENVIRONMENT` app setting is set in Bicep, so all three Azure environments run as
   `Production`. Consequence: there is no endpoint to gate a slot swap, drive an App Service health
   probe, or automate a smoke test against. The registered check is also a trivial `self` liveness
   check that verifies no dependency (`Extensions.cs:158` still carries the TODO). **Fix before or
   immediately after first production release:** expose an authenticated or obscured readiness
   endpoint that actually checks database and Key Vault, then use it for a pre-swap gate.
2. **No automated post-deploy verification anywhere.** No smoke tests, no warm-up step, no pre-swap
   validation, no automated rollback in any deploy stage. Azure's swap performs its own warm-up ping,
   but nothing verifies the application is *working* before traffic moves. Items 5.1 and 5.2 above are
   the natural first automated smoke test.
3. **`EmailConfiguration__UseCustomDomain` is hardcoded to `'false'`** in
   [`main.bicep:586`](../../.infrastructure/main.bicep#L586) — the real expression is commented out —
   while [`main.prd.bicepparam:52`](../../.infrastructure/main.prd.bicepparam#L52) sets
   `useCustomEmailDomain = true` with `customEmailDomain = 'xorbix.com'`. **Production will send from
   the default ACS domain, not `xorbix.com`.** This looks unintended and it directly affects the §5.2
   deliverability check on launch day. Confirm the intent before go-live.
4. **Feature flags cannot vary per environment.** `FeatureManagement:EnablePreRelease` and
   `AuthenticationConfiguration:PasswordlessOnly` exist only in the artifact's `appsettings.json` with
   no App Service override in Bicep. Staging and production therefore *always agree* on flag state,
   which means flags cannot currently dark-launch anything, and changing one requires a rebuild and a
   full re-promotion. See [Release Workflow §4](./release-workflow.md#4-feature-flags-as-a-release-mechanism).
   Once flags do vary per environment, **flag state becomes an environment difference** and belongs in
   the §5 checklist.
5. **No test category is marked `LongRunning`,** though the PR pipeline filters on it — so the filter
   is currently inert. Harmless today; misleading later.
