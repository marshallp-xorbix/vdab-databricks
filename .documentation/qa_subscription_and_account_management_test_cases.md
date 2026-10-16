# QA Test Cases — Signup, Subscription, Account / Tenant / User Management

Manual QA test cases covering the end-to-end **signup**, **subscription/billing**, **seat & team
membership**, **self-service account/tenant/user management** (across subscription tiers), and
**global-administrator** workflows for the Xorbix Visual Databricks App Builder (VDAB).

These cases are derived from the current implementation on branch `tim/subscription-workflows`.
Where a test depends on Stripe, run against **Stripe test mode** using
[Stripe test cards](https://docs.stripe.com/testing) and trigger billing-lifecycle events with the
Stripe CLI (`stripe trigger ...`) or the dashboard.

---

## 1. Scope & Reference Data

### 1.1 Subscription tiers

`SubscriptionTier` enum / `SubscriptionTierNames` (`Models/Billing/SubscriptionTier.cs`,
`SubscriptionTierNames.cs`):

| Tier | Self-service checkout | Per-seat | Notes |
| --- | --- | --- | --- |
| `Trial` | n/a | No | Trial is expressed as a **flag/limit set** on a tier, not a standalone self-service plan |
| `Individual` | Yes | No | Minimum 1 seat; seat management endpoints are **forbidden** |
| `Team` | Yes | **Yes** | Has a tier minimum (bundled) seat count; seat management enabled |
| `Enterprise` | **No** (contact sales) | Yes | Excluded from self-service signup/upgrade |

Trial availability, length (`PeriodDays`), trial seats, and trial-period limits are configured per
tier in `ServiceDefaults/Config/SubscriptionTierLimits.cs`. The plan catalog is served publicly from
`GET /api/Billing/plans`.

### 1.2 Roles

| Scope | Role | Capability summary |
| --- | --- | --- |
| Global (Identity) | `Administrator` | Cross-tenant: manage all tenants & all users; bypasses tenant scope |
| Tenant (`UserTenantMembership.Role`) | `Admin` | Full control of own tenant: members, seats, billing, tenant settings |
| Tenant | `Developer` | Regular member: build apps; **no** billing/seat/user/tenant management |

Authorization policies (`ServiceDefaults/AuthenticationExtensions.cs`,
`Constants.cs`): `RequireAdministratorRole` (global), `RequireTenantAdminRole`
(tenant Admin or global Admin), `RequireDeveloperRole` (Developer or higher).

### 1.3 Subscription & seat statuses

- **Tenant `SubscriptionStatus`:** `incomplete`, `trialing`, `active`, `past_due`, `canceled`.
- **Seat `Status`:** `Active`, `PendingCancellation`, `Canceled`.
- **Seat `IsBundled`:** `true` = required/tier-minimum seat (cannot be removed directly);
  `false` = extra/purchased seat.

### 1.4 Key invariants to keep verifying

1. Seat management endpoints return **`403 Forbidden`** with message
   *"Seat management endpoints are only available for Team tier subscriptions."* for non-Team tiers.
2. A trial **requires a saved payment method**; if none exists at trial end Stripe cancels
   (`TrialSettings.EndBehavior.MissingPaymentMethod = "cancel"`).
3. Bundled/required seats cannot be removed directly; extra seats can be removed only when
   **unoccupied**; total can never drop below the **tier minimum**.
4. Billing UI (`Billing & Plan`, `Invoices`) is shown only when the tenant has a Stripe customer
   (`requiresStripeBilling` / `hasStripeCustomer`).
5. Team UI (`Seats & Users`, `Team Activity`) is shown only when `isTeamTier && (Admin || Administrator)`
   (`canManageAccountSeats`).
6. The tenant **owner** can only be removed/deactivated/role-changed/ownership-transferred by the
   owner themselves or a global Administrator.

### 1.5 Test environment prerequisites

- Stripe configured in **test mode**; webhook endpoint reachable (`POST /api/StripeWebhook`) with a
  valid signing secret. See `.documentation/stripe_webhook_setup.md`.
- Email capture available (mailbox or dev email sink) to read confirmation/invite/reset/2FA emails.
- Ability to advance Stripe time / trigger events (`stripe trigger`,
  Stripe test clocks) for trial-end, invoice paid/failed, and period-end scenarios.
- A pre-existing **global Administrator** account for the admin suite.

### 1.6 Suggested test accounts

| Alias | Purpose |
| --- | --- |
| `ind-trial@…` | Individual, trial path |
| `ind-paid@…` | Individual, no-trial path |
| `team-owner@…` | Team owner / tenant Admin |
| `team-dev@…` | Team Developer (member) |
| `team-admin2@…` | Second tenant Admin (role-hierarchy tests) |
| `gadmin@…` | Global Administrator |

---

## 2. Signup & Account Setup (`SU`)

Flow: register → confirm email → set password → **login** → account-setup steps (Subscription →
Payment → Complete) → policy acceptance gate → `/apps`. Setup steps are JWT-guarded; the link only
authenticates set-password.

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SU-01 | Register new user (happy path) | Email not in use | On `/signup` enter first/last name + email, accept ToS + Privacy, submit | `200`; redirected to "account created" screen; confirmation email sent; user created `EmailConfirmed=false`; a tenant `user-{id}` is created with `SubscriptionStatus=incomplete`, owner = user, membership role = tenant `Admin` |
| SU-02 | Register field validation | — | Submit with (a) missing name, (b) malformed email, (c) policies unchecked | Client blocks submit with messages: "First and last name are required", "Enter a valid email address", "You must accept the Terms of Service and Privacy Policy"; no account created |
| SU-03 | Register with already-registered email | Email already exists | Register with existing email | Response is a **generic success** (no account enumeration); no new account; existing user receives a "duplicate registration attempt" notification email |
| SU-04 | Confirm email — valid token | SU-01 done | Open confirmation link / `POST register/confirm-email` | `200`; `EmailConfirmed=true`; response indicates `requiresPasswordSetup=true` with a password-set token; redirected to set-password |
| SU-05 | Confirm email — expired/invalid token | — | Confirm with tampered/expired token | Error "Invalid or expired confirmation token"; account stays unconfirmed |
| SU-06 | Confirm email — already confirmed | Email already confirmed | Re-open the confirmation link | Idempotent success; no error; no state change |
| SU-07 | Resend confirmation | Unconfirmed account | `POST register/resend-confirmation` with email | New confirmation email sent; previous link may be superseded; generic success even for unknown email |
| SU-08 | Set password — valid | Email confirmed, valid token | Enter compliant password (≥8 chars, upper/lower/digit/special) twice | `200`; password set; redirected to **login** (not directly into setup) |
| SU-09 | Set password — weak/mismatch | — | Enter too-short or non-matching password | Rejected with password-policy / mismatch error; password not set |
| SU-10 | Login-first gate to setup | Password set, setup incomplete | Log in | `account-setup-status` returns `isSetupComplete=false`; user is redirected into the setup flow at the correct `currentStep` |
| SU-11 | Setup steps require auth | Not logged in | Navigate directly to `/account/setup/billing` | Redirected to `/login`; setup billing API calls require JWT |
| SU-12 | Account-setup-status drives current step | New user, no subscription/payment | `GET account-setup-status` | `currentStep=choose-subscription` when no subscription; `payment` when subscription exists but no payment method; `isSetupComplete=true` only when subscription + payment present (and policies accepted) |
| SU-13 | Completing setup lands on app | Subscription + payment complete | Finish payment step | Setup status invalidated/refreshed; redirected to `/apps`; subsequent logins skip setup |
| SU-14 | Policy re-acceptance gate | Existing user, policy version bumped | Log in | Redirected to policy acceptance; must accept updated ToS/Privacy before reaching `/apps`; `needsPolicyAcceptance` clears after acceptance |
| SU-15 | Admin-provisioned user setup | Global admin created a user (not self-registered) | Log in as that user | Setup status `isAdmin`/admin-provisioned path requires **only policy acceptance** — no subscription/payment step forced |
| SU-16 | Resume interrupted setup | User chose subscription but left before payment | Log back in | Returns to `currentStep=payment`; previously chosen plan/subscription is reflected; can complete without duplicate subscription |

---

## 3. Subscription Management (`SUB`)

Covers the user-requested cases: signup as Individual/Team with & without trial, Individual→Team
upgrade, cancellation before/after trial, plus the full subscription lifecycle.

### 3.1 Signup tier + trial selection

The plan + trial choice happens on the **Account Setup → Billing** page after login. Trial is
**opt-out** (checkbox defaulted on) for plans that offer one; un-checking it bills immediately.

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SUB-01 | Individual **with** trial | Setup at billing step; Individual offers trial | Select **Individual**, keep "Start with a free N-day trial" checked, enter billing name/email, add test card, click **Start Free Trial** | Card saved; `createSubscription({tier:Individual, startTrial:true})`; Stripe subscription `trialing`; tenant `SubscriptionStatus=trialing`, `TrialEndDate` set ≈ N days out; redirected to `/apps`; button label read "Save Payment Method & Start Free Trial" pre-save |
| SUB-02 | Individual **without** trial | Same | Select Individual, **uncheck** trial, add card, click **Subscribe** | Helper text reads "You'll be billed {price} today and your subscription starts immediately"; subscription created `active`; an invoice is charged immediately; `TrialEndDate` not set |
| SUB-03 | Team **with** trial | Team offers trial | Select **Team**, keep trial on, add card, **Start Free Trial** | Subscription `trialing`; tenant tier `Team`; bundled seats provisioned at the Team minimum; first bundled seat assigned to the owner |
| SUB-04 | Team **without** trial | — | Select Team, uncheck trial, add card, **Subscribe** | Subscription `active`; Team bundled seats created; immediate invoice for the bundled-seat quantity |
| SUB-05 | Trial requires a card | At billing step with trial on, no card entered | Click the subscribe/trial button without completing card | Submission aborts: toast "Payment method required"; **no subscription created**; copy states a payment method is required to start the trial |
| SUB-06 | Plan price + interval display | Plans loaded | Toggle Monthly/Yearly on plan grid | Prices/labels update from `GET /api/Billing/plans` (single source of pricing); trial "billed on" date reflects selected interval price |
| SUB-07 | Plans fail to load | Force `GET /api/Billing/plans` error | Open billing step | Inline alert "We couldn't load plans right now…"; subscribe button disabled until plans load |
| SUB-08 | Enterprise not self-service | — | Inspect plan grid; attempt `POST /api/Billing/subscription {tier:Enterprise}` | Enterprise shows "Contact Sales" (no self checkout); direct API create/upgrade to Enterprise returns **`403 Forbidden`** |

### 3.2 Trial lifecycle

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SUB-09 | `trial_will_end` notification | Trialing subscription | Trigger `customer.subscription.trial_will_end` (≈3 days before end) | `SubscriptionHistory` "TrialEnding" event recorded; trial-ending email sent; no tenant status change |
| SUB-10 | Trial → paid (payment succeeds) | Trialing, valid card | Advance to trial end so Stripe charges the first invoice | `customer.subscription.updated` → status `active`; `invoice.paid` → "Renewed" history with amount/currency; renewal email; access continues |
| SUB-11 | Trial end — payment fails | Trialing, card set to fail | Advance to trial end with a declining test card | `invoice.payment_failed` → tenant `past_due`; "Payment"/Failed history event; payment-failure email; access per past_due policy |
| SUB-12 | Trial end — no payment method | Trialing, payment method removed | Remove the saved card, advance to trial end | Stripe cancels (MissingPaymentMethod=cancel) → `customer.subscription.deleted`; `HandleSubscriptionDeleted` marks all seats `Canceled`, tenant `canceled`, `MaxUsers=0` |

### 3.3 Upgrade / downgrade

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SUB-13 | Preview Individual → Team | Active Individual | `GET /api/Billing/subscription/preview?newTier=Team` | `InvoicePreviewDto` with proration line items and proration date; no change applied yet |
| SUB-14 | Upgrade Individual → Team | Active Individual (1 occupied seat) | `PUT /api/Billing/subscription {tier:Team}` | Stripe item switched to Team price, quantity raised to Team minimum with `create_prorations`; local bundled seats created to reach the minimum; **existing occupant preserved**; tenant tier `Team`, limits/`MaxUsers` updated; proration invoice generated |
| SUB-15 | Upgrade reflects in seat summary | After SUB-14 | `GET /api/Billing/seats/summary` | `totalSeats = Team minimum`, `occupiedSeats=1`, `availableSeats = min-1`, `pendingCancellations=0` |
| SUB-16 | Downgrade Team → Individual | Team with exactly 1 occupied seat | `PUT /api/Billing/subscription {tier:Individual}` | Allowed; quantity reduced to Individual (1); seat minimum enforced for Individual; tier/limits updated |
| SUB-17 | Downgrade blocked by occupancy | Team with >1 occupied seats | Attempt downgrade to Individual | Rejected (cannot drop below occupied/required seats) — capture exact error; user must remove members/seats first |
| SUB-18 | Upgrade to Enterprise blocked | Any self-service tier | `PUT /api/Billing/subscription {tier:Enterprise}` | `403 Forbidden` (Enterprise transitions are admin-only) |

### 3.4 Cancellation & reactivation

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SUB-19 | Cancel Individual **before** trial ends (period-end) | Individual `trialing` | `DELETE /api/Billing/subscription?immediate=false` | Stripe `cancel_at_period_end=true`; seats → `PendingCancellation` with `SeatEndDate`=trial end; access retained until trial end; status still `trialing` until end |
| SUB-20 | Cancel Individual **before** trial ends (immediate) | Individual `trialing` | `DELETE …?immediate=true` | Stripe canceled now; seats `Canceled`; tenant `canceled`, `MaxUsers=0`; access lost immediately; no proration/refund |
| SUB-21 | Cancel Individual **after** trial (period-end) | Individual `active` | `DELETE …?immediate=false` | `cancel_at_period_end=true`; access retained through paid period; at period end webhook finalizes cancellation |
| SUB-22 | Cancel Individual **after** trial (immediate) | Individual `active` | `DELETE …?immediate=true` | Canceled now; no prorated refund; seats `Canceled`; access lost |
| SUB-23 | Cancel Team **before** trial ends | Team `trialing` | `DELETE …?immediate=false` | All seats (bundled + extra) → `PendingCancellation`; access until trial end; reactivation possible before end |
| SUB-24 | Cancel Team **after** trial ends | Team `active` | `DELETE …?immediate=false` then advance to period end | Period-end finalization cancels all seats, sets tenant `canceled`; members lose access |
| SUB-25 | Reactivate scheduled cancellation | Subscription with `cancel_at_period_end=true` | `POST /api/Billing/subscription/reactivate` | `cancel_at_period_end=false`; `PendingCancellation` seats restored to `Active`; access preserved |
| SUB-26 | Reactivate when not scheduled | Subscription not pending cancel | `POST …/reactivate` | Rejected/no-op (precondition: must be scheduled for cancellation) — capture exact behavior |
| SUB-27 | Reactivate after full cancel | Subscription already `canceled` | `POST …/reactivate` | Not allowed; a brand-new subscription is required |

### 3.5 Payment methods, status, history, webhooks

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SUB-28 | Add payment method | Tenant Admin | `POST /api/Billing/setup-intent` → confirm card via Stripe Elements → `GET /api/Billing/payment-methods` | New card listed (brand/last4/expiry); becomes selectable as default |
| SUB-29 | Set default payment method | ≥2 cards saved | `POST /api/Billing/payment-methods/{id}/default` | Selected card marked `isDefault=true`; others false |
| SUB-30 | Remove payment method | ≥1 card | `DELETE /api/Billing/payment-methods/{id}` | Card detached; removing the **default** with an active subscription leaves the next renewal at risk (verify warning/handling) |
| SUB-31 | View billing status | Subscribed tenant | `GET /api/Billing/status` | `BillingStatusDto` with subscription details, seat summary, payment methods, default method id |
| SUB-32 | View current subscription | Subscribed tenant | `GET /api/Billing/subscription` | `SubscriptionDto` (tier, status, period dates, cancelAtPeriodEnd, seat summary, totalSeats) |
| SUB-33 | Manually provisioned tenant (no Stripe) | Admin granted a tier with no Stripe customer | `GET /api/Billing/subscription`; open account UI | A **synthesized** subscription DTO is returned (`hasStripeCustomer=false`); `Billing & Plan` and `Invoices` are **hidden** in the UI |
| SUB-34 | Invoice history (self) | Subscribed tenant with invoices | `GET /api/Billing/invoices?skip=0&take=25` | Paginated invoices (number, amount, currency, status, dates, line items, URLs) |
| SUB-35 | Upcoming invoice preview | Active subscription | `GET /api/Billing/invoices/upcoming` | `InvoicePreviewDto` for the next billing with no changes |
| SUB-36 | Webhook idempotency | Any handled event | Re-deliver the same Stripe event id | Second delivery returns OK without re-processing (found in `StripeEventLog`); no duplicate seat/history side effects |
| SUB-37 | `invoice.paid` finalization | Has `PendingCancellation` seats due this period | Trigger `invoice.paid` | Pending cancellations finalized; "Renewed" history; renewal email |
| SUB-38 | Customer details update | Tenant Admin | `PUT /api/Billing/customer-details {invoiceName, invoiceEmail}` | Stripe customer + tenant invoice fields updated; reflected in next invoice |
| SUB-39 | Billing requires Tenant Admin | Logged in as Developer | Call any `/api/Billing/*` self endpoint | `403 Forbidden` (class-level `RequireTenantAdminRole`) |
| SUB-40 | Billing endpoints require auth | No JWT | Call `/api/Billing/status` | `401 Unauthorized` |

---

## 4. Seat & Team Membership Management (`SEAT` / `INV`)

Team-tier only. Covers user-requested: invite members, add seats before/after trial, cancel extra
seats, attempt to cancel required seats.

### 4.1 Seat model & invites

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SEAT-01 | Team starts with bundled seats | New Team subscription | `GET /api/Billing/seats` and `/seats/summary` | Bundled (`IsBundled=true`) seats equal to tier minimum; first bundled seat auto-assigned to owner; extras = 0 |
| INV-01 | Invite single member (seat available) | Team Admin, ≥1 available seat | `POST /api/Tenant/invites {emails:[one]}` | Invite created `Pending`; email sent; `availableSeats` reported; outcome `Created` |
| INV-02 | Invite batch with overage warning | Emails > available seats | Open Invite dialog, add emails exceeding availability | Amber overage warning shows `overage = max(0, emails - available)`; acknowledgment checkbox required before submit |
| INV-03 | Invite mixed outcomes | Existing member + duplicate + malformed email in one batch | Submit batch | Per-email outcomes: `AlreadyMember`, `AlreadyPending`/duplicate, `Invalid`; valid ones `Created`; response includes `SeatOverageCount`, `AvailableSeats` |
| INV-04 | List pending invites | ≥1 pending invite | `GET /api/Tenant/invites` | Only `Pending` invites returned with email, status, expiry, invitedAt, `RequiresSeatPurchase` |
| INV-05 | Validate invite token (public) | Valid pending invite | `GET /api/Tenant/invites/validate?token=…` | `IsValid=true` with email, tenant display name, expiry, `UserExists` |
| INV-06 | Validate — expired | Invite past `TokenExpiresAt` | Validate | `IsValid=false`, `Reason=Expired` |
| INV-07 | Validate — canceled / accepted | Canceled or accepted invite | Validate | `IsValid=false`, `Reason=Canceled` / `AlreadyAccepted` |
| INV-08 | Accept invite — existing user | Logged-in invitee, available seat | `POST /api/Tenant/invites/accept {token}` | Membership added as **Developer**; first available seat assigned; default tenant set if none; invite → `Accepted` with `ResultingSeatId` |
| INV-09 | Accept invite — new user registration | Anonymous invitee, no account | `POST /api/Tenant/invites/register-and-accept {token, name, password}` | User created + membership + seat assigned **atomically**; invite `Accepted` |
| INV-10 | Accept triggers seat auto-purchase (Team) | Team, **no** available seat, invitee accepts | Accept invite | Stripe quantity increased **before** DB commit; new seat materialized for the invitee; if Stripe fails, admins notified and nothing committed |
| INV-11 | Resend invite | Pending invite | `POST /api/Tenant/invites/{id}/resend` | New token + new expiry; fresh email sent; previous token invalid |
| INV-12 | Cancel/revoke invite | Pending invite | `DELETE /api/Tenant/invites/{id}` | Invite `Canceled` (soft-deleted); token no longer valid |
| INV-13 | Invite acceptance email mismatch | Token issued for email A; logged in as B | Accept while authenticated as B | Rejected (email must match the invite) |
| INV-14 | Non-Team invite overage flagged | (If invites allowed on non-per-seat tier) accept beyond capacity | Accept | Invite flagged `RequiresSeatPurchase=true`; no seat assigned until admin purchases |

### 4.2 Add / remove seats (before & after trial)

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SEAT-02 | Preview seat change | Team | `GET /api/Billing/seats/preview?change=2` | `SeatPreviewDto` with current/new seat counts, prorated amount, currency, effective date |
| SEAT-03 | Purchase extra seats **before** trial ends | Team `trialing` | `POST /api/Billing/seats/purchase {count:2}` | 2 new `Active`, `IsBundled=false` seats; Stripe quantity raised with `create_prorations`; `MaxUsers` increased; response includes seats + proration preview |
| SEAT-04 | Purchase extra seats **after** trial ends | Team `active` | `POST …/seats/purchase {count:2}` | Same as above; proration calculated against the current paid cycle |
| SEAT-05 | Purchase count validation | Team | Purchase with `count<=0` or `count>1000` | Rejected (`count` must be 1..1000) |
| SEAT-06 | Cancel extra (unoccupied) seats | Team with ≥2 unoccupied extra seats | `POST /api/Billing/seats/remove {count:2}` | Two unoccupied extra seats (oldest first) → `PendingCancellation`, `SeatEndDate`=period end; access retained until then |
| SEAT-07 | Cancel more extras than available | Team, only 1 unoccupied extra | `POST …/seats/remove {count:3}` | `400 BadRequest` "Unable to remove 3 extra seats. Only 1 unoccupied extra seats are available." |
| SEAT-08 | Cannot remove occupied extra via bulk remove | Extra seats all occupied | `POST …/seats/remove {count:1}` | Rejected — occupied seats aren't candidates (only unoccupied extras qualify) |
| SEAT-09 | **Attempt to cancel required (bundled) seats** | Team at minimum, try to go below | `GET /api/Billing/seats/preview?change=-N` reducing below minimum, or remove targeting bundled | `400 BadRequest` "Seat count cannot be reduced below tier minimum of {N}." |
| SEAT-10 | Remove bundled seat directly | Team | `POST /api/Billing/seats/{bundledSeatId}/remove-seat` | `400 BadRequest` "Bundled seats cannot be removed directly. Reduce plan minimum to remove bundled seats." |
| SEAT-11 | Period-end cancellation finalize | Seats in `PendingCancellation`, period ends | Advance billing period / `invoice.paid` | Pending seats → `Canceled`, occupant cleared; billable count recomputed; Stripe quantity synced (`prorate=false`); `MaxUsers` updated |
| SEAT-12 | Reactivate restores pending seats | Subscription pending-cancel reactivated | `POST /api/Billing/subscription/reactivate` | `PendingCancellation` seats return to `Active` |

### 4.3 Assign / unassign / transfer / remove

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SEAT-13 | Assign seat to member | Member in tenant, available seat | `POST /api/Billing/seats/{id}/assign {userId}` | Seat occupied (`UserId`, `AssignedAt` set); `SeatDto` returned |
| SEAT-14 | Assign — user not in tenant | Target not a member | Assign | `403 Forbidden` "User does not belong to the tenant" |
| SEAT-15 | Assign — user already seated | Target already has a seat | Assign | `409 Conflict` "User already has an assigned seat in this tenant" |
| SEAT-16 | Assign — no available seats | All seats occupied | Assign | `403 Forbidden` "No available seats. Purchase additional seats…" |
| SEAT-17 | Unassign (keep seat) | Occupied seat | `POST /api/Billing/seats/{id}/unassign?cancelSeat=false` | `UserId`/`AssignedAt` cleared; seat stays `Active` and available |
| SEAT-18 | Unassign + cancel extra seat | Occupied **extra** seat | `POST …/unassign?cancelSeat=true` | Seat → `PendingCancellation`, `SeatEndDate` set |
| SEAT-19 | Unassign + cancel bundled seat | Occupied **bundled** seat | `POST …/unassign?cancelSeat=true` | `403 Forbidden` "Bundled seats cannot be canceled. Unassign only." |
| SEAT-20 | Transfer seat | Occupied seat, target is a member without a seat | `POST /api/Billing/seats/{id}/transfer {newUserId}` | Seat reassigned to new user; `AssignedAt` updated |
| SEAT-21 | Transfer — target already seated | Target has a seat | Transfer | `409 Conflict` "Target user already has an assigned seat…" |
| SEAT-22 | Transfer — seat unoccupied | Seat has no user | Transfer | `400 BadRequest` "Seat is unoccupied. Use assign operation instead." |
| SEAT-23 | Remove user from seat | Occupied seat | `POST /api/Billing/seats/{id}/remove-user` | User unassigned + membership revoked; seat stays `Active`; if removed user's home tenant was this tenant, ownership transfers to earliest remaining tenant, else account soft-deactivated |
| SEAT-24 | Owner-protection on remove-user | Target is the tenant owner; performer is a non-owner Admin | Attempt remove-user on owner | `403 Forbidden` "Only the tenant owner can remove or deactivate the tenant owner." |
| SEAT-25 | Schedule seat removal | Active seat | `POST /api/Billing/seats/{id}/remove-seat` | Seat → `PendingCancellation` at period end; occupant retains access until then |
| SEAT-26 | Seat management forbidden on Individual | Individual tier | Call each: get/summary/purchase/remove/preview/assign/unassign/transfer/remove-user/remove-seat | Every call `403 Forbidden` "Seat management endpoints are only available for Team tier subscriptions." (matches `SeatManagementServiceValidationTests`) |
| SEAT-27 | Seat management forbidden for Developer | Team Developer | Call any `/api/Billing/seats/*` | `403 Forbidden` (`RequireTenantAdminRole`) |
| SEAT-28 | Admin views seats for any tenant | Global Admin | `GET /api/Billing/tenants/{tenantId}/seats` | Returns that tenant's seats; tenant Admin of a different tenant gets `403` |

---

## 5. Account Management — Individual Tier (`ACCT-IND`)

User-requested cases 8–9: billing/payment/invoice/subscription visibility, no team-specific
details, edit profile.

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| ACCT-IND-01 | Account sidebar — Individual | Individual tenant with Stripe customer | Open `/account` | Visible: Account (Dashboard, Profile, Sessions, My Activity), Billing (Billing & Plan, Invoices). **Hidden:** Team section (Seats & Users, Team Activity) |
| ACCT-IND-02 | Billing & Plan page | Individual | Open `/account/billing` | Shows current plan, status, renewal/period dates, payment methods, cancel/upgrade controls |
| ACCT-IND-03 | Payment management | Individual | Add / set-default / remove card from billing page | Reflects SUB-28..30 behavior |
| ACCT-IND-04 | Invoice history page | Individual with invoices | Open `/account/invoices` | Paginated invoices; downloadable/hosted links |
| ACCT-IND-05 | No team details for Individual | Individual | Attempt to navigate to `/account/seats` | Page redirects (not Team tier); no Seats & Users in nav; `/account/team-activity` unavailable |
| ACCT-IND-06 | Edit profile details | Logged-in user | `/account/profile` → change first/last name → save (`PUT /api/User/{self}`) | Name updated; reflected across UI; self-edit allowed regardless of role |
| ACCT-IND-07 | Change password | Logged-in user | Profile → change password (current + new) | Password updated; sessions may be invalidated per policy |
| ACCT-IND-08 | Change email | Logged-in user | Profile → change email (`PUT /api/User/{self}/email`) | Confirmation email sent to new address; email changes only after confirmation |
| ACCT-IND-09 | Sessions management | Logged-in user | `/account/sessions` → view, revoke one, "log out all" | Session list (paginated); individual revoke kills that session; log-out-all invalidates all refresh tokens |
| ACCT-IND-10 | My Activity log | Logged-in user | `/account/activity` | Shows the user's own audit/activity entries |
| ACCT-IND-11 | Billing hidden when no Stripe customer | Individual tier granted manually (no Stripe) | Open `/account` | Billing & Plan and Invoices hidden (`hasStripeCustomer=false`); direct nav to `/account/billing` or `/account/invoices` redirects |

---

## 6. Account Management — Team Tier (`ACCT-TEAM`)

User-requested cases 10–12.

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| ACCT-TEAM-01 | Account sidebar — Team Admin | Team tenant, role Admin (or global Admin) | Open `/account` | All Individual sections **plus** Team section (Seats & Users, Team Activity Log) visible (`canManageAccountSeats = isTeamTier && Admin`) |
| ACCT-TEAM-02 | Team dashboard tiles | Team Admin | Open `/account` dashboard | Shows seat summary tile (total/occupied/available), manage-team and billing quick actions |
| ACCT-TEAM-03 | Edit tenant details | Team Admin | `PUT /api/Tenant/current {displayName, invoiceName, invoiceEmail}` | Tenant details updated; invoice fields propagate to Stripe customer |
| ACCT-TEAM-04 | Team activity log | Team Admin | `/account/team-activity` | Shows activity across team members |
| ACCT-TEAM-05 | Seats & Users management page | Team Admin | `/account/seats` | Seats table (seat + occupant), pending invites grid, actions: invite, remove user, remove seat, make owner — cross-ref SEAT/INV cases |
| ACCT-TEAM-06 | Team Admin sees all Individual-tier features | Team Admin | Open account billing/invoices/profile/sessions | All Individual capabilities present, additive with team features |
| ACCT-TEAM-07 | User management as Team Admin | Team Admin | Manage members within own tenant (view, role change, remove, lock, reset, sessions) | Allowed but **scoped to current tenant** members only (see RBAC suite) |
| ACCT-TEAM-08 | Developer has no account-team access | Team Developer | Open `/account` | Team section hidden; Billing section hidden if developer also blocked — verify only Account section (Dashboard, Profile, Sessions, My Activity) is shown |
| ACCT-TEAM-09 | Developer cannot reach team/billing routes | Team Developer | Navigate directly to `/account/seats`, `/account/billing` | Redirected; backend `/api/Billing/*` and seat endpoints return `403` |

---

## 7. Role-Based Access Within a Team (`RBAC`)

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| RBAC-01 | Tenant Admin full team control | Team Admin | Exercise member + seat + billing + tenant-settings management | All succeed within own tenant |
| RBAC-02 | Developer is read-limited | Team Developer | Attempt `/api/User/*` management, `/api/Tenant` admin endpoints, `/api/Billing/*`, seat endpoints | `403 Forbidden`; can still: list own memberships, switch/set-default tenant, view current tenant, build apps, edit own profile/sessions |
| RBAC-03 | Get member role | Team Admin | `GET /api/Tenant/members/{userId}/role` | Returns user's tenant role |
| RBAC-04 | Change member role within tenant | Team Admin | `PUT /api/Tenant/members/{userId}/role {role:Admin/Developer}` | Allowed; **cannot** assign `Administrator` (global); **cannot** change own role; **cannot** modify a member who outranks; audit logged |
| RBAC-05 | Role escalation guard | Team Admin attempting to grant a role above own level | Attempt | Rejected (cannot assign roles above own level) |
| RBAC-06 | Owner role-change protection | Non-owner Admin tries to change owner's role | `PUT …/members/{ownerId}/role` | Rejected — only owner or global Admin may change owner's role |
| RBAC-07 | Remove member frees seat | Team Admin | `DELETE /api/Tenant/members/{userId}` | Membership revoked, seat freed; cannot remove self; cannot remove higher-ranked; owner-protected; ownership transfer/deactivation handled for removed user |
| RBAC-08 | Transfer ownership | Owner (or global Admin) | `PUT /api/Tenant/owner {targetUserId}` | Ownership transferred; new owner promoted to `Admin` if below; only owner/global Admin allowed; audit logged |
| RBAC-09 | Deactivate member (not owner) | Team Admin | `DELETE /api/User/{id}` | Member deactivated; **owner cannot be deactivated** on the tenant surface |
| RBAC-10 | Lock/unlock member | Team Admin | `POST /api/User/{id}/lock` / `/unlock` | Member locked/unlocked; owner cannot be locked on tenant surface |
| RBAC-11 | Reset member password / email | Team Admin | `POST /api/User/{id}/password/reset`, `PUT /api/User/{id}/email` | Reset/confirmation emails sent; scoped to tenant-owned (non-guest) members |
| RBAC-12 | Manage member sessions | Team Admin | `GET/DELETE /api/User/{id}/sessions` | View/revoke sessions of tenant-owned members; scoped enforcement |
| RBAC-13 | Cross-tenant isolation | Tenant A Admin | Attempt to act on a user/seat/tenant of Tenant B | `403/404` — tenant scope blocks; only own-tenant members are reachable |
| RBAC-14 | Account ops are self/Xorbix only | Any tenant member (owned or guest) | Tenant Admin attempts account-wide changes (email/password/settings/lock/deactivate) on a member | Rejected — account administration is self-service or global Administrator only; membership role/seat/suspend/remove ops remain tenant-scoped |

---

## 8. Global Administrator (`ADMIN`)

User-requested cases 13–14.

### 8.1 Access & navigation

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| ADMIN-01 | Admin nav visible only to Administrator | Global Admin vs non-admin | Compare sidebars | Admin sees Administration (Dashboard, Tenant Mgmt, User Mgmt), Security (Audit Logs), Billing (Stripe History); non-admin sees no Administration entry |
| ADMIN-02 | Admin route guard | Non-admin logged in | Navigate to `/administration/*` | Redirected to `/apps` (`AuthenticatedLayout` admin-route guard) |
| ADMIN-03 | Management endpoints require Administrator | Tenant Admin (non-global) | Call `/api/Management/*` and admin-only `/api/Tenant`/`/api/User` endpoints | `403 Forbidden` |

### 8.2 Tenant management

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| ADMIN-04 | List all tenants (paginated) | Global Admin | `GET /api/Tenant?skip=0&take=25` | `PaginatedTenantsResponse` across all tenants |
| ADMIN-05 | View tenant + usage | Global Admin | `GET /api/Tenant/{id}`, `GET /api/Tenant/{id}/usage` | `TenantDto`; usage stats (users/apps/connections vs limits) |
| ADMIN-06 | Edit any tenant | Global Admin | `PUT /api/Tenant/{id} {displayName, subscriptionTier, maxUsers, …}` | Tenant updated (including manual tier grant / limits) |
| ADMIN-07 | Extend trial | Global Admin | `POST /api/Tenant/{id}/trial/extend {newTrialEndDate}` | `TrialEndDate` updated; audit logged |
| ADMIN-08 | Deactivate / reactivate tenant | Global Admin | `POST /api/Tenant/{id}/deactivate` then `/reactivate` | Tenant `IsActive` toggled; members' access follows |
| ADMIN-09 | Cancel tenant subscription | Global Admin | `POST /api/Tenant/{id}/cancel-subscription?immediate=true|false` | Stripe canceled accordingly; seats/status updated |
| ADMIN-10 | Soft-delete tenant (cascade) | Global Admin | `DELETE /api/Tenant/{id}` | Tenant soft-deleted; cascades to memberships, apps, connections, seats, pending invites; sole-tenant users disabled; Stripe canceled immediately |
| ADMIN-11 | Purge tenant (hard delete) | Global Admin | `DELETE /api/Tenant/{id}/purge` | Tenant and all related records permanently removed |
| ADMIN-12 | Create tenant with owner | Global Admin | `POST /api/Tenant {tenantName, ownerId}` | Tenant created; owner added as tenant `Admin` |
| ADMIN-13 | Change member role in any tenant | Global Admin | `PUT /api/Tenant/{tenantId}/members/{userId}/role` | Role changed cross-tenant; cannot assign `Administrator`; cannot change own role |
| ADMIN-14 | View any tenant billing | Global Admin | `GET /api/Billing/tenants/{id}/invoices`, `/subscription-history`, `/seats` | Returns that tenant's invoices, subscription history (all event types), and seats |

### 8.3 User management

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| ADMIN-15 | List all users | Global Admin | `GET /api/User` | All users across tenants (tenant Admin sees only own-tenant users) |
| ADMIN-16 | Create user with roles | Global Admin | `POST /api/User {email, roles[]}` | User created; welcome email; audit "Create" |
| ADMIN-17 | Update / deactivate / reactivate user | Global Admin | `PUT /api/User/{id}`, `DELETE /api/User/{id}`, `POST /api/User/{id}/reactivate` | Succeeds across tenants (no scope limit for global Admin); audit logged |
| ADMIN-18 | Lock / unlock user | Global Admin | `POST /api/User/{id}/lock` / `/unlock` | Account locked/unlocked; can lock even tenant owners (global bypass) |
| ADMIN-19 | Manage user roles | Global Admin | `PUT /api/User/{id}/roles {rolesToAdd, rolesToRemove}` | Any roles grantable/revocable; audit "Update" |
| ADMIN-20 | Force logout / revoke sessions | Global Admin | `DELETE /api/User/{id}/sessions`, `DELETE …/sessions/{sessionId}` | Sessions revoked; tokens invalidated |
| ADMIN-21 | 2FA enable/disable for user | Global Admin | `POST /api/User/{id}/2fa/enable` / `/disable` | 2FA toggled for the target |
| ADMIN-22 | Admin password reset / email change | Global Admin | `POST /api/User/{id}/password/reset`, `PUT /api/User/{id}/email`, `…/email/resend-confirmation` | Reset/confirmation emails sent |
| ADMIN-23 | Soft-delete user (frees email) | Global Admin only | `DELETE /api/User/{id}/soft-delete` | User soft-deleted; email freed for reuse; tenant Admin gets `403` |
| ADMIN-24 | Purge user (GDPR) | Global Admin only | `DELETE /api/User/{id}/purge` | User data permanently purged; tenant Admin gets `403` |
| ADMIN-25 | Roles administration | Global Admin | `GET/POST /api/Management/roles`, `DELETE /api/Management/roles/{name}` | List/create roles; deleting a **protected system role** is rejected |
| ADMIN-26 | Stripe event logs | Global Admin | `GET /api/Management/stripe/event-logs?pageNumber=1&pageSize=25` | Paginated Stripe webhook diagnostics |
| ADMIN-27 | Audit logs | Global Admin | Open `/administration/auditlogs` | Audit entries for management actions (Create/Update/Deactivate/Remove/TransferOwnership/etc.) |

### 8.4 Global admin's own account

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| ADMIN-28 | Manage own account | Global Admin | Open `/account` and manage profile, sessions, and (if the admin's own tenant has Stripe billing) billing/plan | Global Admin uses the same account surface as any user for their **own** tenant; billing visible only if their tenant has a Stripe customer |
| ADMIN-29 | Own-account vs platform separation | Global Admin | Compare `/account` (own tenant) vs `/administration` (all tenants) | Account pages act on the admin's own tenant; administration pages act platform-wide; the two are distinct surfaces |

---

## 9. Cross-Cutting / Negative / Security (`X`)

| ID | Title | Pre-conditions | Steps | Expected result |
| --- | --- | --- | --- | --- |
| X-01 | Unauthenticated protected access | No JWT | Call any authenticated endpoint | `401 Unauthorized` |
| X-02 | Self-access always permitted | Any user | Read/update own `/api/User/{self}` | Allowed regardless of role/tenant scope |
| X-03 | Tenant switching | User in ≥2 tenants | `POST /api/Tenant/switch/{tenantId}` | New `AuthResponse` with updated `tenant_id`/`tenant_role`; subsequent calls scoped to new tenant |
| X-04 | Default tenant | User in ≥2 tenants | `PUT /api/Tenant/default/{tenantId}` | Default membership updated; reflected on next login |
| X-05 | Audit trail completeness | Management actions performed | Perform create/update/deactivate/role/ownership changes; check audit logs | Each produces an audit entry with action/resource/actor |
| X-06 | 2FA / passwordless login | User with 2FA enabled | Login → code challenge → `verify-code` | Max 3 attempts; expired code rejected; resend works; successful code returns `AuthResponse` |
| X-07 | Account lockout | Repeated bad logins | Exceed failed-login threshold | "Account is locked out"; unlock via admin or lockout window |
| X-08 | Webhook signature validation | Invalid `Stripe-Signature` | POST to `/api/StripeWebhook` with bad signature | Rejected; event not processed |
| X-09 | Seat/Stripe consistency | After purchase/remove/cancel/period-end | Compare local seat count vs Stripe subscription quantity vs `Tenant.MaxUsers` | All three stay consistent after each operation |
| X-10 | Concurrent invite acceptance | Two invitees accept simultaneously when only 1 seat free (Team) | Accept both near-simultaneously | One assigns the free seat; the other triggers an auto-purchase (or is serialized correctly) — no negative/over-count seats |

---

## 10. Traceability — User-Requested Cases → Test IDs

| Requested item | Covered by |
| --- | --- |
| 1. Signup as Individual trial & no-trial; team trial & no-trial | SUB-01, SUB-02, SUB-03, SUB-04 (+ SU-01..16, SUB-05) |
| 3. As Individual, upgrade to Team | SUB-13, SUB-14, SUB-15 |
| 4. Individual & Team cancel before/after trial ends | SUB-19, SUB-20, SUB-21, SUB-22, SUB-23, SUB-24 (+ SUB-25..27 reactivate) |
| 5. As Team, invite members, add seats before/after trial | INV-01..14, SEAT-02, SEAT-03, SEAT-04 |
| 6. As Team, cancel extra seats | SEAT-06, SEAT-07, SEAT-08, SEAT-11 |
| 7. As Team, attempt to cancel required seats | SEAT-09, SEAT-10 |
| 8. Individual sees billing/payment/invoices/subscription, not team details | ACCT-IND-01..05, ACCT-IND-11 |
| 9. Individual edit profile details | ACCT-IND-06..10 |
| 10. Team sees team details + all Individual + seat management | ACCT-TEAM-01..06 |
| 11. User management & account management as Team Admin | ACCT-TEAM-07, RBAC-01, RBAC-03..12 |
| 12. Developer on team — no access to account management | ACCT-TEAM-08, ACCT-TEAM-09, RBAC-02, SEAT-27, SUB-39 |
| 13. Global Admin — tenant & user management, view everything | ADMIN-01..27 |
| 14. Global Admin — account management for own account | ADMIN-28, ADMIN-29 |

---

## 11. Notes & Areas to Confirm During QA

- **Per-tenant subscription history visibility:** `GET /api/Billing/tenants/{id}/subscription-history`
  is currently **global-Admin-only**. Confirm whether an Individual/Team self-service user has any
  in-app "subscription history" view, or whether only **invoice history** (`GET /api/Billing/invoices`)
  is self-served. If self subscription history is a requirement, this is a gap to raise.
- **Downgrade Team → Individual with multiple occupied seats** (SUB-17): confirm the exact guard and
  error message, and whether the UI prevents the action before the API call.
- **Cancel-request transport** (SUB-19..24): the controller reads `?immediate=` as a query parameter;
  `CancelSubscriptionRequest.Immediate` exists as a DTO. Confirm which path the UI uses.
- **Trial-tier vs trial-flag:** `SubscriptionTier.Trial` exists in the enum, but self-service signup
  uses Individual/Team plus a `startTrial` flag. Confirm whether any flow ever sets the tenant tier to
  the literal `Trial` value.
- **Removing the default payment method** (SUB-30): confirm the UX warning and the next-renewal
  behavior when no default remains.
</content>
</invoke>
