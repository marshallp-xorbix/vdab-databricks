# 0 — Shared Variables & Naming

> **Legacy .NET/Azure deployment reference:** These instructions describe the former SaaS App Service deployment retained while transition gates remain open. They do not install or deploy the standalone Databricks App. Use [the standalone runbook](../../databricks-app/DEPLOYMENT.md) and [manual workspace checklist](../databricks-app-transition/manual-workspace-testing.md) for the new product.

Back to the guide index: [README.md](./README.md)

This is the single source of truth for the names referenced throughout the deployment docs, the Bicep
parameter files, and the pipeline. Set these shell variables once per session before running CLI commands.

## 1) Base variables

| Variable | Value | Notes |
|----------|-------|-------|
| `COMPANY_PREFIX` | `xorbix` | Fixed for VDAB. |
| `APP_PREFIX` | `vdab` | Fixed for VDAB. |
| `ENV` | `dev` \| `stg` \| `prd` | The environment you are operating on. |
| `AZ_LOCATION` | `northcentralus` | Azure region for all resources. |
| `AZ_SUBSCRIPTION_ID` | `1691b7b4-5945-408f-a9e7-3eaab576becd` | Single subscription for all environments. |
| `RG_NAME` | `vdab` | **Single shared resource group** for dev, stg, and prd. |

## 2) Derived names

With `NAME_PREFIX="${COMPANY_PREFIX}-${APP_PREFIX}-${ENV}"`:

| Resource | Pattern | dev | stg | prd |
|----------|---------|-----|-----|-----|
| App Service | `${NAME_PREFIX}` | `xorbix-vdab-dev` | `xorbix-vdab-stg` | `xorbix-vdab-prd` |
| App Service Plan | `${NAME_PREFIX}-plan` | `xorbix-vdab-dev-plan` | `xorbix-vdab-stg-plan` | `xorbix-vdab-prd-plan` |
| Key Vault | `${COMPANY_PREFIX}${APP_PREFIX}${ENV}kv` (≤24, no hyphens) | `xorbixvdabdevkv` | `xorbixvdabstgkv` | `xorbixvdabprdkv` |
| App Insights | `${NAME_PREFIX}` | `xorbix-vdab-dev` | `xorbix-vdab-stg` | `xorbix-vdab-prd` |
| Communication Service | `${NAME_PREFIX}-commservice` | `xorbix-vdab-dev-commservice` | `xorbix-vdab-stg-commservice` | `xorbix-vdab-prd-commservice` |
| Public URL (custom domain) | — | `https://xorbix-vdab-dev.azurewebsites.net` | `https://xorbix-vdab-stg.azurewebsites.net` | `https://app.vdab.ai` |

> The legacy env-less `xorbix-vdab-commservice` is replaced by `xorbix-vdab-dev-commservice` on dev's next infra
> deploy (the old resource is left in place — delete it manually once dev email is confirmed working).

## 3) Azure DevOps names

| Purpose | Pattern | dev | stg | prd |
|---------|---------|-----|-----|-----|
| Variable group | `vdab-infrastructure-secrets-${ENV}` | `vdab-infrastructure-secrets-dev` | `vdab-infrastructure-secrets-stg` | `vdab-infrastructure-secrets-prd` |
| Service connection | (see note) | `ea0729b6-…` (existing GUID) | `vdab-stg-service-connection` | `vdab-prd-service-connection` |
| Environment (approval gate) | `${ENV}` | `dev` | `stg` | `prd` |
| Bicep param file | `main.${ENV}.bicepparam` | `main.dev.bicepparam` | `main.stg.bicepparam` | `main.prd.bicepparam` |

> The service-connection names are set in the per-environment `variables` block of
> [`.pipelines/azure-pipelines.yml`](../../.pipelines/azure-pipelines.yml). dev reuses the existing
> connection by object id; stg/prd use named connections you create in
> [3 — Service connections & access](./3-service-connections-and-access.md).

## 4) Bash setup snippet

```bash
COMPANY_PREFIX="xorbix"
APP_PREFIX="vdab"
ENV="dev"                 # change to stg or prd as needed
AZ_LOCATION="northcentralus"
AZ_SUBSCRIPTION_ID="1691b7b4-5945-408f-a9e7-3eaab576becd"
RG_NAME="vdab"

NAME_PREFIX="${COMPANY_PREFIX}-${APP_PREFIX}-${ENV}"
APP_NAME="${NAME_PREFIX}"
KEY_VAULT_NAME="${COMPANY_PREFIX}${APP_PREFIX}${ENV}kv"
SERVICE_CONNECTION_NAME="${APP_PREFIX}-${ENV}-service-connection"
VARIABLE_GROUP_NAME="${APP_PREFIX}-infrastructure-secrets-${ENV}"
BICEP_PARAM_FILE="main.${ENV}.bicepparam"

az login
az account set --subscription "$AZ_SUBSCRIPTION_ID"
```

## 5) PowerShell setup snippet

```powershell
$env:COMPANY_PREFIX = "xorbix"
$env:APP_PREFIX     = "vdab"
$env:ENV            = "dev"        # change to stg or prd as needed
$env:AZ_LOCATION    = "northcentralus"
$env:AZ_SUBSCRIPTION_ID = "1691b7b4-5945-408f-a9e7-3eaab576becd"
$env:RG_NAME        = "vdab"

$env:NAME_PREFIX  = "$($env:COMPANY_PREFIX)-$($env:APP_PREFIX)-$($env:ENV)"
$env:APP_NAME     = $env:NAME_PREFIX
$env:KEY_VAULT_NAME = "$($env:COMPANY_PREFIX)$($env:APP_PREFIX)$($env:ENV)kv"
$env:BICEP_PARAM_FILE = "main.$($env:ENV).bicepparam"

az login
az account set --subscription $env:AZ_SUBSCRIPTION_ID
```

## 6) Variable ownership map

Secrets are stored **once**, in Key Vault. The pipeline reads them through a Key Vault-linked variable group,
so the "pipeline variable" name is identical to the Key Vault secret name (referenced as `$(secret-name)`).

| Purpose | Key Vault secret (= pipeline variable) | Seeded by |
|---|---|---|
| Postgres/Lakebase connection string (EF migrations + runtime) | `ConnectionStrings--PostgreSql` | `secrets.bicep` |
| JWT signing key | `JwtConfiguration--SecretKey` | `secrets.bicep` (`seedJwtSecret`) |
| Stripe secret key / webhook secret | `Stripe--SecretKey`, `Stripe--WebhookSecret` | `secrets.bicep` |
| Databricks AI access token | `DatabricksAi--AccessToken` | `secrets.bicep` |
| GeoLite credentials | `GeoLite--AccountId`, `GeoLite--LicenseKey` | `secrets.bicep` (credentials only; upload `GeoLite2-City.mmdb` separately — see [GeoLite2 setup](../geolite2_setup_readme.md)) |
| App Insights connection string (frontend telemetry) | `ConnectionStrings--ApplicationInsights` | `main.bicep` (derived) |

Externally-sourced secrets are seeded by [`secrets.bicep`](../../.infrastructure/secrets.bicep) from a gitignored
`secrets.<env>.bicepparam` (see [4 — Manual Bicep deployment](./4-deploy-bicep.md)); derived secrets come from `main.bicep`.

> The pipeline only *reads* `ConnectionStrings--PostgreSql` and `ConnectionStrings--ApplicationInsights` via the
> linked variable group. See [3 — Service connections & access](./3-service-connections-and-access.md#b-variable-groups-linked-to-key-vault).

## 7) Key Vault operator-access group

Human/operator access to each environment's Key Vault is granted to the Entra ID group **`VDAB-KeyVault-Access`**.
The Bicep template can assign this group the **Key Vault Secrets Officer** role (read/write/manage secrets — needed
to seed/rotate manual secrets such as `GeoLite--*`) via the optional `keyVaultAccessGroupObjectId` parameter. When
the parameter is empty (the default), no group assignment is made.

| Variable | Value | Notes |
|----------|-------|-------|
| `KEY_VAULT_ACCESS_GROUP_NAME` | `VDAB-KeyVault-Access` | Entra ID group granted Key Vault Secrets Officer. |
| `KEY_VAULT_ACCESS_GROUP_OBJECT_ID` | (look up — see below) | Passed to Bicep as `keyVaultAccessGroupObjectId`. |

Retrieve the group's object id once, then pass it on deployment:

```bash
# Bash
KEY_VAULT_ACCESS_GROUP_OBJECT_ID="$(az ad group show --group 'VDAB-KeyVault-Access' --query id -o tsv)"
echo "$KEY_VAULT_ACCESS_GROUP_OBJECT_ID"
```

```powershell
# PowerShell
$env:KEY_VAULT_ACCESS_GROUP_OBJECT_ID = (az ad group show --group 'VDAB-KeyVault-Access' --query id -o tsv)
$env:KEY_VAULT_ACCESS_GROUP_OBJECT_ID
```

Add `--parameters keyVaultAccessGroupObjectId="$KEY_VAULT_ACCESS_GROUP_OBJECT_ID"` to the
`az deployment group create` command in [4 — Manual Bicep deployment](./4-deploy-bicep.md). The assignment is
idempotent (the role-assignment name is derived from the group object id), so re-running deployments with the
parameter set is safe.

> Assigning roles requires your signed-in identity to have **User Access Administrator** or **Owner** on the
> `vdab` resource group — the same requirement as the App Service role assignments
> (see [2 — Azure setup](./2-azure-setup.md#2-permissions-you-need)).
