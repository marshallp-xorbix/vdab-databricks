# Infrastructure (Bicep)

Azure infrastructure-as-code for the Visual Databricks App Builder. This README documents the **template
itself**. For the end-to-end deployment process (pipeline, environments, secrets, Lakebase, adding a new
environment), see the **[Deployment Guide](../.documentation/deployment/README.md)**.

## Files

| File | Purpose |
|------|---------|
| `main.bicep` | The single template, parameterized by `environment` (`dev` / `stg` / `prd`). |
| `main.dev.bicepparam` | Dev parameters (App Service `xorbix-vdab-dev`). |
| `main.stg.bicepparam` | Staging parameters (App Service `xorbix-vdab-stg`). |
| `main.prd.bicepparam` | Production parameters (App Service `xorbix-vdab-prd`, `https://app.vdab.ai`). |
| `secrets.bicep` | Seeds the externally-sourced Key Vault secrets (run manually — see Deployment Guide). |
| `secrets.example.bicepparam` | Template for `secrets.<env>.bicepparam` (the real, filled-in files are gitignored). |
| `communication-service-setup.md` | Azure Communication Services email configuration. |

## What's deployed

`main.bicep` creates, per environment:

1. **Application Insights** — monitoring and telemetry.
2. **Key Vault** — RBAC-authorized secrets store (see below).
3. **Storage accounts** — Data Protection key ring + general application blobs (`geolite`, `audit-archive`).
4. **App Service Plan + App Service** — .NET 10, HTTPS-only, system-assigned managed identity. With
   `deployDeploymentSlot=true` (prod, Standard tier+), a blue-green **deployment slot** (own identity + grants).
5. **Azure Communication Service** (optional) — email via Azure Managed Domain or a custom domain.
6. **RBAC role assignments** — App Service identity → Key Vault Secrets/Crypto User + Storage Blob Data Contributor.

`main.bicep` also creates the **derived** Key Vault secrets (computed from the resources above). The
**externally-sourced** secrets (DB connection string, Stripe, Databricks token, JWT key, GeoLite) are seeded
separately by `secrets.bicep`.

> The application **database is not created here**. VDAB uses a Databricks Lakebase Postgres branch per
> environment; only its connection string is stored in Key Vault. See
> [Deployment Guide → Lakebase databases](../.documentation/deployment/6-lakebase-databases.md).

## Key Vault secrets

**Seeded by `secrets.bicep`** (externally-sourced; run manually from a gitignored param file):

| Secret | Notes |
|--------|-------|
| `JwtConfiguration--SecretKey` | JWT signing key; generated per environment when `seedJwtSecret=true`. |
| `ConnectionStrings--PostgreSql` | Lakebase/Postgres connection string (per environment). |
| `Stripe--SecretKey` / `Stripe--WebhookSecret` | Stripe secret key + webhook signing secret. |
| `DatabricksAi--AccessToken` | Databricks access token for AI Builder. |
| `GeoLite--AccountId` / `GeoLite--LicenseKey` | MaxMind GeoLite credentials. |

**Created by `main.bicep`** (derived from resources):

| Secret | Notes |
|--------|-------|
| `ConnectionStrings--ApplicationInsights` | App Insights connection string. |
| `Encryption--BlobUri` / `Storage--BlobUri` | Data Protection key-ring blob URI / app storage URI. |
| `Encryption--KeyUri` | Key Vault key wrapping the Data Protection key ring. |
| `Encryption--LegacyKey` / `Encryption--LegacyIv` | Legacy encryption fallback. |
| `ConnectionStrings--CommunicationService` | From the ACS resource (when `deployCommunicationService=true`). |

All sensitive App Service settings are Key Vault references (`@Microsoft.KeyVault(...)`), resolved at runtime
via the App Service managed identity.

## Key parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `environment` | — (required) | `dev`, `stg`, or `prd`. Drives every resource name. |
| `frontendUrl` | `''` | Canonical public URL for email links; empty → `https://{appService}.azurewebsites.net`. |
| `allowedOrigins` | `*` | Semicolon-separated CORS origins. |
| `deployCommunicationService` | varies | Enable ACS email infrastructure. |
| `appServicePlanSkuName` / `…SkuTier` / `…Capacity` | `B1` / `Basic` / `1` | App Service Plan sizing (scale prd here). |
| `appServiceAlwaysOn` | `false` | Keep the App Service warm (true for stg/prd). |
| `deployDeploymentSlot` / `deploymentSlotName` | `false` / `staging` | Blue-green deployment slot for prod (needs Standard tier+). |

> **`main.bicep` contains no secret values.** Secrets are seeded separately by `secrets.bicep` from a gitignored
> `secrets.<env>.bicepparam` — see [Deployment Guide → manual Bicep deploy](../.documentation/deployment/4-deploy-bicep.md).

## Naming convention

Pattern `{companyPrefix}-{appPrefix}-{environment}` (all in the shared resource group `vdab`):

| Role | `environment` | App Service | Key Vault |
|------|---------------|-------------|-----------|
| Dev | `dev` | `xorbix-vdab-dev` | `xorbixvdabdevkv` |
| Staging | `stg` | `xorbix-vdab-stg` | `xorbixvdabstgkv` |
| Production | `prd` | `xorbix-vdab-prd` | `xorbixvdabprdkv` |

## Validate locally

```bash
# Compile the template
az bicep build --file .infrastructure/main.bicep

# Confirm a parameter file binds
az bicep build-params --file .infrastructure/main.dev.bicepparam --stdout >/dev/null && echo OK

# The secrets template compiles the same way
az bicep build --file .infrastructure/secrets.bicep
```

Manual deployment (first deploy = `main.bicep`, then `secrets.bicep`) and the full pipeline are documented in the
[Deployment Guide](../.documentation/deployment/README.md):
[Manual Bicep deployment](../.documentation/deployment/4-deploy-bicep.md) ·
[Service connections & access](../.documentation/deployment/3-service-connections-and-access.md).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `AuthorizationFailed` on role assignment | The deployer/service connection needs **User Access Administrator** (or Owner) on `vdab`, not just Contributor. |
| Key Vault name already exists | Names are globally unique; `xorbixvdab<env>kv` should be free. If recently deleted, purge the soft-deleted vault. |
| App settings show unresolved `@Microsoft.KeyVault(...)` | The secret is missing (e.g. `ConnectionStrings--PostgreSql` not seeded) or the managed identity lacks Key Vault access. |
| Template validation failed | Run `az bicep build` and `az deployment group what-if` (see above) to surface the exact error. |
