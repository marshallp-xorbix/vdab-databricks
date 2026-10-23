# 8 — Production Go-Live & Domain Cutover

> **Legacy .NET/Azure deployment reference:** These instructions describe the former SaaS App Service deployment retained while transition gates remain open. They do not install or deploy the standalone Databricks App. Use [the standalone runbook](../../databricks-app/DEPLOYMENT.md) and [manual workspace checklist](../databricks-app-transition/manual-workspace-testing.md) for the new product.

Back to the guide index: [README.md](./README.md)

A one-time runbook for bringing **production** (`xorbix-vdab-prd`) live: how blue-green slot releases work, the
first production deploy, moving the `app.vdab.ai` / `app.vdab.io` domains off the dev App Service, and retiring
the old `xorbix-vdab-prod` app.

> **Starting reality (from the live resource group):** `app.vdab.ai` and `app.vdab.io` are bound (with TLS
> certs) to **`xorbix-vdab-dev`** — the dev App Service is the de-facto production host today. A separate,
> partially-configured **`xorbix-vdab-prod`** app also exists; it is being **replaced** by the clean
> `xorbix-vdab-prd` and retired at the end of this runbook.

## How production releases work (blue-green slots)

Production runs on a **Standard (S1)** plan, which enables **deployment slots**. The prod App Service has a
`staging` deployment slot (defined in [`main.bicep`](../../.infrastructure/main.bicep) when
`deployDeploymentSlot = true`). The prod stage of the pipeline:

1. Deploys the promoted artifact to the **`staging` slot** (not the live site).
2. Runs EF migrations against the production database.
3. **Swaps** the slot into the live site — Azure warms the slot first, so the cutover is near-zero-downtime.

> **`staging` slot ≠ `stg` environment.** The slot is part of the prod App Service (`xorbix-vdab-prd/staging`);
> it is unrelated to the `stg` environment (`xorbix-vdab-stg`).

> **Migrations must be backward-compatible.** They run before the swap, against the shared production database,
> so the currently-live (pre-swap) code keeps serving against the new schema until the swap completes. Avoid
> destructive schema changes in a single release; use expand-then-contract.

The slot has its **own** managed identity (identities are not exchanged during a swap), so Bicep grants the slot
identity the same Key Vault + Storage roles as the production slot. No manual step needed.

## Step 1 — Stand up production (no domains yet)

1. Complete the per-environment setup for `prd` ([3](./3-service-connections-and-access.md), [4](./4-deploy-bicep.md)):
   service connection, Key Vault-linked variable group, `prd` Environment with higher-bar approval, and the
   first manual Bicep deploy that seeds `JwtConfiguration--SecretKey` + `ConnectionStrings--PostgreSql`. Also complete
   [GeoLite2 IP geolocation setup](../geolite2_setup_readme.md) so production has the `GeoLite2-City.mmdb` blob available.
2. Promote a build to prod (approve the **Deploy prod** stage). It deploys to the `staging` slot and swaps.
3. Validate production at `https://xorbix-vdab-prd.azurewebsites.net` **before** touching DNS. To smoke-test the
   slot before a swap, use `https://xorbix-vdab-prd-staging.azurewebsites.net` (register that `/callback` in
   Databricks if you exercise OAuth there).

## Step 2 — Move the custom domains from dev to prd

`app.vdab.ai` and `app.vdab.io` are currently bound to `xorbix-vdab-dev`. An App Service hostname binding is
**exclusive** — a domain can only be bound to one app at a time — so the move has a brief unbinding window.
Minimize it by lowering DNS TTL ahead of time and pre-staging certs. Do this per domain (`app.vdab.ai`, then
`app.vdab.io`):

1. **Lower TTL** on the domain's DNS records (e.g. to 300s) a few hours ahead.
2. **Remove** the hostname binding from `xorbix-vdab-dev`
   (**Portal → xorbix-vdab-dev → Custom domains →** remove the domain).
3. **Add** the custom domain to `xorbix-vdab-prd`
   (**Portal → xorbix-vdab-prd → Custom domains → Add**); complete the asuid/TXT + CNAME/A validation.
4. **Bind TLS**: create/import an App Service Managed Certificate (or upload the existing cert) on
   `xorbix-vdab-prd` and bind it to the domain with **SNI SSL**.
5. **Point DNS** at `xorbix-vdab-prd` (CNAME to `xorbix-vdab-prd.azurewebsites.net`, or A/ALIAS per your DNS).
6. **Verify**: `https://app.vdab.ai` and `https://app.vdab.io` load from prod, the cert is valid, and the network
   tab shows API calls to the same origin.

Both domains are already in the prod `allowedOrigins` ([`main.prd.bicepparam`](../../.infrastructure/main.prd.bicepparam))
and the SPA derives its API base + OAuth redirect from the current origin at runtime, so no rebuild is needed —
the app works from either domain as soon as it is bound.

## Step 3 — Register Databricks callbacks

Ensure `https://app.vdab.ai/callback` and `https://app.vdab.io/callback` are registered in the Databricks App
Connection (see [1 — Overview → callbacks](./1-overview.md#databricks-oauth-callbacks) and
[databricks-oauth-admin-setup-guide.md](../databricks-oauth-admin-setup-guide.md)).

## Step 4 — Reclaim dev and retire the old prod app

1. Confirm `xorbix-vdab-dev` no longer has the production domains bound (only `*.azurewebsites.net` remains). Dev
   is now purely the dev environment again.
2. **Retire the leftover `xorbix-vdab-prod`** once you've confirmed nothing depends on it: delete the app, its
   plan (`xorbix-vdab-prod-plan`), and its Application Insights (`xorbix-vdab-prod202605121141`). These were a
   partial earlier setup, replaced by `xorbix-vdab-prd`.

## Rollback

If a release misbehaves after a swap, **swap back** (Portal → xorbix-vdab-prd → Deployment slots → Swap, or
re-run the swap with slots reversed) to restore the previous build immediately. Because migrations are
backward-compatible, the previous build runs against the current schema.

## Checklist

- [ ] `prd` fully set up (service connection, KV-linked variable group, Environment + higher-bar approval, secrets seeded).
- [ ] Production validated at `xorbix-vdab-prd.azurewebsites.net` (and slot host) before DNS.
- [ ] `app.vdab.ai` moved dev → prd (removed from dev, added to prd, cert bound, DNS pointed, verified).
- [ ] `app.vdab.io` moved dev → prd (same steps).
- [ ] Databricks callbacks registered for both domains.
- [ ] `xorbix-vdab-dev` no longer serves the production domains.
- [ ] Old `xorbix-vdab-prod` app + plan + App Insights retired.
