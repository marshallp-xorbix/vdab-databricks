# 4 — Manual Bicep Deployment

Back to the guide index: [README.md](./README.md)

The pipeline deploys infrastructure on every run, but the **first** deployment of a new environment must be
done (or at least understood) manually, because it seeds one-time secrets. This doc also covers local
what-if debugging. Load shared variables from [0 — Shared variables & naming](./0-variables.md) first.

Template: [`.infrastructure/main.bicep`](../../.infrastructure/main.bicep) ·
Parameters: [`.infrastructure/main.<env>.bicepparam`](../../.infrastructure/).

## What gets deployed

`main.bicep` creates, per environment:

1. **Application Insights**
2. **Key Vault** (RBAC-authorized) with the secrets listed below
3. **Storage accounts** — Data Protection key ring + general application blobs (`geolite`, `audit-archive`)
4. **App Service Plan** + **App Service** (.NET 10, system-assigned managed identity, HTTPS-only). When
   `deployDeploymentSlot = true` (production, Standard tier+), a **`staging` deployment slot** is also created
   with its own identity + Key Vault/Storage grants for blue-green releases — see [8 — Production go-live](./8-production-go-live.md).
5. **Azure Communication Service** (email) — when `deployCommunicationService = true`
6. **RBAC role assignments** — App Service identity → Key Vault Secrets/Crypto User + Storage Blob Data Contributor

> VDAB's backend database is **not** created by Bicep. It is a Databricks Lakebase Postgres branch; only its
> connection string is stored in Key Vault. See [6 — Lakebase databases](./6-lakebase-databases.md).

## Key Vault secrets

Secrets come from two places. **Externally-sourced** secrets are seeded by `secrets.bicep` (run manually,
values never committed — see [First deployment](#first-deployment-of-an-environment)). **Derived** secrets are
created automatically by `main.bicep` from the resources it provisions — no input needed.

**Seeded by `secrets.bicep`:**

| Secret | Notes |
|--------|-------|
| `JwtConfiguration--SecretKey` | JWT signing key; generated (deterministic per env) when `seedJwtSecret=true`. |
| `ConnectionStrings--PostgreSql` | Npgsql connection string for the env's Lakebase branch. |
| `Stripe--SecretKey`, `Stripe--WebhookSecret` | Stripe secret key + webhook signing secret (test for dev/stg, live for prd). |
| `DatabricksAi--AccessToken` | Databricks personal access token for AI Builder. |
| `GeoLite--AccountId`, `GeoLite--LicenseKey` | MaxMind GeoLite credentials only (the `GeoLite2-City.mmdb` file is uploaded separately; see [GeoLite2 setup](../geolite2_setup_readme.md)). |

**Created by `main.bicep`** (derived from resources):

| Secret | Notes |
|--------|-------|
| `ConnectionStrings--ApplicationInsights` | From the App Insights resource. |
| `Encryption--BlobUri`, `Storage--BlobUri` | Data Protection + app storage URIs. |
| `Encryption--KeyUri` | Data Protection key in Key Vault. |
| `Encryption--LegacyKey`, `Encryption--LegacyIv` | Legacy encryption fallback (placeholders). |
| `ConnectionStrings--CommunicationService` | From the ACS resource (when `deployCommunicationService=true`). |

## First deployment of an environment

Two manual steps, once per environment. Infrastructure and secrets are separate templates, so the committed
`main.*.bicepparam` files never contain secret values.

**Step 1 — Deploy the infrastructure** (`main.bicep`). No secret parameters; this creates the Key Vault, the
derived secrets, the App Service, etc. Run a `what-if` first if you like:

```bash
az deployment group create \
  --resource-group "$RG_NAME" \
  --template-file .infrastructure/main.bicep \
  --parameters ".infrastructure/main.${ENV}.bicepparam"
```

**Step 2 — Seed the externally-sourced secrets** (`secrets.bicep`) into the Key Vault that Step 1 created.
Copy the example file, fill in this environment's values, and deploy it. The real `secrets.<env>.bicepparam`
is **gitignored** — it never gets committed:

```bash
cp .infrastructure/secrets.example.bicepparam ".infrastructure/secrets.${ENV}.bicepparam"
# Edit secrets.${ENV}.bicepparam: set environment='${ENV}', seedJwtSecret=true (first time only),
# and the values you have (Postgres connection string, Stripe keys, Databricks token, GeoLite).
az deployment group create \
  --resource-group "$RG_NAME" \
  --template-file .infrastructure/secrets.bicep \
  --parameters ".infrastructure/secrets.${ENV}.bicepparam"
```

Then complete the GeoLite runtime setup in [GeoLite2 IP geolocation setup](../geolite2_setup_readme.md):

1. Upload `GeoLite2-City.mmdb` to the environment storage account's `geolite` container.
2. Ensure `GeoLiteConfiguration:BlobUri` resolves to that blob path.
3. Restart the App Service so Key Vault references and GeoLite config resolve.

From here on, the pipeline only ever deploys `main.bicep` and never touches secrets.

> **Why a param file?** Putting the Postgres connection string in `secrets.<env>.bicepparam` sidesteps the
> shell-quoting problems that bite `--parameters postgresConnectionString='...'` under Git Bash (the string
> contains `;`, `=`, and `@`). You *can* still pass values inline with `--parameters` if you'd rather not keep a file.

> **Rotate a secret** by re-running Step 2 with only that value set (and `seedJwtSecret=false`); empty params
> are skipped, so the other secrets are left untouched.

## Subsequent / routine deployments

Routine infrastructure changes use the committed parameter file with no overrides — exactly what the pipeline
runs:

```bash
az deployment group what-if \
  --resource-group "$RG_NAME" \
  --template-file .infrastructure/main.bicep \
  --parameters ".infrastructure/main.${ENV}.bicepparam"
```

## Production email (ACS)

`main.prd.bicepparam` ships with `deployCommunicationService = false` so production does not stand up email
infrastructure before a verified sending domain is ready. When production email is provisioned, flip it to
`true` (and configure `customEmailDomain` if using a custom domain) and redeploy. See
[`.infrastructure/communication-service-setup.md`](../../.infrastructure/communication-service-setup.md).

## After the first deploy: grant managed-identity DB access

The App Service connects to its Lakebase Postgres branch using the connection string in Key Vault. Ensure the
database role used by that connection string has the right grants — see
[6 — Lakebase databases](./6-lakebase-databases.md).
