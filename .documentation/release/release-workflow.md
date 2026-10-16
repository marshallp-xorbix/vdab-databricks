# Release & Deployment Workflow — Now and Future

**Last Updated:** 2026-07-18
**Companion document:** [QA Strategy — What We Test, and Where](./qa-strategy.md)
**Mechanics (how to actually deploy):** [Deployment Guide](../deployment/README.md)

This document covers the *process* of releasing VDAB — who decides, when, what a release means, and
how code and its public documentation stay in sync. The step-by-step Azure mechanics live in the
[deployment guide](../deployment/README.md); this document deliberately does not repeat them.

>VDAB is **large, public, self-owned product**
going to production with full CI/CD. Prior production work was for business clients — less public,
less owned by us. That changes blast radius, user expectations, and the amount of documentation and
marketing surface that has to move in step with each release.

---

## 1. Where we are today

### Stack

- **Azure DevOps** for CI/CD — one pipeline, build-once-and-promote.
- **Azure App Service**, three environments in a single resource group. **Production alone runs
  Standard (S1) with a `staging` deployment slot**, which is what enables zero-downtime deploys and
  fast rollback by swap. `dev` and `stg` run Basic (B1), which cannot host slots — they deploy
  directly. (The prod swap slot is *named* `staging` and is **not** the `stg` environment; the
  collision is unfortunate and worth saying out loud in conversation.)
- **Databricks Lakebase** — a Postgres branch per environment; branching supports migration rehearsal
  and catastrophic recovery.
- **Feature flags** — `Microsoft.FeatureManagement` plus plain config booleans. Not a runtime flag
  system, and currently not even a per-environment one — see [§4](#4-feature-flags-as-a-release-mechanism).
- **WordPress marketing site** — separate from the app repo; hosts public docs, changelog, and the SEO
  surface.

### People

| Person | Role | Release capability today |
| --- | --- | --- |
| **Tim** | Dev lead | Only person who has released to production; only person releasing to staging |
| **Brooks** | Dev lead | Capable of taking releases; **needs Azure permissions confirmed for rollback**, not just approval |
| **Ross** | Project Manager | Approver |
| **Tom** | CTO | Approver |

Plus a small team and offshore support. Offshore does not typically hold the same privileges.

### Operating conditions

- Expecting a **high cadence** of bug fixes and feature updates post-launch.
- **Release mechanics are solid and effectively one-click. The pipeline is not the problem.**
- The primary concern is keeping **secondary documents** — public docs, changelog, marketing content —
  in sync at that cadence.

### Current pipeline

```
Build (compile + test + Bicep validate)  →  Deploy dev  →  [gate]  Deploy stg  →  [gate]  Deploy prd
```

- Triggered on merge to `develop`. `main` is the production record and hotfix base, and does **not**
  trigger builds. PRs run a separate validation pipeline (build + test, no deploy).
- One run = one **release candidate**. It auto-deploys `dev`, then holds at the staging and production
  gates. Approve only the candidate intended to ship; supersede the rest.
- Production deploys to the slot, runs migrations, then swaps.
- All gates currently use **"one of"** semantics — any single named approver passes the gate.

---

## 2. The framing: deploy is not release

The mechanics are fine. The genuinely open questions are about **authority, timing, and ownership
across team boundaries**:

1. Where the meaningful gates are, and who holds them.
2. How "deploy" relates to "release."
3. Who owns the documentation lifecycle across the app ↔ marketing boundary.

**The organizing insight — "publish is a release" becomes "a gate is the release."**

Today the mechanical act *is* the release. Deploying the code makes it live; publishing the content
makes it public. There is no gap between "it exists" and "it's live."

The mature state is one where code and docs publish continuously into a **staged or dark** state, and
a single **gate** is the release — one decision that flips the feature flag on *and* publishes the
documentation, together. This applies equally to code and content, and it is the destination that the
[Now vs. Later](#10-now-vs-later) sequencing points at.

---

## 3. Approval design

**Problem:** with "one of" semantics across a flat pool, a single person can ship to production. This is simultaneously too loose (no separation of
concerns) and a bus-factor risk on the people who *should* be involved.

>**Recommendation — keep "one of" semantics, but split the pools by role and require one from *each*
at the gate that matters.**

| Gate | Required approvals | Rationale |
| --- | --- | --- |
| **dev** | none (automatic) | Integration target. |
| **stg** | **Whoever holds the QA cycle** — QA lead or release coordinator, with a dev lead | Staging is not over-gated so much as **gated by the wrong people.** Exec approval adds latency without adding the knowledge this decision needs. Publishing to staging resets the QA baseline and invalidates completed testing, so the approver must know whether a cycle is in flight — see [QA Strategy §3.1](./qa-strategy.md#31-promoting-into-staging-is-a-scheduling-decision-not-just-a-quality-one). **Drop the exec requirement, but do not weaken the gate to "any reviewer"** — that would let a routine merge disturb an in-flight regression pass. Keep it heavier only if staging is client-facing UAT. |
| **prd** | one of **{Tim, Brooks}** — technical readiness ("is it safe to ship") **AND** one of **{Ross, Tom}** — business readiness ("should we ship this now") | Redundancy inside each pool, no single bottleneck, real separation of concerns. Azure DevOps supports this as two separate approval checks on the same Environment. |

**On the CTO:** reserve Tom as a *required* approver for major releases only, and as the escalation
point otherwise. A required exec gate on routine releases is either rubber-stamping or a
vacation-shaped outage.

**On offshore:** full participants in `dev` and `stg` — deploy there, prepare releases, author docs
and changelog entries. Production approval pools stay onshore.

**A consequence worth naming out loud:** if offshore covers hours when onshore approvers are asleep,
there are windows where the only people awake cannot deploy or hotfix. That is precisely what makes
the [break-glass path](#8-operational-gaps-to-close) load-bearing rather than optional.

---

## 4. Rollback and migrations — the false-comfort trap

Slots roll back **code** in seconds. Lakebase branching rolls back **database state**.

> ISSUE: Rollback is not fully covered yet.

**The failure case:** deploy → migration runs forward against production → users write against the new
schema → something is wrong → swap the slot back. Now **old code is running against a new schema**,
which usually breaks. And the database cannot be cleanly branched back either, because reverting to
the pre-migration branch discards every write customers made after the swap. On a live production
database taking real traffic, "revert the database" is disaster recovery, not routine rollback — it
costs data.

This is not hypothetical here: the pipeline runs migrations **before** the swap
([`templates/deploy.yml`](../../.pipelines/templates/deploy.yml)), against the shared production
database. The currently-live pre-swap code is *already* serving against the new schema during the
deploy window.

**Standard to adopt — the single highest-value technical decision in this document:**

> **Production migrations must be backward-compatible with the currently-deployed build.**

Expand/contract discipline: add a column rather than renaming in place; deploy code that writes both
the old and new shapes; backfill; drop the old shape a release *later*, once a swap-back is no longer
plausible.

With this standard, the slot swap becomes a **true instant rollback**, and Lakebase branching returns
to what it is genuinely best at — safely rehearsing migrations on a branch before they touch
production, plus catastrophic recovery.

> Task: The rule is currently a documented convention with **no enforcement**. Make it a PR checklist item (see [§6](#6-documentation-changelog-and-marketing-sync)), and treat any destructive migration as a release-blocking review item.

---

## 5. Feature flags as a release mechanism

If a flag can turn a feature on for real users, **flipping a production flag is a release** — and that
path has none of the gates being designed for deploys. "Who do we restrict?" is not only "who can
deploy," it is "who can flip a production flag," and those two need the same answer.

The open question was whether a production flag flip is a *runtime* change or a config change that
rides a deploy. **The code answers it, and the answer is worse than either option:**

`FeatureManagement:EnablePreRelease` and `AuthenticationConfiguration:PasswordlessOnly` are set only
in the artifact's `appsettings.json`. Neither is surfaced as an App Service app setting in
`main.bicep`. Because we build once and promote, this means:

1. A flag change requires a **code change, a rebuild, and a full re-promotion** through every gate —
   not just a deploy.
2. **Flag state is necessarily identical in `dev`, `stg`, and `prd`.** We cannot currently run a
   feature on in staging and off in production, which means **flags cannot dark-launch anything
   today.** The primary benefit of having flags is unavailable.

That reframes the priority. This is not only the "speed gap" it appeared to be — it is a capability
we believe we have and do not.

**Two steps, in order:**

- **Now (cheap):** surface the flags as per-environment App Service settings in `main.bicep` /
  `*.bicepparam`. This restores the ability to vary a feature between staging and production while
  keeping the artifact identical, and flag changes inherit the existing deploy gates for free —
  governed, if slow. Note the QA consequence: once flag state can differ per environment, **flag state
  becomes an environment difference** and belongs in the production verification pass
  ([QA Strategy §5](./qa-strategy.md#5-the-production-verification-pass)).
- **Later:** move to **runtime flags** (Azure App Configuration feature manager, or similar). Deploy
  decouples from release and gradual rollout becomes possible — but automatic gating is lost, so
  restriction and an audit trail must be added deliberately. That governance cost is the price of the
  agility, and it should be paid consciously.

**Target state:** the agility of runtime flags **plus** governance — a production flag flip treated as
a restricted, logged action on par with a deploy.

> Task: Update docs/requirements to put minor/major (not patch) updates behind a feature flag

---

## 6. Documentation, changelog, and marketing sync

This is the concern that scales worst with cadence, and therefore the one most worth designing now.

**Source of truth: the app repo.** Docs and changelog live as markdown, authored in the **same PR as
the feature**. Written by the person who knows what changed, reviewed with the same rigor as the code,
and structurally unable to go live before the feature does. Documentation that lives far from code
always rots.

>**DISCUSS OPTIONS**

**No new shared database is needed.** WordPress *is* the presentation store, and it has a REST API:

- The pipeline pushes content into WordPress via the REST API as a **release-gated step**.
- The pipeline owns **specific custom post types** — a docs + changelog section — written
  programmatically.
- Marketing treats those as read-only and owns everything else: positioning, landing pages, blog.
- SEO is preserved, because the content still lives and is indexed on the marketing domain.

**The ownership line to state explicitly** — this is an organizational conversation, not a technical
one:

> **Engineering owns *what's true*. Marketing owns *how it's presented and found*.**

**Responsibility chain:** developer writes the entry in the PR → reviewer checks accuracy → optional
writer/PM polish for public tone → **the pipeline publishes on release.** "Who publishes" stops being
a person and becomes a gate.

### Content types have different cadence profiles

| Content | Changes with | Problem type | Approach |
| --- | --- | --- | --- |
| Changelog | Every deploy, including bug fixes | **Volume** | Automate hardest |
| Feature / how-to / API docs | Behavior changes (features, not deploys) | **Depth** | Discipline at authoring time |
| Marketing content | Notable features and launches only | Low frequency | Human in the loop is fine |

A high bug-fix cadence floods the changelog but barely touches feature docs. Separating bug fixes
from features **by documentation profile** is what makes the whole problem tractable.

### Two-tier changelog

- **Internal changelog** — auto-generated from every PR. Complete, granular, engineering-facing.
- **Public release notes** — a curated, categorized, human-readable subset. Published on a cadence or
  on meaningful releases, *not* per deploy. At several fixes a week, a public entry per deploy is
  noise.

### The mechanism that survives cadence

Move the work to **authoring time**:

- **A changelog fragment per PR** — a one-line file, categorized (`fixed` / `added` / `changed`),
  written by the person making the change. Fragment-per-PR (towncrier / changesets style) avoids merge
  conflicts and turns the rollup into a build step: the internal log is all fragments; the public
  notes are a curated assembly.
- **A PR template** that asks, at PR time: user-facing? bug or feature? docs needed? changelog
  category? **backward-compatible migration?** (see [§4](#4-rollback-and-migrations--the-false-comfort-trap))

The principle: **capture the sync metadata at the moment of change**, rather than reconstructing it at
release time by whoever happens to be driving.

---

## 7. Release identity, versioning, and timing

### Two identifiers, two jobs

Keep these separate; conflating them is a common source of confusion.

| Identifier | Answers | Source | Audience |
| --- | --- | --- | --- |
| **Build number** | *Which exact bits are running?* | Azure DevOps run, carried by the `vdab-build` artifact | Engineering — traceability, rollback, support |
| **Version tag** | *Which release is this?* | Git tag on `main` at release time | Everyone — release notes, docs, marketing, customers |

**Recommendation:** tag `main` with `vMAJOR.MINOR.PATCH` when a candidate reaches production. VDAB has
no external API consumers, so define the components by **user-visible meaning** rather than API
compatibility:

- **MAJOR** — a launch moment worth coordinating with marketing. `v1.0.0` is go-live.
- **MINOR** — user-visible new capability. Earns public release notes.
- **PATCH** — fixes and internal changes. Internal changelog only.

That mapping makes the version number itself decide the documentation tier, which is exactly the
automation hook [§6](#6-documentation-changelog-and-marketing-sync) needs.

**Supporting change:** expose the build number (and version) at runtime — extending the existing
`GET /api/config` is the cheapest option. Today there is no reliable in-app way to confirm which build
is live, which the production verification pass needs
([QA Strategy §5.1](./qa-strategy.md#51-reachability-and-identity)) and which any support
conversation will want.

### Timing

Release timing is a function of **rollback and on-call maturity, not the calendar.** Fast rollback
plus someone watching makes a Friday afternoon defensible; without both, avoid Fridays and end of
day, and deploy in low-traffic windows.

Also decide: cadence (continuous / scheduled / on-demand); whether releases must coordinate with a
marketing or comms moment; and whether a status page is needed for user-facing maintenance.

With gradual rollout behind a flag, "when do we release" becomes "when do we widen the cohort" — a
reversible decision rather than a one-way gamble.

### Launch shape

Lean **soft and gradual** rather than a hard cutover. Flags plus slot-based zero-downtime deploys are
exactly the toolkit for enabling a feature for a small cohort, watching error rates, and widening.
For a first large public product we own, that de-risks launch substantially and decouples the release
from a fixed marketing moment.

---

## 8. Operational gaps to close

- **Break-glass / hotfix path.** Production is down at 2am; waiting on the full approver set is not
  viable. Define a lighter but **fully audited** emergency path — one dev lead can push a hotfix, with
  mandatory retroactive review — **now, in calm conditions.** This matters more than usual given a
  small onshore approver pool and offshore coverage hours. Note the QA consequence: a hotfix that
  skips staging forfeits the confidence staging normally provides, and production testing must expand
  to compensate ([QA Strategy §7](./qa-strategy.md#7-when-the-teams-instinct-is-right)).
- **No health endpoint in any deployed environment.** `/health` and `/alive` are mapped only under
  `IsDevelopment()`, so they 404 in `dev`, `stg`, and `prd`. There is nothing to gate a slot swap on,
  nothing for an App Service health probe, and nothing to automate a smoke test against. Cheap to fix,
  and it unblocks several items below.
- **No post-deploy verification of any kind.** No smoke tests, no pre-swap validation, no automated
  rollback. Azure's swap warms the slot with its own ping, but nothing confirms the application
  actually works before traffic moves.
- **Post-deploy monitoring and on-call.** A public product means real users and someone owning it when
  it breaks. Who is on call, what is the escalation path, are there automated smoke tests after the
  swap and error-rate alerting — or do we learn about problems from a customer? **This is the biggest
  cultural shift from the business-client work.**
- **Single resource group, single subscription.** All three environments share resource group `vdab`,
  separated only by name prefix. There is no resource-group blast-radius boundary; a mis-scoped
  deployment or deletion has nothing structural stopping it.
- **Production AI model serving shares a workspace with dev and staging.** All three environments call
  the same Databricks serving endpoint, so non-production load competes with production for capacity,
  rate limits, and budget — with no way to attribute cost. Lakebase is already separated by project
  (`prd` has its own), so this is specific to model serving, and the fix is configuration rather than
  code: `databricksAiWorkspaceUrl` is already a per-environment parameter. See
  [backlog Epic 4](./release-backlog.md#epic-4--databricks-workspace-isolation).
- **Migration rehearsal is available but unused.** Lakebase branching can validate a migration against
  a copy of production data before it runs for real. Worth adopting for any non-trivial schema change.

---

## 9. Bus factor (raised, largely closed)

Tim is currently the only person who has released to production and the only one releasing to
staging. Assessed as **low risk**: the pipeline is one-click and Brooks is capable of taking it over.

Residual items only:
- Confirm Brooks's Azure permissions for **rollback** (not just approval).
- Get others releasing to **staging** routinely, so the capability is exercised rather than
  theoretical.

---

## 10. Now vs. Later

**Sorting test:** do it now if it is cheap now and painful to retrofit. Defer it if it is an agility
upgrade to something that already works.

### Now — before or at launch

| Item | Why now |
| --- | --- |
| **Changelog fragments + PR-template discipline** | The strongest "now" item, because it is a **habit**. Free on day one; expensive after 300 high-cadence PRs, by which point the history is unrecoverable and the team has to be retrained. |
| **Two-tier changelog split decided** | Even if the public tier starts as a weekly hand-pick. |
| **Publish = release, coupled** | Pipeline pushes docs/changelog to WordPress as part of the release. Slightly manual, honest, and works from day one. |
| **Backward-compatible migration standard adopted** | Turns the slot swap into a real rollback. Highest-value technical decision here. |
| **Approval pools restructured** | One from each role pool at production; staging de-gated. |
| **Break-glass path defined** | Must exist before it is needed, not during. |
| **Health endpoint exposed in deployed environments** | Unblocks pre-swap gating, health probes, and automated smoke tests. |
| **Feature flags surfaced as per-environment app settings** | Restores a capability we believe we already have. |
| **Build number exposed at runtime** | Needed to confirm what is live. |

### Later — the "gate is the release" destination

| Item | What it buys |
| --- | --- |
| **Runtime feature flags** | Move off config-through-deploy so deploy genuinely decouples from release. |
| **Docs staged as drafts, published by the same gate that flips the flag** | Code and docs released in one action. WordPress already has draft/published states and a REST API, so this is literally: the pipeline pushes content as `draft` continuously into pipeline-owned post types, and the release gate flips `draft → publish` in the same motion that flips the feature flag. WordPress is the store, the REST API is the gate's hands, the draft state is the staging area. |
| **Public release notes auto-assembled** | From the fragments accumulated since the last release, published on the flip. |
| **Automated post-swap smoke tests + error-rate alerting** | Replaces the manual production verification pass with a gate. |

### The sequencing bonus worth telling leadership

While **publish = release**, documentation publishing **inherits the deploy gates for free** — no
separate flag or publish governance is needed. The moment we decouple to **gate = release**, we take
on "who can flip a production flag / publish live docs" as a restricted, audited action.

That entire governance conversation can therefore be **consciously deferred, with the decoupling
itself as its trigger.**

---

## 11. Open questions

Questions 1 and 2 below have been partially answered by reading the code; the rest remain genuinely
open and are the agenda for the leadership discussion.

1. ~~Is a production feature flag flip a runtime change, or does it ride a deploy?~~ **Answered — it
   rides a full rebuild and re-promotion, and flag state cannot differ between staging and
   production.** The remaining question is whether to fix that cheaply now (per-environment app
   settings) or invest in runtime flags. See [§5](#5-feature-flags-as-a-release-mechanism).
2. **Is staging internal-only, or client-facing UAT?** Determines whether staging can be de-gated
   ([§3](#3-approval-design)). Everything else in this document assumes internal-only.
3. **Hard launch tied to a marketing push, or soft/gradual rollout?**
4. **Who is on call, and who realistically responds at 2am?** Shapes both approval concentration and
   the emergency path.
5. **Release cadence** — continuous, scheduled, or on-demand?
6. **What defines a "major release"** requiring CTO sign-off, versus routine? (The versioning scheme
   in [§7](#7-release-identity-versioning-and-timing) offers a natural definition — MAJOR and MINOR
   versus PATCH.)
7. **Does marketing accept engineering as the source of truth** for docs and changelog, with marketing
   owning presentation and SEO? Name it explicitly now, rather than letting it surface later as a turf
   issue.
