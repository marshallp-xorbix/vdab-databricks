# 2 — Azure Setup (first time)

> **Legacy .NET/Azure deployment reference:** These instructions describe the former SaaS App Service deployment retained while transition gates remain open. They do not install or deploy the standalone Databricks App. Use [the standalone runbook](../../databricks-app/DEPLOYMENT.md) and [manual workspace checklist](../databricks-app-transition/manual-workspace-testing.md) for the new product.

Back to the guide index: [README.md](./README.md)

Prerequisites to create **once** before any environment can be deployed. Load the shared variables from
[0 — Shared variables & naming](./0-variables.md) first.

## 1) Subscription & resource group

All three environments share one subscription and one resource group (`vdab`).

```bash
az login
az account set --subscription "$AZ_SUBSCRIPTION_ID"

# Create the shared resource group if it does not exist (it already exists for dev today).
if [ "$(az group exists --name "$RG_NAME")" = "true" ]; then
  echo "Resource group exists: $RG_NAME"
else
  az group create --name "$RG_NAME" --location "$AZ_LOCATION"
fi
```

> Because dev, stg, and prd live in the same resource group, resource names are kept unique by the
> `xorbix-vdab-{env}` prefix. Deleting the `vdab` resource group would remove **all** environments — treat it
> with care.

## 2) Permissions you need

To run the **first manual Bicep deployment** of an environment (see [4 — Manual Bicep deployment](./4-deploy-bicep.md))
your signed-in identity needs, on the `vdab` resource group:

- **Contributor** — to create resources, **and**
- **User Access Administrator** (or **Owner**) — because the template assigns RBAC roles (App Service →
  Key Vault and Storage). Plain Contributor cannot assign roles.

The Azure DevOps service connection needs the same two roles; that setup is in
[3 — Service connections & access](./3-service-connections-and-access.md).

## 3) Region & resource providers

The templates deploy to `northcentralus`. Ensure these resource providers are registered on the subscription
(they usually are):

```bash
for ns in Microsoft.Web Microsoft.KeyVault Microsoft.Storage Microsoft.Insights \
          Microsoft.OperationalInsights Microsoft.Communication; do
  az provider register --namespace "$ns"
done
```

## 4) Custom domains (prd only)

`app.vdab.ai` is bound to its App Services **after** the first successful deployment.
See [5 — Pipeline setup & operation](./5-pipeline-setup.md#custom-domain-cutover) for the cutover steps. Until a
custom domain is bound, each environment is reachable at `https://xorbix-vdab-<env>.azurewebsites.net`.

## Next

- Create the Azure DevOps service connection, variable groups, and approval-gated Environments →
  [3 — Service connections & access](./3-service-connections-and-access.md).
- Or do the first infrastructure deploy by hand → [4 — Manual Bicep deployment](./4-deploy-bicep.md).
