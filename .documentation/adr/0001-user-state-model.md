# ADR-0001: User state model (account vs membership)

**Status:** Accepted  
**Date:** 2026-08-24  
**Related:** [User state model review](../user-state-model-review.md) (§9–§12, Phases 0–5)

## Context

PR 982 fixed seat-removal bugs by widening auth gates and auto-minting personal tenants (including on token refresh), while soft-delete and invite flows treated `ApplicationUser.TenantId` as authority over who may administer an account. That conflated two independent axes:

1. **Account** — identity, authentication factors, profile, soft-delete / anonymization.
2. **Membership** — access to a specific tenant (Active / Suspended / Ended).

Industry practice (GitHub, Atlassian, Notion, Figma, Vercel, Slack) keeps account administration off the inviting tenant unless domain verification / managed-user machinery exists. VDAB’s team decision: no tenant administers any user’s account on Trial / Individual / Team; Enterprise domain verification remains future work.

Positions A (offboarding should kill the identity) and B (contractor keeps their account) both had legitimate cores. The chosen model makes **B the universal account rule** and serves A’s access-revocation needs entirely through **membership** operations plus audit.

## Decision

1. **Account vs membership are separate.** Tenant admins manage memberships (role, suspend/resume, remove, restore within window). Platform (or self) manages account fields (`IsActive`, `DeletedOn`, email, factors, profile).

2. **Detached is a supported state.** Zero Active memberships means the user is signed in without a workspace. Login and refresh **must not** mint a personal tenant. Creating a workspace is an explicit user action (`IPersonalWorkspaceService.CreatePersonalWorkspaceAsync` / `POST /api/Tenant/personal-workspace`). Self-registration still creates a first Incomplete workspace.

3. **`ApplicationUser.TenantId` is not authority.** Membership `IsDefault` / last-accessed drives home tenant. Invite accept sets membership default only; it does not write account `TenantId`. Column drop is deferred.

4. **Retirement and anonymization clocks** (`AccountLifecycleConfiguration`):
   - `MembershipReinstatementDays` (default 90): Ended memberships may be reactivated in-window; outside the window a new membership row is inserted.
   - `RetiredAnonymizationDays` (`int?`, **null = disabled**): on registration / user-create for an email, lazily anonymize matching Retired rows older than the clock. Recommended ops value when enabling: **90 days**. This is defense-in-depth for PII sitting on tombstones, **not** a retention SLA and **not** a background sweeper (`IHostedService` / Hangfire / Quartz are out of scope).

5. **Email is freed on Retired immediately** via the partial unique `UserNameIndex` (`DeletedOn IS NULL`). New registration always creates a **new** `ApplicationUser` Id (never reuses a Retired/Anonymized row).

6. **§9.3 invariants** are shipped as named tests in `UserStateModelInvariantTests` (Invariant1–Invariant11).

## Consequences

- Detached users see no-workspace UX and CTAs (create workspace / accept invite); they are not pushed into billing setup solely for lacking memberships.
- Refresh tokens for Detached users carry no `tenant_id`; that is expected.
- Lazy anonymization failures must not fail registration (log + continue).
- Anonymization is opportunistic at register-time, so a Retired row may keep PII until someone registers that address (or ops enables a future sweeper — explicitly not this ADR).
- Enterprise domain verification / managed accounts remain the path if Position A’s corporate-email-reuse case needs tenant-side account control later (§10.2 / §13).

## Key types and config

| Area | Location |
| --- | --- |
| Access gate | `IAccountAccessPolicy` / `AccountAccessPolicy` |
| Lifecycle | `IUserLifecycleService` (restore, purge, lazy anonymize) |
| Personal workspace | `IPersonalWorkspaceService` |
| Clocks | `AccountLifecycleConfiguration` |
| Tombstone lookups | `TombstoneAwareUserStore`; `IUserRepository.GetRetiredByNormalizedEmailAsync` |
| Invariants | `Tests/Services/UserStateModelInvariantTests.cs` |
