# Stripe Promo Codes Setup

VDAB promo codes are **100% off, repeating** Stripe coupons exposed as **Promotion Codes**. Codes are created and managed in the Stripe Dashboard; the application looks them up at runtime by customer-facing string (not `promo_...` API IDs).

## Prerequisites

- Individual and Team **monthly** prices configured in `Stripe:PriceIds` (see `appsettings.Development.json`).
- Webhook endpoint configured per [stripe_webhook_setup.md](./stripe_webhook_setup.md), including **`invoice.upcoming`** for pre-charge reminder emails.

## Create a coupon (per tier)

**Dashboard:** Products → **Coupons** → Create coupon

| Field | Value |
| --- | --- |
| Type | Percentage discount |
| Percent off | **100%** |
| Duration | **Multiple months** |
| Duration in months | e.g. **6** |
| Applies to | **Specific products** → Individual or Team product only |

Recommended internal names: `VDAB-IND-6MO-FREE`, `VDAB-TEAM-6MO-FREE`

## Create a promotion code

On the coupon → **Promotion codes** → Add promotion code

| Field | Value |
| --- | --- |
| Code | Customer-facing string (e.g. `IND6FREE`, `TEAM6FREE`) |
| Active | Yes |
| Expires on | Optional campaign end |
| Max redemptions | Optional (e.g. 500) |
| Limit to first-time customers | Optional (VDAB also enforces once per tenant at signup) |

## Test-mode checklist

- [ ] Individual code validates and subscribes on Individual **monthly** only
- [ ] Team code validates and subscribes on Team **monthly** only
- [ ] Wrong tier + code returns validation error
- [ ] Annual interval rejected for promo validation (v1)
- [ ] Subscription in Stripe shows 6-month discount
- [ ] First invoices are $0; after 6 cycles, full price charges default payment method
- [ ] `invoice.upcoming` triggers promo-ending email before first paid invoice

## Local testing

1. Start API with Stripe test keys and webhook secret (Stripe CLI).
2. Forward webhooks including `invoice.upcoming`:

```bash
stripe listen --forward-to https://localhost:7023/api/stripe/webhook --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.trial_will_end,invoice.paid,invoice.payment_failed,invoice.sent,invoice.upcoming,customer.updated
```

3. Validate before subscribe:

```http
POST /api/Billing/promo-codes/validate
Authorization: Bearer {tenant-admin-token}
Content-Type: application/json

{
  "code": "TEAM6FREE",
  "tier": "team",
  "billingInterval": "monthly"
}
```

4. Complete signup at `/account/setup/billing` with payment method + promo code.

## Production rollout

1. Recreate coupons and promotion codes in **Live** mode.
2. Add `invoice.upcoming` to production webhook configuration.
3. Verify price IDs in Azure App Service / Key Vault settings match Live mode products.
