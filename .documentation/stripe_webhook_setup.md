# Stripe Webhook Setup

## Required Webhook Events

These are the events handled by `StripeWebhookService.ProcessStripeEventAsync`. Any other events are safely ignored.

| Stripe Event                              | Purpose in VDAB                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `customer.subscription.created`           | Creates/links subscription to tenant, reconciles seats, records history  |
| `customer.subscription.updated`           | Syncs plan changes, seat quantity, cancellation flags                    |
| `customer.subscription.paused`            | Marks tenant `paused` (no-card trial ended), locks resource creation     |
| `customer.subscription.resumed`           | Restores tenant status/limits after a payment method is added            |
| `customer.subscription.deleted`           | Cancels all seats, marks tenant canceled, sends notification             |
| `customer.subscription.trial_will_end`    | Records "TrialEnding" history, sends trial ending email reminder         |
| `invoice.paid`                            | Finalizes pending seat cancellations, syncs subscription, records renewal|
| `invoice.payment_failed`                  | Marks tenant `past_due`, records failed payment, sends notification      |
| `invoice.sent`                            | Records "InvoiceSent" history for customer-facing audit trail            |
| `invoice.upcoming`                        | Sends promo-ending email before first paid invoice after a promo period  |
| `customer.updated`                        | Keeps `BillingCustomerId` in sync if Stripe customer changes             |

## Per-seat pricing, trials, and limit recomputation

VDAB uses a **per-unit (licensed) price** with a single subscription line item whose `quantity` is the
seat count (Team minimum 3 seats; Individual locked at 1). The webhook handlers reflect this model:

- **Seat changes drive limit recomputation.** Whenever the seat quantity changes — on
  `customer.subscription.created` / `customer.subscription.updated` (webhook seat-sync), seat purchase /
  assignment, and period-end cancellation — the tenant's `MaxWorkspaceConnections` and `MaxPublishedApps`
  are recomputed via `ISubscriptionTierService.ResolveEffectiveLimits`. Team limits scale per seat
  (`perSeat × seats`); Individual / Enterprise are flat. `0` means unlimited (Enterprise).
- **Trials are Stripe-native, on a base plan.** A trial is `trial_period_days = 14` on the chosen
  Individual/Team price (requested via `SubscriptionRequest.StartTrial`), with a payment method required
  up front and `trial_settings.end_behavior.missing_payment_method = cancel`. There is **no separate
  Trial price or tier**.
- **Trial limits while `trialing`.** While the subscription status is `trialing`, the tier's flat trial
  limits apply (Individual 1 app / 1 connection; Team 3 / 3) regardless of seat count.
- **Trial → active conversion needs no dedicated handler.** When Stripe flips `trialing → active`
  (surfaced via `customer.subscription.updated` and `invoice.paid`), the same limit recomputation runs
  against the new status, so limits automatically swap from the flat trial totals to the full /
  per-seat-scaled limits. `Tenant.TrialEndDate` is synced from `subscription.trial_end` on every
  create / update / sync.
- **Trial ending / missing payment.** `customer.subscription.trial_will_end` records a `TrialEnding`
  history row and sends the reminder email. If no payment method is on file at trial end, Stripe cancels
  the subscription (`missing_payment_method = cancel`) and `customer.subscription.deleted` runs.

## Hosted webhook endpoints (deployed environments)

The handler is served at the route **`/api/stripe/webhook`** (`StripeWebhookController` — `[AllowAnonymous]`,
validated via the `Stripe-Signature` header). Configure **one Stripe webhook endpoint per environment**, each
pointed at that environment's **default App Service host** (`*.azurewebsites.net`), not a custom domain:

| Environment | Stripe mode | Webhook endpoint URL |
|-------------|-------------|----------------------|
| dev | Test | `https://xorbix-vdab-dev.azurewebsites.net/api/stripe/webhook` |
| stg | Test | `https://xorbix-vdab-stg.azurewebsites.net/api/stripe/webhook` |
| prd | **Live** | `https://xorbix-vdab-prd.azurewebsites.net/api/stripe/webhook` |

**Why the managed `*.azurewebsites.net` host (not `app.vdab.ai`)?** Binding a custom domain never removes the
default host, and the managed host is permanent for the life of the App Service. Pointing Stripe at it means a
custom-domain or DNS change never breaks webhook delivery. A custom domain works too, but for a
server-to-server callback it adds no benefit and couples delivery to your DNS.

**The signing secret is per endpoint.** Each Stripe endpoint has its own `whsec_...` secret. Store it in the
matching environment's Key Vault as `Stripe--WebhookSecret` (dev/stg from a **test-mode** endpoint; prd from a
**live-mode** endpoint). Seed it (with `Stripe--SecretKey`) into the vault via `secrets.bicep` — see
[deployment guide → manual Bicep deploy](./deployment/4-deploy-bicep.md).

**Production uses deployment slots — point at the production host.** `xorbix-vdab-prd.azurewebsites.net` always
routes to the live slot, and Azure keeps that hostname on the production slot across swaps, so the endpoint
stays correct through blue-green releases. Do **not** point Stripe at the slot host
(`xorbix-vdab-prd-staging.azurewebsites.net`).

**Events:** subscribe each endpoint to the events listed in [Required Webhook Events](#required-webhook-events).

## Local Development with Stripe CLI

The Stripe CLI creates a secure tunnel from Stripe to your local machine — no ngrok or public DNS needed.

### 1. Install

```
winget install Stripe.StripeCLI
```

### 2. Login

```
stripe login
```

### 3. Verify the Account you are connection to
If you have access to multiple Stripe accounts, verify that you only will forward the intended account/sandbox.

Confirm which account is active
```
stripe config --list

stripe whoami
```

If you need to switch accounts
```
stripe login --project-name=vdab-test
stripe listen --forward-to https://localhost:<PORT>/api/stripe/webhook --project-name=vdab-test
```


### 3. Forward events to your local API

```
stripe listen --forward-to https://localhost:<PORT>/api/stripe/webhook
stripe listen --forward-to https://localhost:7023/api/stripe/webhook
```

Replace `<PORT>` with your ASP.NET local HTTPS port (visible in `launchSettings.json` or the Aspire dashboard).

### 4. Configure the webhook signing secret

The CLI prints a `whsec_...` value on startup. Add it to `appsettings.Development.json`:

```json
{
  "Stripe": {
    "WebhookSecret": "whsec_..."
  }
}
```

This secret is different from the production webhook secret. Keep both configured per environment.

### 5. Filter to only the required events (recommended)

```
stripe listen --forward-to https://localhost:<PORT>/api/stripe/webhook --events customer.subscription.created,customer.subscription.updated,customer.subscription.paused,customer.subscription.resumed,customer.subscription.deleted,customer.subscription.trial_will_end,invoice.paid,invoice.payment_failed,invoice.sent,invoice.upcoming,customer.updated
```

### 6. Trigger test events

From a separate terminal:

```
stripe trigger customer.subscription.created
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

## End-to-end test runbook (per-seat + trial)

There are two complementary ways to exercise the webhooks:

- **Synthetic handler smoke test** — `stripe trigger <event>` fires Stripe's canned fixtures. This
  confirms the handler runs and is signature-verified, but the fixture objects are **not** tied to a real
  VDAB tenant/subscription, so they do not exercise the per-seat / trial lifecycle end to end.
- **App-driven lifecycle test** — drive the real flow through the VDAB API/UI with `stripe listen`
  forwarding the resulting events back. This is the authoritative test for per-seat scaling and trials.

### Setup

1. Start the app (Aspire) and note the API HTTPS port.
2. `stripe listen --forward-to https://localhost:<PORT>/api/stripe/webhook` and copy the printed
   `whsec_...` into `Stripe:WebhookSecret` (Development / Local appsettings).
3. Use a test card on file: `4242 4242 4242 4242` for success paths, and `4000 0000 0000 0341`
   (attaches but fails on charge) for the failure path.

### Lifecycle (drive via the app; observe the forwarded events)

1. **Create trial** — create a subscription with `startTrial = true` on Individual or Team. Expect
   `customer.subscription.created` (status `trialing`); the tenant becomes `trialing`, `TrialEndDate` ≈
   now + 14 days, and the flat trial limits apply (Individual 1/1, Team 3/3).
2. **Convert trial → active** — end the trial now (`stripe subscriptions update <sub_id> -d trial_end=now`,
   or advance a test clock by 14 days). Expect `customer.subscription.updated` (`trialing → active`) +
   `invoice.paid`; the tenant becomes `active` and limits swap to full / scaled (Individual 10/2; Team
   `20 × seats` apps / `3 × seats` connections).
3. **Add seat (proration)** — `POST /api/Billing/seats/purchase`. Expect `customer.subscription.updated`
   with a prorated quantity increase; `MaxUsers` and the scaled limits increase (Team 3 → 4 seats ⇒ apps
   60 → 80, connections 9 → 12).
4. **Remove seat** — `POST /api/Billing/seats/remove` schedules the seat for `PendingCancellation`; the
   scale-down is applied **at period end**. Advance the billing cycle with a Stripe **test clock** (or pay
   the next-cycle invoice) to observe the period-end finalization and the limits scaling back down.
5. **Cancel** — `DELETE /api/Billing/subscription` (period-end) or `?immediate=true`. Immediate cancel
   raises `customer.subscription.deleted`; seats are canceled and the tenant is marked canceled.
6. **Payment failed** — drive a renewal with the failing test card (or `stripe trigger
   invoice.payment_failed` for a handler smoke test). Expect the tenant marked `past_due`, a failed-payment
   history row, and a notification.

### QA verification: SUB-09 (trial ending email) and SUB-11 (payment failed email)

Both flows share the same billing notification path in `StripeWebhookService`: active tenant admins
(`Role = Admin`, `EmailNotificationsEnabled = true`) are emailed first; if none qualify, `Tenant.InvoiceEmail`
is used as a fallback.

| Test ID | Stripe event | Trigger | Expected DB | Expected email |
| --- | --- | --- | --- | --- |
| SUB-09 | `customer.subscription.trial_will_end` | Stripe fires ~3 days before trial end (test clock or manual event) | `SubscriptionHistory` row with `EventType = TrialEnding`; tenant status unchanged | `SendBillingTrialEndingAsync` to admin or `InvoiceEmail` |
| SUB-11 | `invoice.payment_failed` | Advance trial end with declining card `4000000000000341`, or `stripe trigger invoice.payment_failed` | Tenant `SubscriptionStatus = past_due`; `SubscriptionHistory` with `EventType = Payment`, `PaymentStatus = Failed` | `SendBillingPaymentFailedAsync` to admin or `InvoiceEmail` |

**Diagnostics when email is missing:**

1. Confirm the webhook endpoint subscribes to both events (see table above).
2. Check `StripeEventLogs` for the event id — `Success = true` means the handler ran.
3. Check app logs for `"No billing notification recipients found"` (no admin and no `InvoiceEmail`) or
   `"Email not configured. Skipping … billing notification."` (ACS connection string empty).
4. Distinguish SUB-11 from SUB-12: removing the card before trial end cancels the subscription
   (`customer.subscription.deleted`) and sends a cancellation email, not a payment-failed email.

> Time-dependent steps (trial conversion at day 14, period-end seat removal) are best tested with
> [Stripe test clocks](https://docs.stripe.com/billing/testing/test-clocks): create the customer under a
> test clock, then advance it past the trial end / billing boundary instead of waiting.
