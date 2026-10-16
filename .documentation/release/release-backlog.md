# Release Readiness Backlog

**Last Updated:** 2026-07-18
**Purpose:** Board-ready work items derived from [Release & Deployment Workflow](./release-workflow.md) and [QA Strategy](./qa-strategy.md).
**Target board:** Azure DevOps — copy each item as an Epic / Story / Bug / Task.

Items are grouped by epic and ordered by urgency relative to the first production release. Each
carries a size (**S** ≈ hours, **M** ≈ 1–3 days, **L** ≈ a week or more) and a **When**:

| When | Meaning |
| --- | --- |
| 🔴 **Pre-launch** | Do before the first production release, or consciously accept the risk in writing. |
| 🟡 **Launch week** | Needed early, but the release can go without it. |
| 🟢 **Next** | Do soon after launch, while the reasoning is fresh. |
| ⚪ **Later** | Deferred by design — see [Release Workflow §10](./release-workflow.md#10-now-vs-later). |

---

## Epic 1 — Launch readiness

> **Goal:** production comes up correctly and we can tell that it did.

### 1.1 🔴 BUG — Production email ignores the custom sending domain · **S**

`EmailConfiguration__UseCustomDomain` is hardcoded to `'false'` in
[`main.bicep:586`](../../.infrastructure/main.bicep#L586) with the real expression commented out,
while [`main.prd.bicepparam:52`](../../.infrastructure/main.prd.bicepparam#L52) sets
`useCustomEmailDomain = true` and `customEmailDomain = 'xorbix.com'`. Production will send from the
default Azure Communication Services domain instead of `xorbix.com`.

**Why it matters at launch:** authentication is passwordless, so *every* signup and every login
depends on an email arriving. A brand-new `*.azurecomm.net` sender has materially worse inbox
placement than a verified custom domain — this is a conversion problem on day one, not a cosmetic one.

**Acceptance criteria**
- `main.bicep` honours the `useCustomEmailDomain` parameter (restore the commented expression).
- Production sends from the intended `xorbix.com` sender address.
- Verified deliverability to at least one Microsoft 365 and one Gmail recipient, landing in inbox.
- If the custom domain is *not* ready, `main.prd.bicepparam` is corrected to `false` so config matches
  reality, and the deliverability risk is accepted explicitly.

---

### 1.2 🔴 STORY — Expose the running build number at runtime · **S**

There is no reliable in-app way to confirm which build is live. The production verification pass needs
it to prove the slot swap actually happened, and support will want it on every bug report.

**Acceptance criteria**
- Build number (and version tag, once 2.3 lands) returned from `GET /api/config`.
- Value is injected at build time by the pipeline, not hand-maintained.
- Visible in production without authentication, or trivially reachable by an admin.

---

### 1.3 🔴 TASK — Confirm Brooks's Azure permissions for rollback · **S**

Approving a release and *performing a slot swap-back* are different permissions. Verify the second,
not just the first.

**Acceptance criteria**
- Brooks can perform a slot swap on `xorbix-vdab-prd` without escalation.
- Verified by doing it — a rehearsed non-production swap counts.

---

### 1.4 🔴 TASK — Run the production verification pass at go-live · **M**

Execute [QA Strategy §5](./qa-strategy.md#5-the-production-verification-pass) immediately after the
first production swap. Named owner, recorded pass/fail per line.

**Acceptance criteria**
- Every §5 line item recorded pass/fail with the runner's name and timestamp.
- The live Stripe test transaction is reversed and its Stripe IDs recorded in the release notes.
- Any failure triggers the §8 rollback decision rather than an ad-hoc fix in production.

---

### 1.5 🟡 STORY — Adopt the backward-compatible migration standard · **S**

Production migrations run *before* the slot swap against the shared production database, so a
non-backward-compatible migration silently converts the slot swap from a real rollback into a broken
one. See [Release Workflow §4](./release-workflow.md#4-rollback-and-migrations--the-false-comfort-trap).

**Acceptance criteria**
- The expand/contract rule is written into `AGENTS.md` (or the contributing docs) as a standard.
- The PR template asks whether the change includes a migration and whether it is backward-compatible.
- Reviewers treat a destructive migration as release-blocking.

---

### 1.6 🔴 STORY — Stand up and cut over to the custom email sending domain · **M**

**Related:** 1.1 is the code half (Bicep ignores the parameter); this is the infrastructure half
(the domain must actually exist, be verified, and be linked). Neither delivers value alone.

Steps are documented in
[`communication-service-setup.md`](../../.infrastructure/communication-service-setup.md) — Email
Service domain, DNS records, verify, then link to the Communication Service resource.

**Decide the sending domain first — this is not just an implementation detail:**
- `main.prd.bicepparam` currently specifies the **apex** `xorbix.com`. The setup runbook's example uses a
  subdomain (`mail.xorbix.com`), and the SPF example includes `spf.protection.outlook.com`, which
  suggests Xorbix corporate mail already runs on Microsoft 365 from that apex. **Adding VDAB's sending
  records to the corporate apex risks the corporate SPF record and Xorbix's own mail deliverability.**
- There is also a brand question: users signing up at `app.vdab.ai` would receive authentication mail
  from `xorbix.com`. A `vdab.ai` subdomain aligns the brand *and* isolates VDAB's sending reputation
  from the corporate domain — which matters, because a new product's early sending patterns are exactly
  what reputation systems scrutinize.
- Cheap to decide now; expensive after launch, once users have inbox rules and reputation has begun
  accruing to whichever domain shipped.

**Acceptance criteria**
- Sending domain chosen deliberately, with the apex-vs-subdomain and brand-alignment questions above
  answered in writing.
- ACS Email Service domain provisioned; TXT verification, SPF, and both DKIM CNAMEs published; status
  **Verified**; domain **linked** to the Communication Service resource.
- DMARC policy considered alongside SPF/DKIM.
- 1.1 applied, so `useCustomEmailDomain` is actually honoured.
- Production passwordless codes arrive **from the intended sender**, landing in inbox — verified
  against at least one Microsoft 365 and one Gmail recipient.
- Existing Xorbix corporate email confirmed unaffected.

---

## Epic 2 — Release governance

> **Goal:** the right people decide, and someone can act at 2am.

### 2.1 🔴 STORY — Restructure production approval pools · **S**

Today all gates use "one of" across a flat pool, so a single person — including the PM alone — can
ship to production.

**Acceptance criteria**
- The `prd` Environment requires **two** approval checks: one from **{Tim, Brooks}** (technical
  readiness) **and** one from **{Ross, Tom}** (business readiness).
- The `stg` Environment drops the exec requirement, gating on QA / PR reviewers only — pending the
  answer to [open question 2](./release-workflow.md#11-open-questions).
- Offshore holds `dev` and `stg` rights; production pools stay onshore.

---

### 2.2 🔴 STORY — Define the break-glass hotfix path · **M**

Production down at 2am cannot wait on the full approver set. Define the emergency path **now, in calm
conditions** — this matters more than usual given a small onshore approver pool and offshore coverage
hours.

**Acceptance criteria**
- A documented path where one dev lead can ship a hotfix, with mandatory retroactive review.
- The path is fully audited — who invoked it, when, what shipped.
- Documented consequence: a hotfix that skips staging forfeits staging's confidence, so production
  testing expands to compensate ([QA Strategy §7](./qa-strategy.md#7-when-the-teams-instinct-is-right)).
- Rehearsed once before it is needed for real.

---

### 2.3 🟡 STORY — Adopt release versioning · **S**

Two identifiers doing two jobs: build number for traceability, version tag for communication. See
[Release Workflow §7](./release-workflow.md#7-release-identity-versioning-and-timing).

**Acceptance criteria**
- `main` is tagged `vMAJOR.MINOR.PATCH` when a candidate reaches production; `v1.0.0` is go-live.
- MAJOR/MINOR/PATCH defined by user-visible meaning, not API compatibility.
- The version tier determines the documentation tier (public release notes vs. internal changelog only).

---

### 2.4 🟡 STORY — Define staging publish cadence and QA-cycle coordination · **S**

Publishing to staging resets the QA baseline and invalidates testing already completed against the
previous build. Today nothing states who decides when that is acceptable, so the decision defaults to
whoever happens to approve the gate — which may be someone with no visibility into an in-flight
regression pass.

**Acceptance criteria**
- A named owner for the staging publish decision — QA lead or release coordinator — reflected in the
  `stg` Environment approvers.
- A stated convention for bundling: several dev builds normally batch into one staging publish rather
  than publishing per merge.
- A lightweight signal for "QA cycle in progress" that the approver can check before approving.
- Documented expectation that an unplanned mid-cycle publish requires QA to explicitly accept the
  discarded testing.

---

### 2.5 🟢 TASK — Exercise staging releases beyond Tim · **S**

Tim is currently the only person releasing to staging. The capability is believed transferable but has
never been demonstrated.

**Acceptance criteria**
- At least two other people have taken a release to staging end-to-end unaided.

---

## Epic 3 — Observability & post-deploy verification

> **Goal:** we learn about problems from monitoring, not from customers.

### 3.1 🔴 BUG — Health endpoints return 404 in every deployed environment · **S**

`/health` and `/alive` are mapped only under `if (app.Environment.IsDevelopment())` in
[`ServiceDefaults/Extensions.cs:171`](../../Xorbix-Visual-Databricks-App-Builder.ServiceDefaults/Extensions.cs#L171),
and no `ASPNETCORE_ENVIRONMENT` app setting is set in Bicep — so all three Azure environments run as
`Production` and neither endpoint exists. There is nothing to gate a slot swap on, nothing for an App
Service health probe, and nothing to automate a smoke test against.

**Acceptance criteria**
- A readiness endpoint is reachable in `dev`, `stg`, and `prd`, secured appropriately (authenticated,
  obscured path, or IP-restricted — the endpoint should not be an anonymous dependency map).
- The check verifies real dependencies — database and Key Vault at minimum — replacing the trivial
  `self` check and closing the TODO at `Extensions.cs:158`.
- App Service health probe configured against it.

---

### 3.2 🟡 STORY — Automated post-swap smoke test · **M**

No smoke tests, no pre-swap validation, and no automated rollback exist in any deploy stage. Azure's
swap warms the slot with its own ping, but nothing confirms the application actually works before
traffic moves.

**Depends on:** 3.1

**Acceptance criteria**
- Pipeline hits the readiness endpoint on the `staging` slot **before** the swap; a failure stops the
  swap.
- A post-swap smoke test covers [QA §5.1](./qa-strategy.md#51-reachability-and-identity) and
  [§5.2](./qa-strategy.md#52-authentication--the-gate-on-everything-else) — reachability, `/api/config`
  returning the right environment, and a sign-in code being issued.
- Failure raises an alert; automated swap-back is a stretch goal, not required.

---

### 3.3 🔴 STORY — Error-rate alerting and named on-call · **M**

A public product means real users and someone owning it when it breaks. This is the biggest cultural
shift from the prior business-client work.

**Acceptance criteria**
- App Insights alerts on error rate, failed requests, and response time, routed to a person — not a
  dashboard nobody opens.
- Stripe webhook failure alerting is owned by 3.9, routed through 3.8's action group.
- A named on-call owner and escalation path for launch week, agreed before launch.

---

### 3.4 🟢 TASK — Baseline production telemetry before opening traffic · **S**

The first 24–48 hours of observation only works against a known baseline.

**Acceptance criteria**
- Pre-launch error rate and response-time baselines recorded so launch-day deltas are interpretable.

---

### 3.5 🟢 STORY — Environment validation check engine · **M**

Most of the [QA §5](./qa-strategy.md#5-the-production-verification-pass) pass is **configuration
verification**, and configuration is best verified *from inside the running application* — where it has
actually been resolved from Key Vault, app settings, and managed identity. An external script has to
infer what the app resolved; the app knows.

Build the checks once as a service, so they can be surfaced two ways (3.6 and 3.7) without duplication.
Each check maps to a specific §5 line item.

**Checks in scope**
- **Resolved identity** — environment, build number/version, App Insights resource, `FrontendUrl`, `AllowedOrigins`.
- **Stripe catalog** — fetch each configured price ID from the live API; compare name, interval, and **amount** against `SubscriptionTiers` config. *Highest-value single check: it catches the mis-pasted live price ID without spending money.*
- **Stripe wiring** — webhook secret configured, timestamp of last successfully received webhook, customer-portal configuration present in the current mode.
- **Email** — resolved sender address and custom-domain setting (this check alone would have surfaced 1.1); optional explicit "send test email to…" action.
- **Database** — applied migration version, connection host (redacted), read/write round trip.
- **Key Vault** — each expected secret resolved yes/no, plus the vault URI. **Never values.**
- **Databricks** — resolved workspace URL and endpoint name, serving endpoint reachable.
- **GeoLite2** — database present and a sample IP resolves. Valuable precisely *because* `GeoLocationService` fails soft, so absence is otherwise silent.
- **Data Protection** — key ring persistence target.
- **Feature flags** — resolved value of each flag.

**Acceptance criteria**
- `IEnvironmentValidationService` in `.Services` with DTOs in `.Models` and a controller in `.Server`, returning `Result<T>` per the layering rules in `AGENTS.md`.
- Each check returns pass / warn / fail plus the resolved value, independently runnable.
- **Read-only.** No check mutates state except the explicitly-invoked test-email action.
- **Security — this is a reconnaissance surface and must be treated as one:** global `Administrator` policy only, never anonymous; secret *values* never returned (resolved/not-resolved only); connection strings redacted to host + database; rate limited; every run audited, since it makes outbound third-party calls.

---

### 3.6 🟢 STORY — Admin "Environment Validation" page · **M**

**Depends on:** 3.5

Fills one of the disabled Administration cards
([`AdministrationDashboard.tsx:116-134`](../../xorbix-visual-databricks-app-builder.client/src/pages/AdministrationDashboard.tsx#L116-L134),
[`config/section-sidebar.ts:108-122`](../../xorbix-visual-databricks-app-builder.client/src/config/section-sidebar.ts#L108-L122)).

**Name it "Environment Validation," not "Production Validation."** The same checks must run in `stg` —
that is how we learn the checks themselves are correct *before* depending on them at go-live. A
production-only name quietly discourages the run that proves the tool works.

Prefer a **new card** over folding this into *System Settings*: settings implies mutation, this is
read-only diagnostics, and the two deserve different mental models even though both are admin-gated.

**Acceptance criteria**
- New route + card, global `Administrator` only, following the frontend conventions in `AGENTS.md`.
- Per-check pass/warn/fail with the resolved value displayed; run-all and run-individual.
- Results exportable or copyable for pasting into the release record.
- Page states that **reaching it is itself a test result** — an authenticated admin page cannot render without the database read path, the JWT signing key from Key Vault, the Data Protection key ring, and the whole auth stack already working.

---

### 3.7 🟢 TASK — Machine-readable validation endpoint for the pipeline · **S**

**Depends on:** 3.5 · **Extends:** 3.1, 3.2

The same engine, second surface: a non-interactive endpoint returning structured results with an
overall status, so the pipeline can verify a deploy without a human.

**Acceptance criteria**
- Machine-readable result with an aggregate pass/fail.
- Pipeline calls it after the swap; failure raises an alert.
- Side-effecting checks (test email) excluded from the automated path.
- Complements rather than duplicates 3.1: the readiness endpoint answers *"is it alive"* in
  milliseconds for a probe; this answers *"is it configured correctly"* on demand.

---

### 3.8 🔴 STORY — Azure health monitoring and failure notifications for production · **M**

Watch production from Azure and notify key personnel when it fails. This is the outward-facing half of
Epic 3: 3.1 gives us something worth watching, **3.8 does the watching and the paging**, and 3.3
catches degradation that never becomes a hard outage.

**Not blocked by 3.1.** An external availability test can ping the public URL (`https://app.vdab.ai`)
today and will catch DNS, TLS, and whole-site-down failures without any application change. Ship that
first; deepen it to the readiness endpoint once 3.1 lands. That ordering matters given the launch date.

**Acceptance criteria**
- **Availability test** — Application Insights standard availability test against `https://app.vdab.ai`
  from multiple regions, alerting on failure from more than one location (single-region failures are
  usually the probe, not the site).
- **App Service health check** — path-based probe configured on `xorbix-vdab-prd` so unhealthy
  instances are pulled from rotation automatically. Deepen to the 3.1 readiness path when available.
- **Action group** with key personnel — email plus SMS or push, not email alone. This becomes the
  shared notification channel that 3.3's telemetry alerts also route through, so build it once here.
- **Alert coverage:** availability failure, HTTP 5xx rate, sustained response-time degradation,
  unexpected App Service restarts, and **TLS certificate expiry** on both custom domains.
- **Notifications proven to arrive.** Deliberately fire each alert path and confirm the humans receive
  it. Untested alerting is not alerting — and this is the one item on the list whose failure mode is
  silence.
- Alert recipients agreed with the named on-call owner from 3.3, so a page reaches someone who can act.

---

### 3.9 🔴 STORY — Alert on Stripe webhook failures · **S**

**Routes through:** 3.8's action group

Subscription state depends on webhooks. A silently failing webhook at launch means **a customer pays
and never gets access** — the worst failure mode available to us, and one the customer discovers before
we do.

**Current behaviour** ([`StripeWebhookService.cs`](../../Xorbix-Visual-Databricks-App-Builder.Services/StripeWebhookService.cs)):
processing is synchronous, and failures return non-2xx — signature failure → `UnauthorizedError` (401),
processing failure or unhandled exception → `BadRequestError` (400). That is **structurally sound**:
Stripe treats non-2xx as failed delivery and retries with backoff, and there is an event-ID guard for
idempotency. The gap is not correctness, it is **visibility** — every failure path currently ends at a
`LogWarning` or `LogError` that nobody is watching.

**Two layers are needed, and neither substitutes for the other:**
- **Stripe-side** — Stripe emails the account owner when an endpoint fails consistently, and can
  auto-disable it. Confirm that notification goes to a **monitored distribution address**, not one
  person's inbox.
- **App-side** — alert on our own logged failures. Stripe-side alerting only fires on sustained
  failure, so a low-rate failure affecting a handful of customers stays invisible for days.

**Acceptance criteria**
- Alert on unhandled processing errors (`LogError` at `StripeWebhookService.cs:90`) — any occurrence,
  not a rate threshold.
- Alert on processing failures (`LogWarning` at `:70`), rate-based.
- **Alert on signature validation failures** (`:40`, `:127`) — this is a *security* signal as much as
  an availability one; it means either a secret mismatch after rotation or someone probing the endpoint.
- Stripe Dashboard endpoint-failure notifications confirmed routed to a monitored address.
- A dashboard showing webhook success rate and handler duration, so 3.10 has data to reason about.
- Each alert path fired deliberately and confirmed received.

---

### 3.10 🟢 SPIKE — Evaluate Stripe webhook ingestion: keep direct, or move to durable queue · **S**

**Depends on:** 3.9 having collected real failure data

Should Stripe events land on a durable queue (Event Grid / Service Bus) behind a thin acknowledging
endpoint, rather than being processed synchronously on the request thread?

**Frame the default as "no change."** `AGENTS.md` is explicit about YAGNI, simplicity as the default,
and no new dependencies without approval. The current design already retries (via Stripe) and already
guards idempotency, so **the burden of proof is on switching** — and 3.9 is what produces the evidence
either way. Running this spike before there is failure data would mean deciding on aesthetics.

**What would actually justify a switch**
- Handler duration approaching Stripe's request timeout, causing retries and duplicate work.
- Failure patterns needing replay or dead-lettering that Stripe's retry window does not cover.
- Processing that should not block the response — slow downstream calls inside a handler.

**What to establish**
- Whether a first-party Stripe → Azure Event Grid path exists at all, or whether this would necessarily
  be the self-built "thin endpoint publishes to a queue" pattern. (Stripe ships a native Amazon
  EventBridge integration; do not assume an Azure equivalent without checking.)
- Cost of the alternative: new infrastructure, at-least-once delivery semantics, ordering, and the
  handler idempotency that becomes mandatory rather than merely wise.
- Whether existing idempotency (the event-ID guard) is sufficient under at-least-once redelivery.

**Acceptance criteria**
- A written recommendation with reasoning, referencing 3.9's observed failure rate and handler
  durations — an ADR if the answer is to switch.
- If the answer is "keep direct" (the expected outcome), that is recorded as a decision so it is not
  re-litigated informally every few months.

---

## Epic 4 — Databricks workspace isolation

> **Goal:** non-production activity cannot degrade, corrupt, or bill against production.

**Current state:** a single Databricks workspace (`dbc-bc2a5dd3-798c.cloud.databricks.com`) hosts both
VDAB's AI model serving and its Lakebase databases. The two are **not** in the same shape:

| | AI model serving | Lakebase |
| --- | --- | --- |
| Current isolation | ❌ **None.** Same workspace URL, same serving endpoint (`databricks-claude-sonnet-4-6`) for all three environments; only the access token differs | ✅ **Separate projects** — `prd` has its own project, `dev`/`stg` share another, with branches inside |
| Gap | Non-prod load consumes the same capacity, rate limits, and budget as production | Residual only: both projects live in one workspace, so workspace-level admin actions still reach both |
| Cost to close | **Config only** — see 4.2 | Already closed; verify permissions (4.4) |

**So this epic is really one piece of work: separating model serving.** The database story is already
in good shape — project-level separation is the meaningful boundary, and it exists.

> ⚠️ [Deployment guide 6](../deployment/6-lakebase-databases.md) currently describes Lakebase as **one
> project with three branches**, which no longer matches reality. Corrected by 4.3.

### 4.1 🔴 TASK — Freeze non-production Databricks activity during launch week · **S**

Cheap mitigation while 4.2 is in flight. Non-prod load hitting the same serving endpoint can throttle
production during exactly the window where it hurts most.

**Acceptance criteria**
- Team agreement on a non-prod AI-usage freeze for launch week, with an exception path.
- Serving-endpoint throughput monitored during launch.

---

### 4.2 🟡 STORY — Separate the AI model-serving workspace (prd vs. dev/stg) · **M**

Stand up a second Databricks workspace so production model serving is isolated from non-production.
Target shape: **one workspace for `prd`, one shared by `dev` + `stg`** — cheaper than three, and it
puts the boundary where the risk is.

**The good news:** `databricksAiWorkspaceUrl` and `databricksAiEndpointName` are *already*
per-environment parameters in `main.dev/stg/prd.bicepparam`, and the access token is already a
per-environment Key Vault secret. This is a provisioning and configuration change — **no application
code change required.**

**Acceptance criteria**
- A non-production Databricks workspace exists with its own model-serving endpoint.
- `databricksAiWorkspaceUrl` differs between `prd` and `dev`/`stg`.
- Each environment's `DatabricksAi__AccessToken` is scoped to its own workspace; a leaked non-prod
  token cannot reach production.
- Cost is attributable per workspace, with a budget alert on each.
- Unity Catalog objects created by non-prod QA are no longer indistinguishable from customer objects.
- [QA Strategy §2](./qa-strategy.md#the-two-entries-that-carry-most-of-the-risk) updated — Databricks
  stops being "over-tested before production" and becomes a genuine per-environment difference that
  belongs in the §5 verification pass.

---

### 4.3 🟡 TASK — Correct the Lakebase documentation · **S**

[Deployment guide 6](../deployment/6-lakebase-databases.md) describes a single Lakebase project with
`dev` / `stg` / `prd` branches. The actual topology is **two projects** — one for `prd`, one shared by
`dev` and `stg` — in a single workspace. Anyone following the guide today would look for a `prd`
branch in the wrong project.

**Acceptance criteria**
- Guide 6 reflects the two-project topology, with each project identified.
- The "never cross environments" safety rules restated in terms of projects, not just branches.
- Confirm whether 4.2 (moving the serving workspace) touches Lakebase connectivity at all — expected
  to be no, since the connection string is a direct Postgres endpoint independent of the serving
  workspace URL.

---

### 4.4 🟢 TASK — Review Lakebase permissions against the project boundary · **S**

Production already has its own Lakebase project, which is the meaningful isolation boundary and the
reason this is a small task rather than the large one it first appeared to be. The residual gap is
that both projects live in one workspace, so workspace-level administrative actions still reach
production.

**Acceptance criteria**
- Non-production credentials cannot perform operations against the `prd` project.
- Confirmed whether the credentials used for `dev`/`stg` work are workspace-admin scoped; if so,
  reduce them.
- A written note accepting single-workspace hosting for Lakebase, with the residual risk named — so
  the decision is recorded rather than assumed.

---

## Epic 5 — Documentation & changelog pipeline

> **Goal:** docs stay in sync at high release cadence, because the metadata is captured at authoring time.

### 5.1 🔴 STORY — Changelog fragment per PR + PR template · **S**

**The strongest "now" item in this backlog, because it is a habit.** Free on day one; expensive after
300 high-cadence PRs, by which point the history is unrecoverable and the team has to be retrained.

**Acceptance criteria**
- Each PR adds a one-line categorized fragment (`fixed` / `added` / `changed`) as a file — fragment-
  per-PR so it does not merge-conflict.
- PR template asks: user-facing? bug or feature? docs needed? changelog category? migration
  backward-compatible?
- The rollup is a build step: internal changelog = all fragments.

---

### 5.2 🟡 STORY — Two-tier changelog · **M**

**Depends on:** 5.1

**Acceptance criteria**
- Internal changelog auto-generated from every PR — complete, granular, engineering-facing.
- Public release notes are a curated subset, published on meaningful releases rather than per deploy.
- The public tier may start as a weekly hand-pick; the split itself is what matters now.

---

### 5.3 🟢 STORY — Pipeline publishes docs and changelog to WordPress · **M**

WordPress *is* the presentation store and has a REST API — no new shared database is needed.

**Acceptance criteria**
- Pipeline pushes content to pipeline-owned custom post types via the WordPress REST API, as a
  release-gated step.
- Marketing treats those post types as read-only and owns everything else.
- Ownership line agreed explicitly: **engineering owns what's true; marketing owns how it's presented
  and found.**

---

### 5.4 🟡 TASK — Confirm marketing accepts engineering as source of truth · **S**

Name it explicitly now rather than letting it surface later as a turf issue.
[Open question 7](./release-workflow.md#11-open-questions).

---

## Epic 6 — Release agility

> **Goal:** deploy decouples from release — "a gate is the release."

### 6.1 🟡 STORY — Surface feature flags as per-environment app settings · **S**

`FeatureManagement:EnablePreRelease` and `AuthenticationConfiguration:PasswordlessOnly` live only in
the artifact's `appsettings.json` with no Bicep override. Because we build once and promote, **flag
state is necessarily identical in staging and production — flags cannot dark-launch anything today.**
This is a capability we believe we have and do not.

**Acceptance criteria**
- Both flags surfaced as App Service app settings in `main.bicep` / `*.bicepparam`, variable per
  environment, with the artifact unchanged.
- A feature can run on in staging and off in production.
- Flag state added to the [QA §5](./qa-strategy.md#5-the-production-verification-pass) verification
  pass, since it becomes an environment difference.

---

### 6.2 ⚪ STORY — Runtime feature flags · **L**

**Depends on:** 6.1

Move off config-through-deploy (Azure App Configuration feature manager or similar) so deploy
decouples from release and gradual rollout becomes possible.

**Acceptance criteria**
- A production flag can be flipped without a deploy.
- Flipping a production flag is a **restricted, audited** action on par with a deploy — the governance
  that deploy gates currently provide for free must be added deliberately.
- Gradual cohort rollout supported.

---

### 6.3 ⚪ STORY — Docs published by the same gate that flips the flag · **L**

**Depends on:** 5.3, 6.2

The destination state. Pipeline pushes content as `draft` continuously into pipeline-owned post types;
the release gate flips `draft → publish` in the same motion that flips the feature flag. WordPress is
the store, the REST API is the gate's hands, the draft state is the staging area.

**Acceptance criteria**
- One action releases code and documentation together.
- Public release notes auto-assembled from fragments accumulated since the last release.

---

## Epic 7 — Infrastructure hygiene

### 7.1 🟢 STORY — Resource-group blast-radius boundary · **M**

All three environments share resource group `vdab` and one subscription, separated only by name
prefix. There is no structural boundary stopping a mis-scoped deployment or deletion from reaching
production.

**Acceptance criteria**
- A written decision: separate resource groups per environment, or resource locks plus scoped RBAC on
  production resources.
- Production resources carry a delete lock.

---

### 7.2 🟢 TASK — Adopt Lakebase branch rehearsal for non-trivial migrations · **S**

Branching can validate a migration against a copy of production data before it runs for real. The
capability exists and is unused.

**Acceptance criteria**
- Documented step for rehearsing a migration on a throwaway branch.
- Applied to the next schema change of any size.

---

### 7.3 ⚪ TASK — Remove or apply the inert `LongRunning` test filter · **S**

The PR pipeline filters on `Category!=LongRunning`, but no test carries the category. Harmless today,
misleading later.

---

### 7.4 🟢 TASK — Verify GeoLite2 database path resolves on Windows App Service · **S**

`GeoLiteConfiguration__DatabasePath` is a Linux-style path (`/home/data/geolite/...`) while the App
Services run Windows (`reserved: false`). `GeoLocationService` **fails soft** — it logs a warning and
geolocation silently stops working — so this needs a deliberate check rather than waiting for a report.

**Acceptance criteria**
- Confirmed whether geolocation actually resolves in a deployed environment.
- Path corrected if not.

---

## Summary by urgency

| When | Items |
| --- | --- |
| 🔴 **Pre-launch** | 1.1, 1.2, 1.3, 1.4, 1.6, 2.1, 2.2, 3.1, 3.3, 3.8, 3.9, 4.1, 5.1 |
| 🟡 **Launch week** | 1.5, 2.3, 2.4, 3.2, 4.2, 4.3, 5.2, 5.4, 6.1 |
| 🟢 **Next** | 2.5, 3.4, 3.5, 3.6, 3.7, 3.10, 4.4, 5.3, 7.1, 7.2, 7.4 |
| ⚪ **Later** | 6.2, 6.3, 7.3 |
