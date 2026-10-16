# User State Model — Review and Plan

## 1. Issue

PR 982 ("User Removed from Tenant Seat") set out to fix a real bug in seat management. In doing so it redefined what it means for a user to be disabled or deleted, and added a new capability — automatic account reactivation at sign-in. In solving it, the PR introduced new problems. The shortcoming it identified was real; how to solve it was not a decision to make while fixing the surrounding bugs.

Underneath is a legitimate product question: should a removed user be able to regain access to VDAB?

- **Position A (offboarding).** Most VDAB tenants are one company on one email domain, and a seat is usually removed because the person left. Their identity should not survive as a live account bearing the company email, and reusing the row under a new tenant links them to history that is no longer theirs.
- **Position B (contractor).** A consultant on their own domain — `bob@contractor.io` invited onto Acme's team — is not Acme's identity to terminate. On removal they keep, or can obtain, their own independent account.

Both are correct for their case. The current code implements B unconditionally; the pre-PR code implemented A unconditionally, badly enough to strand users. §9 proposes a state model in which the two stop competing — Position B becomes the universal rule, and Position A's legitimate core, revoked and audited access, is served entirely by membership operations. §10 sets out the authority rule and the research it rests on; §10.3 states plainly what Position A trades away.

---

## 2. The state model before PR 982

Four states encoded across two independent fields, plus ASP.NET Identity's lockout columns.

| State | Encoding | Entered by | Exited by |
| --- | --- | --- | --- |
| **Active** | `IsActive=true`, `DeletedOn=null` | Registration; invite acceptance | — |
| **Admin-deactivated** | `IsActive=false`, `DeletedOn=null` | `POST /api/User/{id}/deactivate`; tenant soft-delete cascade | `POST /api/User/{id}/reactivate` |
| **Seat-removal orphan** | `IsActive=false`, `DeletedOn` + `DeletedBy` set, **email intact** | Seat/member removal, only when the removed tenant was the user's home tenant *and* no membership remained | **Nothing** |
| **Admin soft-deleted** | Same as above, but email mangled to `{email}\|\|DELETED\|\|{ticks}` | `DELETE /api/User/{id}/soft-delete` | Nothing (hard purge only) |
| **Locked** | `LockoutEnd` in the future | Admin lock; failed password attempts | Admin unlock |

### 2.1 The bug the PR was chasing

The "seat-removal orphan" state was a dead end (`SeatManagementService.HandleRemovedUserOwnershipAsync`, pre-PR `SeatManagementService.cs:1067-1072`):

```csharp
else if (user.IsActive)
{
    // No tenant remains — soft-deactivate the now-orphaned account.
    user.IsActive = false;
    user.DeletedOn = utcNow;
    user.DeletedBy = performedByUserId;
    // ...
}
```

A user in that state:

- could not authenticate on any path (password, passcode issuance, and passcode verification all gated on not `IsActive`);
- was **invisible to every admin screen** — `UserRepository` filters `DeletedOn == null`, so no admin could find them;
- permanently occupied the unique `UserNameIndex` slot with their real email;
- received a duplicate-registration email **containing a live password-reset link** if they tried to sign up again, then was refused at every gate;
- could not be rescued by `POST /api/User/{id}/reactivate` — `ReactivateUserAsync` sets `IsActive=true` without clearing `DeletedOn`, so they stay hidden.

The only remedy was a global-admin hard purge. **The bug is real; the PR's motivation is sound.**

---

## 3. The state model after PR 982

| State | Encoding | Change |
| --- | --- | --- |
| **Active** | `IsActive=true`, `DeletedOn=null` | unchanged |
| **Active but homeless** | `IsActive=true`, `DeletedOn=null`, `TenantId=null`, zero live memberships | **NEW** — this is what member removal now produces |
| **Admin-deactivated** | `IsActive=false`, `DeletedOn=null` | unchanged encoding, but now the *strongest* block in the system |
| **Legacy orphan** | `IsActive=false`, `DeletedOn` set, email intact | **frozen population** — nothing creates new ones; existing rows self-heal at sign-in |
| **Admin soft-deleted** | `IsActive=false`, `DeletedOn` set, email mangled | unchanged |
| **Locked** | `LockoutEnd` future | unchanged |

### 3.1 Removal no longer disables or deletes

The same branch now writes only `user.TenantId = null` plus audit fields; no branch of the post-PR method writes `IsActive` or `DeletedOn`/`DeletedBy`.

### 3.2 Three authentication gates were widened

The one live resurrection surface, reachable anonymously:

```csharp
// PRE                          // POST
if (!user.IsActive)             if (!user.IsActive && user.DeletedOn is null)
```

`VerificationChallengeService.cs:123` — a soft-deleted row with an intact email now receives a real emailed code. The verify predicate was widened to match at `:248`, replacing a comment that stated the check was belt-and-braces so an inactive address *"can never authenticate whatever the cache holds"* — a deliberate removal of that guarantee.

With `PasswordlessOnly=true` in production, the emailed code is the only factor, so this gate is the whole security boundary. The password-login gate was widened identically (`AuthService.cs:275`) but is dormant: `LoginAsync` returns `ForbiddenError` at `:266` first.

### 3.3 `AccountReactivationService` — new

The first code in the solution that clears `DeletedOn`/`DeletedBy`:

```csharp
user.IsActive = true;
user.DeletedOn = null;
user.DeletedBy = null;
user.TenantId = null;
```

`AccountReactivationService.cs:149-152`. Its carve-outs are correct — it skips global Administrators and users holding any live membership, and explicitly refuses admin-deactivated accounts with a comment naming the rule. But nulling `DeletedBy` is uncompensated: there is **no `IAuditLogService` call in `SeatManagementService` or either removal controller, before or after the PR**, so "who removed this person" is unrecoverable from the row.

### 3.4 Every token issuance auto-provisions a tenant

`EnsurePersonalTenantForLoginAsync` is called from `AuthResponseService.GenerateAuthResponseAsync:75`, which is shared with `SessionTokenSecurityService.RefreshTokenAsync` — so a **background token refresh** can create a tenant row. The provisioning code is a near-verbatim copy of `UserProvisioningService.CreateRegistrationTenantAsync` and has already drifted from it (constant vs. string literal for `"incomplete"`; missing `SubscriptionTier`).

### 3.5 Net effect: a semantic inversion

**"Deactivated" is now a harder block than "deleted."** An admin-deactivated account cannot authenticate by any route. A soft-deleted account with an intact email can request a code, receive it, verify it, and be silently restored to full life.

---

## 4. The scenario, end to end

### 4.1 Two premises to correct

**Nobody re-registers.** Registration with an existing email is an unconditional no-op fake success *both before and after the PR* — `FindByEmailAsync` finds the row, `UserProvisioningService` returns `IdentityDuplicateError`, and `AuthService.cs:56-63` converts it to a fake success for enumeration protection. `UserProvisioningService.cs` is byte-identical pre/post. The PR did not enable re-registration.

**The auto-provisioned tenant is not a billing event.** `TenantService.CreateTenantAsync` skips Stripe customer creation for `Incomplete` tenants, and the user lands on the `choose-subscription` step. The concern is data hygiene and governance, not money.

### 4.2 Before

Admin removes Alice → seat freed → membership soft-deleted → `IsActive=false`, `DeletedOn` set, `TenantId` left dangling at the tenant she was just removed from. No sessions or refresh tokens revoked. She lands in the §2.1 dead end in full.

### 4.3 After

Admin removes Alice → seat freed (now also nulling `seat.User`) → membership soft-deleted → `TenantId=null`, account stays fully live → **sessions and refresh tokens revoked** (genuinely new). She signs in normally. `AuthResponseService` sees zero memberships and mints her a tenant named `user-{her id}` with `SubscriptionStatus=Incomplete`, `OwnerId` = her id, and a `TenantAdmin` membership. She lands on a paywall in an empty workspace.

**ID reuse is confirmed.** Same `ApplicationUser.Id`, new tenant, same row. The history bleed is narrow: apps, Databricks connections, and memberships are all tenant-scoped at the read layer. The one concrete leak is `UserPlatformAiUsage`, keyed `(UserId, PeriodKey)` with **no `TenantId` column**, so platform AI consumption for the current period follows the user.

The real cost is governance: an ex-employee keeps a live identity bearing the company email, **no field on the row records that they were ever removed**, and their former tenant admin can no longer see them — the tenant user list requires a live membership.

### 4.4 The auto-provisioned tenant permanently demotes her at her original tenant

Worse, and not obvious: **once Alice has her own tenant she can never be a full member of Acme again.** She can only come back as a guest, and the outcome is decided by a race she is not aware of.

`TenantInviteService.EnsureDefaultTenantAsync:811-835` only adopts the inviting tenant when the home pointer is **unset or stale**:

```csharp
if (user.TenantId.HasValue)
{
    bool stillBelongsToHomeTenant = await _userTenantMembershipService.UserBelongsToTenantAsync(
        user.Id, user.TenantId.Value);
    if (stillBelongsToHomeTenant) { return; }   // ← Alice stops here, forever
}
```

Auto-provisioning made her a `TenantAdmin` of `user-{her id}`, so `stillBelongsToHomeTenant` is permanently true and the method returns before the adoption line. Her `TenantId` stays pointed at her personal tenant, and since `EnforceTenantScopeAsync` gates on `user.TenantId == callerTenantId` (§10.1), Acme now gets:

> *"This user is a guest of your tenant; only their tenant role and membership can be changed here."*

The race: if Acme re-invites her **before** she signs in, `TenantId` is still null from the removal, the stale branch fires, Acme adopts her, and she returns as a full member. If she signs in **first** — even once, even accidentally — the personal tenant is minted and the demotion is permanent. Nothing anywhere re-points `TenantId` back to Acme.

Two things follow. First, the pre-PR behavior was differently broken rather than better: she could not return at all, because she could not authenticate to accept an invite. Second, this compounds §6 item 1 — her soft-deleted Acme membership row still occupies the unfiltered unique index on `(UserId, TenantId)`, so the re-invite may fail at the database layer before any of this is reached.

Under §9–§11 the whole scenario dissolves: no personal tenant is minted, `ApplicationUser.TenantId` carries no authority, and nobody is a "guest" in the ownership sense because no tenant administers any account.

---

## 5. What is worth keeping

Five changes in PR 982 are separable from the disputed semantics and should survive whatever the team decides.

| Change | Why keep |
| --- | --- |
| `ClearSeatAssignment` nulls `seat.User` alongside `seat.UserId` | Real EF re-fixup bugfix. Repositories return `AsNoTracking` entities with `.Include(seat => seat.User)`; on a detached update EF could re-derive `UserId` from the populated navigation and silently undo the unassignment. |
| `PendingCancellation` seats now release their occupant | The pre-PR branch required `Status == Active`, so a member removed while their seat was pending cancellation stayed recorded as its occupant indefinitely. |
| Session revocation on removal | Did not exist pre-PR. **Keep it, but re-scope it** — the tokens must die either way, and per §11 step 6 and §9.3 invariant 9 revocation becomes tenant-scoped (refresh tokens and security stamp for that tenant, plus that tenant's `DatabricksUserToken` rows) rather than account-global. Gap: guests (`TenantId != tenantId`) are never revoked. |
| Transaction plumbing (`RemoveUserFromTenantWithinTransactionAsync`) | Eliminates a nested `TransactionScope`; membership delete and user-row write now commit atomically. Cleanup: `RemoveUserFromTenantAsync` now has zero production callers. |
| `useRemoveUserFromSeat` + `seatQueryKeys` factory | Pre-PR a failed removal did no cache refresh, leaving the seat table stale. Conforms to the project's one-factory-per-entity rule. |

### 5.1 Defects introduced by the PR, independent of the design question

- **Four untyped `Result.Fail` on the authentication hot path** (`AccountReactivationService.cs:61, :108, :133, :160`). Untyped errors map to HTTP 400 via `ControllerExtensions.cs:168`, so a failed reactivation returns 400 from endpoints that otherwise only return 401 — and two of them interpolate raw Identity error descriptions into a message returned to an anonymous caller. An `AGENTS.md` violation in new code.
- **A second, divergent copy of the reactivation rule** in `TenantInviteService.ReactivateUserForInviteAcceptAsync:842-849`. Its only guard is `if (user.IsActive && user.DeletedOn is null) return`; it omits the Administrator check, the membership check, and the admin-deactivation carve-out its sibling documents. Not a live privilege bypass — the endpoint is `[Authorize]` and `AccessTokenSessionValidator` hard-fails on not `IsActive` — but a real DRY defect and audit wipe.
- **Contradictory admin UI copy.** The Seats & Users dialog still says *"their account will also be deactivated"* (now false) while the User Detail dialog says *"They can sign in again to choose their own plan or accept a new invite"* (true), and the User Detail trigger button still reads **"Remove & Deactivate"**. Both controllers' XML docs still describe deactivation and feed the published OpenAPI/Scalar contract.
- **The new semantics are pinned by tests, but the wiring is not.** No test verifies that `AuthService` or `AuthResponseService` actually *call* the reactivation service, so a future refactor could drop those calls and the suite stays green.

---

## 6. Pre-existing defects surfaced by this review

These are **not** caused by PR 982, but they constrain every option below.

1. **`iam."UserTenantMemberships"` has a unique, unfiltered composite index on `(UserId, TenantId)`** while membership removal is a *soft* delete that leaves the row in place. Re-inviting a removed user back to the **same tenant** should therefore hit a `23505` unique violation, surfacing as an opaque 400 (`PostgresExceptionHelper` only knows `42P01`). This is the exact flow PR 982 advertises in `ISeatManagementService` docs and `UserDetail.tsx` copy. *Inferred from schema plus code path, not observed — worth a five-minute manual test.*

   The fix pattern already exists in the same `DbContext`:
   ```csharp
   // IX_UserTenantPreferences_UserId_TenantId — already does this correctly
   entity.HasIndex(e => new { e.UserId, e.TenantId })
         .IsUnique()
         .HasFilter("\"DeletedOn\" IS NULL");
   ```

2. **`UserLifecycleService.ReactivateUserAsync` never clears `DeletedOn`** (`:223`) and loads via `FindByIdAsync` with no `DeletedOn` filter (`:209`) — the failed rescue in §2.1, leaving `(IsActive=true, DeletedOn set)` and still hidden from every admin list. A one-line fix removes the only reachable trigger for the invite-path divergence in §5.1.

3. **`ResetAccessFailedCountAsync` is never called.** An admin unlock clears `LockoutEnd` but leaves `AccessFailedCount` at threshold, so the next single failure re-locks. And `LockUserAsync`/`UnlockUserAsync` both refuse to act on an inactive user, so lockout cannot be cleared until the account is reactivated.

4. **No EF global query filters exist** (`HasQueryFilter`: zero hits). `UserManager.FindByEmailAsync` sees soft-deleted rows; soft-delete exclusion is hand-written per query in `UserRepository` only.

5. **`DatabricksUserToken` rows survive removal.** Keyed `(UserId, WorkspaceConnectionId)`, holding the user's encrypted Databricks OAuth refresh token against the *old* tenant's workspace connection. Only a full purge deletes them. Pre-PR this was inert because the account could not authenticate; post-PR the identity is reachable.

---

## 7. Email uniqueness — the constraint question

**Today:** `iam."Users".UserNameIndex` is `unique: true` on `NormalizedUserName` with **no filter**. Because `UserName` is always assigned the email, that index *is* the de-facto email uniqueness. `EmailIndex` on `NormalizedEmail` is **not** unique. Application-level email uniqueness comes from ASP.NET Identity's default `UserValidator` via `options.User.RequireUniqueEmail = true` (`Program.cs:397`).

The only mechanism that ever frees a taken email is the destructive `||DELETED||{ticks}` mangling in `UserService.SoftDeleteUserAsync`, which nothing reverses.

### 7.1 A composite index on `(NormalizedEmail, DeletedOn)` will not work

PostgreSQL unique B-trees default to `NULLS DISTINCT`. Every live user has `DeletedOn IS NULL`, so every live row reads as distinct and unlimited duplicate registrations pass. `UNIQUE NULLS NOT DISTINCT` (PG15+) would fix it at SQL level but has no clean EF fluent surface and would drift from the model snapshot.

**Use a partial unique index instead** — the pattern this DbContext already uses five times:

```csharp
entity.HasIndex(e => e.NormalizedUserName)
      .IsUnique()
      .HasFilter("\"DeletedOn\" IS NULL")
      .HasDatabaseName("UserNameIndex");
```

### 7.2 What it actually takes

The Identity integration is one new file with two method overrides.

`UserValidator<TUser>.ValidateUserName`/`ValidateEmail` call `manager.FindByNameAsync`/`FindByEmailAsync`, and `UserManager` delegates both to `IUserStore`. **Override the store and the default validator becomes tombstone-blind for free.** No custom `IUserValidator`, no removing a `ServiceDescriptor`, no switching to `AddIdentityCore` — which would also drop `SignInManager` and the default scheme wiring this app relies on.

Current wiring is `AddIdentity(...).AddEntityFrameworkStores<ApplicationDbContext>().AddDefaultTokenProviders()` (`Program.cs:382-401`) with no custom store or validator, so `.AddUserStore<>()` appends cleanly.

```csharp
// .DataAccess/TombstoneAwareUserStore.cs — override exactly these two.
// FindByIdAsync is deliberately left unfiltered: purge, restore and the
// admin detail view all need to resolve tombstones.
public override Task<ApplicationUser?> FindByEmailAsync(string normalizedEmail, CancellationToken ct = default) =>
    Users.Where(u => u.DeletedOn == null)
         .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, ct);
```

| Remaining work | Detail |
| --- | --- |
| **No `NormalizedEmail` unique index needed** | `UserName` tracks `Email` invariantly — verified: the only `ApplicationUser` construction site in application code is `UserProvisioningService.cs:256-258` (`UserName = request.Email`), and the sole email-change path calls `SetUserNameAsync` (`AuthService.cs:511`). Adding a second unique index buys nothing and is the only proposed step that could abort the migration. |
| **A global `HasQueryFilter` is a trap** | It would also hide tombstones from paths that legitimately need them (`PurgeUserDataAsync`, `GetUsersInRoleAsync`, restore), and `IgnoreQueryFilters()` is not reachable through the `UserManager` API. |
| **DI ordering is load-bearing** | `.AddUserStore<>()` uses `AddScoped` (last wins) while `AddEntityFrameworkStores` may use `TryAdd`. Assert the resolved `IUserStore<ApplicationUser>` in a DI test — a silent no-op would invalidate everything downstream. |
| **Error mapping** | `PostgresExceptionHelper.cs:13` knows only `42P01`, so a race-condition `23505` surfaces as a 500 rather than a `ConflictError`. |
| **Migration shape** | Both index changes go unfiltered-unique → partial-unique, which is strictly *weaker*, so no existing row set can fail the build. EF emits no `CONCURRENTLY`, so it still takes a brief write lock on `iam."Users"` — schedule it, but there is no abort path. |

---

## 8. Population sizing

**There is no legacy population worth migrating.** The widened anonymous passcode gate (§3.2) and `AccountReactivationService`'s legacy-orphan rescue path (§3.3) exist solely to serve rows the pre-PR code already wrote. With that population near-empty and no external users to strand, both can be **deleted outright rather than migrated**.

Run before index work:

```sql
-- (a) legacy orphans the widened gates exist to serve — expected: ~0
SELECT count(*) FROM iam."Users"
WHERE "IsActive" = false AND "DeletedOn" IS NOT NULL AND "Email" NOT LIKE '%||DELETED||%';

-- (b) rows carrying the destructive mangling — expected: ~0
SELECT count(*) FROM iam."Users" WHERE "Email" LIKE '%||DELETED||%';

-- (c) would the partial unique index build succeed? — must be zero rows
SELECT "NormalizedUserName", count(*) FROM iam."Users"
WHERE "DeletedOn" IS NULL
GROUP BY "NormalizedUserName" HAVING count(*) > 1;

-- (d) does UserName track Email in the data, not just in code? — must be zero rows
SELECT count(*) FROM iam."Users" WHERE "NormalizedUserName" <> "NormalizedEmail";
```

Only **(c)** and **(d)** are true gates. A non-zero **(d)** invalidates the "`UserNameIndex` is de-facto email uniqueness" premise in §7.2 and means Phase 1 needs re-scoping.

---

## 9. Recommended state model

**Two organizing rules.**

> **1. No tenant administers any user's account.** A tenant administers *memberships* in that tenant — role, seat assignment, suspension, revocation, tenant-scoped session revocation. Account attributes — email address, authentication factors, profile, deletion — are self-service by the account holder, or a Xorbix platform operation. See §10 for the research this rests on.
>
> **2. An account holds the email address if and only if `DeletedOn IS NULL`**, enforced by a partial unique index rather than by rewriting the address.

Rule 1 makes the two positions in §1 stop competing: Position B (the contractor keeps their account) becomes the *universal* rule, and Position A's legitimate core — offboarding must revoke access and be audited — is served entirely by membership operations. What Position A trades away is stated honestly in §10.3.

### 9.1 Three axes, three owners

The defect underneath every problem in §2–§6 is that these were fused. Separated, each has exactly one actor who controls it:

| Axis | States | Controlled by |
| --- | --- | --- |
| **Tenant** | Incomplete → Trialing/Active → PastDue/Paused → Canceled; plus `IsActive`, `DeletedOn` | Billing (Stripe) + platform |
| **Membership** | Active → Suspended → Ended | **The tenant admin** |
| **Account** | Active → Detached → Retired → Anonymized; plus Suspended | The account holder + platform |

**Membership is where tenant admins do all their work.** It already exists as `UserTenantMembership` carrying `Role`, `IsDefault`, `LastAccessedAt`, `JoinedAt` and soft-delete via `TrackableEntity`. It needs one addition — a status for **Suspended**, distinct from `DeletedOn` — so "temporarily deactivate this person" is a membership operation that never touches the user row and cannot leak across tenants.

| Membership state | Meaning | Seat | Tenant access |
| --- | --- | --- | --- |
| **Active** | Normal member of this tenant | Usually assigned | Yes |
| **Suspended** | Temporarily blocked by this tenant's admin. Access grant retained, dormant. | Released — billing stops | No |
| **Ended** | Removed. Retained for the reinstatement window so the person appears in "previous members" and can be restored with role intact. | Released | No |

A membership can exist without a seat. Seat is a **billing allocation**; membership is an **access grant**. They are linked but not the same lifecycle, which is what makes Suspended and Ended cheap.

### 9.2 Account states

This folds both of today's tombstones (legacy orphan, admin soft-deleted) into one — Retired.

| State | Rule — what it means | Encoding | Auth | Holds email slot | Admin visibility |
| --- | --- | --- | --- | --- | --- |
| **Active** | Live account belonging to ≥1 tenant. The ordinary state. Says nothing about who the person works for. | `IsActive=true`, `DeletedOn=null`, `AnonymizedOn=null`, ≥1 live membership | Yes | Yes | Everywhere |
| **Detached** | Live, **self-owned** account belonging to no tenant. The contractor between engagements. A legitimate *permanent* condition — not an error, not something to sweep, not something to paper over with a throwaway workspace. | `IsActive=true`, `DeletedOn=null`, `TenantId=null`, zero live memberships | Yes, token has no `tenant_id` | Yes | Global admin, badged "no workspace". Invisible to tenant admins — correct, they belong to no tenant. |
| **Suspended** | Administratively blocked by **Xorbix**, pending a human decision. Rare. Identity fully intact, keeps its address *and its memberships*. No automatic process may ever clear it. **A tenant admin blocking someone in their own tenant is membership-Suspended (§9.1), not this.** | `IsActive=false`, `DeletedOn=null` | No | **Yes, deliberately** — nobody may take the address while the account is under sanction | Visible everywhere, badged. Never hidden. |
| **Retired** | The identity has been **closed** — by the account holder deleting their own account, or by Xorbix. **Not reachable by a tenant admin.** Cannot authenticate on any path, no longer holds the address, row kept intact so a mistake can be undone and history still resolves by Id. The real address stays on the row. | `IsActive=false`, `DeletedOn` + `DeletedBy` set, `TenantId=null`, all memberships ended, `RetirementReason` set | No, by two independent mechanisms | **No — released immediately** | Explicit "Removed & deleted" filter for global admins. Tenant admins see the *ended membership* in "previous members", never the account. |
| **Anonymized** | Permanent tombstone. The person is gone; the events they caused inside customer tenants are not. Identifying fields irreversibly replaced; the row survives only to keep audit FKs intact. | `AnonymizedOn` set; identity fields → `anonymized-{userId}@invalid` | No | No | Hidden; reachable by Id from audit drill-down only |
| **Locked** *(overlay, not a lifecycle state)* | A credential-level rate limit layered **on top of** whatever lifecycle state the row is in. Kept separate deliberately — conflating it is what produced today's dead end where an inactive account can be neither locked nor unlocked. | `LockoutEnd` / `AccessFailedCount` | Blocks on top of the lifecycle state | Unchanged | Badge *alongside*, never instead of, the lifecycle state |

**Detached is the encoding PR 982 already produces** (`SeatManagementService.cs:1138-1145`). This model does not change it — it *names* it and gives it real UI instead of silently minting a Stripe-less tenant.

### 9.3 Invariants — testable assertions, not prose

PR 982 widened three auth gates because nothing asserted they should stay narrow. Ship these as named regression tests.

1. Exactly one row with `DeletedOn IS NULL` may hold a given `NormalizedUserName`. Enforced by the **partial unique index**, not by application code.
2. A row with `DeletedOn` set can **never** authenticate, on any path, by any factor.
3. `FindByEmailAsync`/`FindByNameAsync` never return a row with `DeletedOn` set. `FindByIdAsync` always does.
4. **No code path other than an explicit, authenticated Restore may clear `DeletedOn`.** Not sign-in, not invite acceptance, not token refresh.
5. A user may hold at most one live membership per tenant, and re-inviting a removed user **inserts a new row rather than failing**.
6. Removal from one tenant leaves account state **completely unchanged**, whether or not any live membership remains elsewhere. If it was the last membership the account becomes Detached by virtue of holding no memberships — no field on the user row is written. No cross-tenant cascade, in any direction.
7. Every transition into Retired/Suspended/Anonymized, and every membership end or suspension, writes an audit row naming the acting human, **in the same transaction**. No webhook may produce any of them.
8. Registering an address no live row holds always creates a **new `ApplicationUser` with a new Id**. A prior Retired or Anonymized row bearing that address is never reused or re-linked.
9. Membership removal revokes unconditionally: membership, seat, refresh tokens and security stamp **scoped to that tenant**, and every `DatabricksUserToken` for that tenant's workspace connections.
10. **No tenant-scoped endpoint may write an account-level field.** A tenant admin cannot change another user's email, authentication factors, profile, or `IsActive`/`DeletedOn`, in any tenant, under any role.
11. **Accepting an invite never grants the inviting tenant authority over the account.** Invite acceptance creates a membership and nothing else.

---

## 10. Who may administer an account

### 10.1 What is broken today

`UserController.EnforceTenantScopeAsync` ([UserController.cs:49-76](../Xorbix-Visual-Databricks-App-Builder.Server/Controllers/UserController.cs)) gates account-level operations on `user.TenantId == the caller's tenant`, and 15 of its 17 call sites pass `requireOwnership: true`. Guests get:

> *"This user is a guest of your tenant; only their tenant role and membership can be changed here."*

The shape is right. The field it keys on is not — because `TenantId` is **assigned by invite race order**. `TenantInviteService.EnsureDefaultTenantAsync:811-835`:

```csharp
// Unset or stale home tenant (e.g. removed from previous tenant) — adopt the inviting tenant.
user.TenantId = tenantId;
```

So today: a contractor who self-registers first administers themselves; the same contractor invited first is administered by whoever invited them — including the power to change their email address. A user removed from a tenant has a stale pointer and is **adopted by the next tenant that invites them**. Nobody chose this; it falls out of the pointer doing double duty.

Under `PasswordlessOnly=true` this is not a tidiness problem. **An admin who can rewrite a user's email redirects the 6-digit login code to themselves** — account takeover with extra steps.

### 10.2 What the industry does

Researched against GitHub, Atlassian, Notion, Figma, Vercel and Slack (August 2026, vendor documentation):

- **The standard gate for account administration is DNS domain verification**, usually plus SAML+SCIM, and where granted it is a structurally separate account class — never a flag on a normal account. Atlassian: *"verify the email domain to prove you own it and claim the account"*; without it, *"you can't update their account details or delete their account completely."* Vercel and GitHub both require verified domain **and** SAML **and** active SCIM before any managed-user capability exists.
- **No researched product lets the inviting admin declare the classification.** Figma states it outright: *"It's not possible to make a guest into a member."* It is derived from domain or IdP, or it does not exist.
- **GitHub ships domain verification and deliberately withholds account control from it.** Verified domains buy a profile badge and notification restrictions; owners *"cannot see the email address or which user account is associated with an email address from an approved domain."* No-tenant-ownership is a shipped, coherent position — not a gap.
- **The invite is a claim ticket, not an account-creation event.** A GitHub invite can only be redeemed by someone whose verified email matches on their **own** account; with no account they are prompted to sign up themselves, and the invite expires in 7 days. Creating an account on someone's behalf is a *platform-operator* power — GitHub Enterprise Server assigns it explicitly to a site administrator.

That last point resolves the objection that killed the "declare Member or Guest at invite time" proposal. If a company invites a contractor who has no account, the company does not create one — it creates a **pending membership offer**. The contractor creates their own account. Neither *"we made an account we can't manage"* nor *"we own an external person's identity"* arises.

**Team decision (2026-08-13): domain verification is an `Enterprise`-tier feature, not `Team`.** The research supports this directly — every product that grants account administration gates it behind DNS proof *and* prices it at the top tier: Atlassian managed accounts require an organization with a verified domain, Notion managed users require Enterprise plus a verified domain, and Vercel and GitHub both additionally require SAML and active SCIM. Nobody ships it to a self-serve team plan.

This turns §10's constraint into a roadmap position rather than a permanent limitation:

| Tier | Identity administration | Rationale |
| --- | --- | --- |
| `Trial`, `Individual`, `Team` | **None.** Membership only, per rule 1. | These customers typically run no mail domain they can prove and no IdP. The capability would be unverifiable even if offered. |
| `Enterprise` (future) | Domain verification → optionally SAML/SCIM → a separate managed-account class | The customers who ask for it are the ones who can prove the domain, and it is the natural anchor feature for the tier. |

Two constraints to carry into that work, both from the research: **an admin may only move a user's email to a domain the organization also owns**, and **only one organization may auto-claim a given domain**. Both are load-bearing and easy to miss. Note also that this is the path that would eventually answer §13 item 1 (corporate email reuse) properly — a verified-domain owner has a legitimate claim to retire an address on their own domain, which no unverified tenant does.

### 10.3 What Position A trades away — state this to the team

Adopting rule 1 means **a departing employee keeps their VDAB account.** That is the same end state PR 982 produces, and §1 Position A objected to it. The difference is everything around it:

| | PR 982 | This model |
| --- | --- | --- |
| Account survives removal | Yes, silently | Yes, as a **named, documented** state (Detached) |
| How it got there | Auto-resurrected from soft-deleted at sign-in, clearing `DeletedOn`/`DeletedBy` | Never deleted in the first place |
| Tenant provisioning | Auto-minted on any token issuance, including refresh | Explicit user action from a real "no workspace" screen |
| Anonymous auth surface | Three gates widened | Gates stay narrow (invariant 2) |
| Record of removal | None — `DeletedBy` nulled, no audit call | Ended membership + audit row naming the actor |

**The residual case Position A was really about**: corporate email reuse. VDAB's identity *is* the email address, unlike GitHub where it is a username. If Acme offboards `alice@acme.com` and later issues that address to a new hire, inviting her would land the new person in the **old** Alice's account. Neither GitHub nor the domain-verification products face this, because their identity is not the mailbox. This needs its own answer — see §13.

### 10.4 The two-tier instinct was right, on the other axis

Every researched product has a second tier — GitHub member vs outside collaborator, EMU guest collaborators, Slack single- vs multi-channel guests, Atlassian and Linear guests. Keep it, on the axis a tenant admin legitimately owns: **access reach** — which apps and workspaces a member can touch — as a convertible field on `UserTenantMembership`. GitHub converts in both directions and retains privileges for three months.

What is deleted is only the *identity-ownership* reading of that tier. Whether access-reach is worth building now is a product call, not a research finding; GitHub took three years to add it inside EMU.

---

## 11. Target removal flow

Removal is a **pure membership operation**. There is no account decision, no removal mode, and no classification step — which deletes most of the machinery earlier drafts of this document were trying to manage.

1. **Guards.** Existing tenant-owner protection stands.
2. **End the membership** inside the existing ambient transaction — now writing `DeletedBy`, which `UserTenantMembershipRepository.RemoveAsync` never records today. Set state **Ended** and start the reinstatement window. Free the seat via `ClearSeatAssignment` (keep PR 982's nav-property nulling and its `PendingCancellation` branch).
3. **Update the default-tenant pointer.** Another live membership remains → move `IsDefault` to the earliest-joined. Otherwise clear it. **Do not write `ApplicationUser.TenantId`** — it loses its authority meaning in Phase 4, and its routing meaning is already carried by `IsDefault` and `LastAccessedAt`.
4. **Never touch the user row.** No `IsActive`, no `DeletedOn`, no email, no profile. If this was their last membership the account is **Detached** — a supported resting state, not an error to correct.
5. **Write the audit row in the same transaction** via `IAuditLogService` — `EntityId` = the *removed* user's id, plus prior role, seat id, and revocation counts. This is new work: beyond §3.3's missing audit call, the seat endpoint has no `[AuditLog]` attribute, and `TenantController`'s `[AuditLog("Remove","tenant-membership")]` writes `EntityId = null` because `AuditLogActionFilter` reads a route value named `id` while the route parameter is `{userId:guid}`. **Who removed whom is not recorded today.**
6. **After commit, revoke tenant-scoped access.** Revoke refresh tokens and rotate the security stamp for this tenant, and revoke `DatabricksUserToken` rows for this tenant's workspace connections.

The structural correction from earlier drafts still applies, for a different reason. `HandleRemovedUserOwnershipAsync` returns early on `user.TenantId != tenantId` (`SeatManagementService.cs:1113`) and `shouldRevokeSessions` is gated the same way at `:1084` — so today **revocation skips guests entirely**, and a contractor removed from a tenant keeps a valid JWT bearing that `tenant_id` for its remaining lifetime. That guard must go regardless of everything else in this document.

**UI contract: the admin confirms a consequence, never answers an abstract question.**

> *"Remove Bob Reyes from Acme? He loses access to this workspace immediately and his seat is released. His VDAB account and any other organizations are unaffected. You can restore his membership for 90 days."*
>
> *(The window is configurable, defaulting to 90 days — §13 item 3. The copy must render the configured value, not a literal.)*

The same sentence serves everyone — there is no longer a corporate/contractor branch for an admin to get wrong.

### 11.1 Re-adding someone, and corporate email reuse

**Decided 2026-08-13.** This is the answer to §13 item 1, and it is the inverse of the removal flow above.

**Principle: separate histories by default.** Continuing a person's history is the deliberate act; starting fresh is the default. The signal is not domain and not the admin's judgement — it is **whether that email was previously a member of *this* tenant.** That is deterministic, already in the data, and cannot be spoofed.

When a tenant admin invites `x@domain`:

| Existing account | Prior member of *this* tenant | Behavior |
| --- | --- | --- |
| None | — | Normal invite. Claim ticket only — the person creates their own account (§10.2). |
| Live membership **here** | — | Rejected: already a member. |
| Live membership **elsewhere** | No | **Normal invite.** The existing account joins as a new member. Ordinary multi-tenancy. |
| **Detached** | **No** | **Normal invite.** Existing account joins. No prompt: there is no shared history to separate, and this tenant has no claim that would justify touching the account. |
| **Detached** | **Yes** | **Prompt** — see below. This is the corporate-reuse case. |

**The prompt**, shown only on the last row:

> *"`alice@acme.com` belonged to Alice Chen, removed from Acme on 12 May 2026.*
> *○ Re-add Alice — restores her membership and her history here.*
> *○ This is a different person — creates a separate account. Alice's history stays with her old account and is not carried over."*

Defaulting to **"different person"** is the whole point: reusing an address for a new hire is the common case, and quietly inheriting a predecessor's history is the failure worth preventing.

**Mechanics.** "Re-add" restores the ended membership — same `ApplicationUser.Id`, role and history intact. "Different person" **retires the old account**, which releases the address (§7.1), then issues a normal invite; the new person creates a new account with a **new Id** and no link to the old row (invariant 8).

**Secondary guard — the residual case.** Prior-membership does not protect an external contractor who *was* a member here. `bob@contractor.io` worked for Acme, was removed, is Detached, and still controls his own mailbox — he lands on the last row, and "different person" would destroy an account Acme has no claim to. Guard it with `ApplicationUser.LastLoginAt`:

- Detached, prior member here, **no sign-in since removal** → the destructive option is available. Under passwordless the mailbox *is* the credential, so someone who lost the address with the job cannot sign in; the account is already inert and retiring it costs nothing they still hold.
- Detached, prior member here, **has signed in since removal** → they demonstrably still control the address. Offer re-add only, with *"if this is a different person, contact support."*

That is the same signal domain verification supplies — who controls the address — inferred from behavior rather than DNS, and it fails safe: the worst outcome is a support ticket, not a destroyed account.

**Known tradeoff — accepted deliberately.** "Different person" retires the user row, and history keys on `ApplicationUser.Id`. So the effect is **not scoped to the tenant that made the decision** — it separates that person's history from *every* tenant they ever belonged to.

This is reachable despite the Detached gate, because Detached means no **live** memberships; *ended* memberships elsewhere are still possible. Bob worked for Acme and Globex, both removed him, and he is now Detached with two ended memberships. If Acme reuses his address, Globex loses continuity it was never consulted about:

- `AuditLog` rows carry their own `TenantId`, so Globex's audit **rows** survive — but their `UserId` now resolves to a retired, eventually anonymized account. Globex's trail reads *"anonymized user"* where it used to read Bob.
- Globex's "previous members" entry points at a retired account.
- `UserPlatformAiUsage` — the aggregate that governs quota — has no `TenantId` at all, so per-tenant consumption cannot be preserved. See §15, which tracks this separately.

**We are accepting this because single-tenant membership is the dominant scenario** — the multi-tenant-with-all-memberships-ended case is rare, and the alternative is expensive. The principled fix is to key per-tenant history to the **membership** rather than the user, so each tenant's record of a person survives independently of the account row. That is a much larger change — it touches every user-keyed table above plus every read path that joins on `UserId` — and is out of scope here. If it is ever revisited, note that `AuditLog` already carries `HistoricalEntityId`, suggesting the problem was anticipated somewhere.

*A cheaper partial mitigation, if the team wants one without re-keying anything: check for ended memberships in other tenants at prompt time and either warn the admin or withhold the destructive option. It narrows the blast radius without changing the data model.*

**Two notes for implementation.** The prompt reveals whether an arbitrary address has a VDAB account, so a tenant admin can enumerate. GitHub exposes the same thing on invite and it is defensible, but decide it deliberately. And this flow depends on **Phase 1** (re-add hits the `23505` from §6 item 1 without the partial index) and **Phase 3** (the "removed members" list is where re-add is initiated).

---

## 12. Migration path

Ordered and incrementally shippable. Each phase leaves the system coherent.

### Phase 0 — Pre-flight *(no code; hard gate on everything below)*

Run the §8 queries against dev/stg/prd and record the results. Per §8 the population is already known to be small with no active external users, so this is confirmation rather than discovery — but **(c)** and **(d)** remain written abort criteria, with the re-scoping consequence stated in §8.

Scaffold Migration A locally against a throwaway Postgres and read the emitted `Up()` — confirm Npgsql *replaces* rather than duplicates Identity's `UserNameIndex`. Write the DI test for store resolution. Confirm with the team lead that migrations may be generated against shared dev, per `AGENTS.md`.

> Skipping Phase 0 is the highest risk in this plan: merging to `develop` auto-runs the EF bundle against shared dev, so an aborting migration fails the dev deploy for the whole team.

### Phase 1 — Release the slot and make re-invite work *(pure bugfix; removal behavior unchanged)*

Partial unique index on `UserNameIndex` and on `UserTenantMemberships(UserId, TenantId)`. Add `TombstoneAwareUserStore`. Add `23505` → `ConflictError`. Write `DeletedBy` on membership removal.

**Merges before the stakeholder argument is settled** — it changes no removal semantics, and it independently fixes the re-invite failure in §6 item 1.

### Phase 2 — Collapse the tombstones and delete the rescue machinery

*Per §8 there is no legacy population: no data migration, nothing to un-mangle or reclassify.*

Add `RetirementReason` + `AnonymizedOn`. **Delete** — do not migrate — the widened auth gates (`AuthService.cs:275`, `VerificationChallengeService.cs:123` and `:248`), `AccountReactivationService.ReactivateLegacyOrphanedUserAsync`, and the divergent duplicate at `TenantInviteService.cs:842-849`. Replace all four divergent predicates with one shared `IAccountAccessPolicy` also consumed by `AccessTokenSessionValidator.cs:98` — *four hand-rolled predicates is the actual defect generator (§3.2, §5.1; the visible symptom is §3.5).* Delete the `||DELETED||` mangling in `UserService.cs:707-726`.

Deleting the four untyped `Result.Fail` calls on the anonymous auth path (§5.1) comes free with this.

### Phase 3 — Recovery UI

Fix `ReactivateUserAsync` to clear `DeletedOn`/`DeletedBy` (the collision check comes free — `UpdateAsync` runs the default validator against the tombstone-blind store; map the `IdentityResult` to a typed `ConflictError`). Add the "Removed & deleted" admin filter with Restore, and a tenant-level "Removed members" list with "Restore & re-invite" — *today the person who made the mistake cannot even see whom they removed.*

Also fix the registration dead-end: `SendDuplicateRegistrationNotificationAsync` emails a **password**-reset link that cannot be used at all while `PasswordlessOnly=true`. Keep the anti-enumeration fake success; change the link to a passwordless sign-in link.

> Required before external users exist, but per §8 no longer a gate on Phase 2.

### Phase 4 — Separate account administration from membership administration

The largest phase, and the one that implements §10. Three parts:

**Remove tenant authority over accounts.** Delete the `requireOwnership` parameter and lines 65-73 of `EnforceTenantScopeAsync` (including the guest `ForbiddenError` at `:72`); the membership check at `:61-63` becomes the whole rule. Then re-sort the 17 call sites into three buckets rather than leaving them all tenant-admin-callable:

| Bucket | Endpoints | New rule |
| --- | --- | --- |
| **Self-service or Xorbix only** | email change, 2FA enable/disable, password reset, settings, update-user, resend-confirmation, soft-delete, purge | `callerId == targetUserId` or global Administrator. Arguably belongs on a `/me`-scoped controller. |
| **Membership-scoped, tenant admin keeps** | roles, session list/revoke, seat and membership operations | Unchanged authority, but session revocation becomes tenant-scoped rather than global. |
| **Re-specify** | lock, unlock, reactivate | Become membership suspension/resume on `UserTenantMembership`; identity-level lock stays Xorbix-only. |

The practical loss is small: **name is the only user attribute tenant admins actually manage today.** Password reset remains fully supported as self-service, and as a Xorbix operation, whenever passwords are re-enabled.

**Retire `ApplicationUser.TenantId` as an authority field.** Its routing meaning is already duplicated by `IsDefault`/`LastAccessedAt`, so this is mostly deletion. Every write site becomes a no-op or an `IsDefault` update: `TenantInviteService.EnsureDefaultTenantAsync:811` (the "adopt the inviting tenant" line — the root cause in §10.1), `SeatManagementService.cs:1134` and `:1142` (ownership transfer and clear-on-last-removal disappear entirely), `UserProvisioningService.cs:101`, and `AccountReactivationService.cs:126/152/210`.

**Make removal membership-only** per §11: add the `UserTenantMembership` status field (Active / Suspended / Ended) that §9.1 and §11 step 2 require, add the account-lifecycle config POCO holding both windows (§13 item 3, default 90 days), drop **both** guest carve-outs on revocation (the `shouldRevokeSessions` gate at `:1084` and the early return at `:1113`), revoke Databricks tokens, write the real audit row, and fix the contradictory UI copy and XML docs.

> This phase turns PR 982's rewritten tests red by design, and per §8 gets materially more expensive once real tenants exist — so do it now. `.documentation/qa_subscription_and_account_management_test_cases.md` case **RBAC-14** encodes the old rule verbatim and must be rewritten; controller tests asserting the guest `ForbiddenError` must assert self-service-only instead.

### Phase 5 — Defense in depth, and pin the invariants

- **Lazy anonymization** triggered by a registration attempt resolving a stale Retired row. **No background worker** — this solution has zero `IHostedService`/`BackgroundService`/Hangfire/Quartz outside `MigrationService`, and a sweeper on multi-instance App Service with no leader election would run N times concurrently.
- **Move `EnsurePersonalTenantForLoginAsync` off the shared token path** — better, replace it with an explicit "you are not a member of any workspace" screen so Detached is a supported state.
- **Ship the §9.3 invariants as named tests.**
- **Write ADR-0001** — `.documentation/adr/` does not yet exist, and `AGENTS.md` requires one for a change of this scope.

---

## 13. Decisions the team needs to make

Product calls, not engineering unknowns. Status as of **2026-08-13** — five decided, two pending Tom.

| # | Decision | Status |
| --- | --- | --- |
| 1 | Corporate email reuse | **Decided** — §11.1 |
| 2 | Recovery when a user loses mailbox access | **Proposed, pending Tom** |
| 3 | Reinstatement window length | **Decided** — configurable, 90-day default |
| 4 | What subscription cancellation means for members | **Pending Tom** |
| 5 | AI quota per person or per tenant | **Decided** — per tenant |
| 6 | Notify a removed user | **Decided** — no |
| 7 | Build the access-reach tier now | **Decided** — later |

**1. Corporate email reuse — decided, see §11.1.** Resolved by *separate histories by default*: the invite prompts only when that address was previously a member of **this** tenant, and defaults to creating a separate account. `LastLoginAt` guards the external contractor who still controls the address. Nothing in the research covered this — GitHub's identity is a handle, not a mailbox — so the mechanism is VDAB-specific. Longer term the `Enterprise` domain-verification track (§10.2) supersedes it.

**2. Mailbox loss — proposed, pending Tom.** *If a user loses access to their mailbox, there is nothing we can do for them.* Under `PasswordlessOnly=true` the mailbox **is** the identity; with no second factor there is no way to verify the person, so there is nothing to recover *to*. This is a direct and accepted consequence of passwordless-only, not a gap in the model — but it should be confirmed rather than assumed.

Two things change it, neither in scope here:

- **A second factor enrolled *before* access is lost.** Tracked as follow-on work in §16. Verification has to exist ahead of the loss; nothing can be established afterward.
- **`Enterprise` verified domains (§10.2).** A tenant that has proven it owns the domain can vouch for its own users, which is exactly the account-administration capability that tier unlocks.

**3. Reinstatement window — decided.** **Configurable via `appsettings`, defaulting to 90 days.** Add a config POCO alongside the existing `IOptions<T>` classes, following whatever the current convention is at implementation time — they sit in `.ServiceDefaults/Config/` today, and a separate cleanup task is moving constants and models into the contracts project. Section name must match the POCO type name.

Hold **both** lifecycle clocks in one POCO, since they are related and neither belongs in code:

| Setting | Default | Controls |
| --- | --- | --- |
| Membership reinstatement | **90 days** | How long an Ended membership can be restored with role and seat history intact (§11 step 2, §11.1) |
| Retired → Anonymized | *unset* | How long a closed account keeps its real address before lazy anonymization (§12 Phase 5). Does **not** delay the email being freed, which is immediate. |

**4. Subscription cancellation — pending Tom.** The choice is a partial refund on cancellation, or disabling auto-renewal and running to term end. **Leaning toward the latter**, driven by the Stripe webhook to ensure access ends correctly at term. The research supports that lean: GitHub's downgrades and cancellations take effect only at the end of the billing cycle, with no proration and no refund.

Note this defers rather than removes the harder question. Today `StripeWebhookService` cancels every seat and sets `MaxUsers=0` but never touches a membership, and nothing gates access on `canceled` — so members can still sign in. Running to term end means the question *"which members keep access at zero seats?"* has to be answered **at** term end. GitHub avoids it entirely with an unlimited-people free floor; VDAB has no floor.

**5. AI quota — decided: one per tenant.** Consumption is attributed to the tenant it happened in, not pooled per person. This settles the one product question inside §15; the remaining work there is engineering.

**6. Notify a removed user — decided: no.** This matches every platform researched. GitHub does not notify on removal from an organization; Slack does not by default — the person finds out when they next try to load the workspace; Atlassian's docs describe removal purely as an admin operation. The pattern across all of them is **notify on grant, silent on revoke**.

Two reasons it is right here specifically. Offboarding is the employer's news to deliver, and a platform email arriving before the HR conversation is at best awkward. And on the one destructive path — §11.1's "different person" — the notice would go to an address that is either dead or about to belong to someone else, so the new holder of `alice@acme.com` would receive *"your account has been closed"* about their predecessor.

**7. Access-reach tier — decided: later.** Nothing to do now. §10.4 records the design so it is not re-derived. It is cleanly additive and blocks nothing in §12, but it is the most expensive item relative to certainty of need: every tenant-scoped read path (`AppRepository`, `DatabricksConnectionRepository`, and everything joining on `TenantId`) would need to check the reach grant as well. Revisit when a named customer asks for scoped contractor access.

---

## 14. Known gaps in this recommendation

- **Not validated by execution.** Every claim is static reading of the pre- and post-PR trees. No migration was scaffolded and no test suite was run. Phase 0 exists to close this.
- **Two framework behaviors are assumed and gated in Phase 0:** that Npgsql cleanly replaces Identity's `UserNameIndex` when redeclared with a matching `HasDatabaseName` + `.HasFilter`, and that `.AddUserStore<>()` appended after `.AddEntityFrameworkStores<>()` actually wins DI resolution. A silent no-op on the latter would leave every downstream claim in §7.2 false. §8 retired the population question; these two remain the plan's largest unknowns.
- **The `UserName == Email` invariant is verified in code, not in data** — code-level reasoning does not cover manual DB edits or historical drift. Query **(d)** in §8 settles it.
- **The `23505` re-invite failure (§6 item 1) is inferred from schema plus code path, not observed.** Worth a five-minute manual test.
- **Lazy anonymization is defense-in-depth, not a retention guarantee.** A Retired row nobody ever touches stays un-anonymized indefinitely. If a DPA or SOC 2 commitment later promises a deletion window, that promise — not this design — forces scheduled infrastructure this codebase does not have.
- **No bulk-undo** for a botched deprovisioning run; fifty mistakes are fifty restores.
- **Phase 2/4 test breakage is not fully enumerated** against the current tree beyond the files named in §5.1 and RBAC-14.
- **The §8 finding is a point-in-time fact.** The re-scoping above holds only while there are no active external users. If that changes before the work lands, the original sequencing — recovery UI as a hard gate ahead of deleting the rescue paths — comes back.
- **§10's central research claim rests on negative-space evidence.** That no GitHub org owner can reach a member's password, email, or 2FA is established by the *absence* of any such surface across many documentation pages, not by a single asserting sentence. The absence is broad and consistent, and EMU existing as a separate product corroborates it — but it is not a quotable guarantee.
- **The research covers six developer- and knowledge-worker-facing products.** Smaller B2B SaaS aimed at non-technical SMBs — where no customer runs a mail domain or an IdP — may have a different de facto norm. No counter-evidence was found; that segment was also not searched.
- **Nobody has checked whether any tenant currently uses the admin email-change or 2FA endpoints.** Removing a shipped capability is far cheaper if the answer is no, and §12 Phase 4 assumes it is.
- **Vendor documentation describes intended behavior, not necessarily what support staff will do.** Whether Atlassian or Notion will act on an unmanaged account at a paying customer's request is not something documentation can settle.

---

## 15. Follow-up: platform AI usage is not tenant-scoped

**Surfaced by this review; handled as its own work item.** It has no dependency on the user-state work in either direction, and nothing in §12 should wait on it.

**The defect.** `UserPlatformAiUsage` — the aggregate that governs quota — is uniquely keyed `(UserId, PeriodKey)` with **no `TenantId` column** (`ApplicationDbContext.cs:222-234`). One consumption pool per person per period, collapsed across every tenant they belong to.

`UserPlatformAiUsageEvent`, the raw event stream, **does** carry a `Guid? TenantId` alongside `AppId`. So attribution exists at the event level and is lost in the rollup.

**Three distinct problems, only one of which is a product question:**

1. **Quota correctness.** A person in two tenants draws both tenants' AI consumption from one budget. A contractor burning tokens at Acme reduces what they have at Globex, and neither tenant can see why. Whose quota is it — the person's or the tenant's? *This is the billing call in §13 item 5.*
2. **Cross-tenant attribution.** This is the one concrete instance in the schema of a person's activity in tenant A being visible in tenant B's accounting (§4.3). Every other user-scoped read path is tenant-filtered.
3. **Unrecoverable history on account retirement.** With no tenant key, per-tenant usage cannot be preserved when an account is retired or anonymized (§11.1). Note also that the `User` FK is configured `OnDelete(DeleteBehavior.Cascade)`, so a hard purge removes these rows outright.

**The fix is tractable, and that is worth knowing before scheduling it.** Add `TenantId` to `UserPlatformAiUsage` and re-key the unique index to `(UserId, TenantId, PeriodKey)`. Because the event table already carries `TenantId`, the aggregate can likely be **rebuilt per tenant from events** rather than guessed at — subject to two checks nobody has run:

- how consistently `TenantId` is actually populated on events, given it is nullable; and
- whether event retention covers every period that has an aggregate row.

Where events are missing or unattributed, the fallback is to attribute the remainder to the user's tenant at the time — ambiguous exactly for the multi-tenant users the fix is for, so those rows may have to be written off.

**Sequencing:** the quota question is answered — **one pool per tenant** (§13 item 5). The remaining work is the schema change, the backfill, and the read paths that join on `UserId`.

---

## 16. Follow-up: second factor for platform recovery

**Surfaced by §13 item 2; tracked separately at tenant level.** Not tied to the user-state work — nothing in §12 depends on it, and it does not depend on §12.

**Why.** With `PasswordlessOnly=true` the mailbox is the only identity factor, so a user who loses mailbox access cannot be recovered — there is no second thing to verify them against. The only fix is a factor enrolled **before** the loss; nothing can be established afterward.

**The infrastructure is already present but unused.** `Program.cs:428` calls `AddDefaultTokenProviders()`, which registers Identity's `AuthenticatorTokenProvider`. A repo-wide search finds no reference to `GetAuthenticatorKeyAsync`, `GenerateNewTwoFactorRecoveryCodesAsync`, `WebAuthn`, or passkeys — so nothing is wired, but nothing needs to be built from scratch either:

| Factor | What it takes | Notes |
| --- | --- | --- |
| **TOTP** (authenticator app) | `GetAuthenticatorKeyAsync` → QR → `VerifyTwoFactorTokenAsync` | Framework-provided. Smallest useful step. |
| **Recovery codes** | `GenerateNewTwoFactorRecoveryCodesAsync` | Framework-provided. Cheapest insurance; works with no device. |
| **Passkey / WebAuthn** | New dependency, requires approval per `AGENTS.md` | Strongest, largest scope. Not the starting point. |

**Product shape.** Prompt after signup to add a recovery method, rather than blocking on it — this is insurance, and forcing it at signup costs conversion. Surface enrollment coverage at tenant level so an admin can see who on their team is unprotected.

**Note the interaction with §10.** Enrollment is an **account** operation, so a tenant admin can see coverage and prompt, but never enrol or reset a factor on someone's behalf. That is the same boundary as everything else in §10, and it is why the tenant-level view is reporting rather than administration.

Until this ships, §13 item 2 stands: mailbox loss is unrecoverable.
