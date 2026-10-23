# 3 — Service Connections, Variable Groups & Approval Gates

> **Legacy .NET/Azure deployment reference:** These instructions describe the former SaaS App Service deployment retained while transition gates remain open. They do not install or deploy the standalone Databricks App. Use [the standalone runbook](../../databricks-app/DEPLOYMENT.md) and [manual workspace checklist](../databricks-app-transition/manual-workspace-testing.md) for the new product.

Back to the guide index: [README.md](./README.md)

This is the Azure DevOps side of the setup, and the part that enforces the **manual + approval** gating for
stg and prd. If this is your first multi-environment pipeline, read it top to bottom.

There are three things to create **per environment**:

1. A **service connection** (how the pipeline authenticates to Azure).
2. A **variable group** (per-environment secrets).
3. An **Environment** with an **approval check** (the gate that pauses stg/prd deploys until someone approves).

---

## A) Service connections

Each deploy stage passes its own service connection to the deploy template in
[`.pipelines/azure-pipelines.yml`](../../.pipelines/azure-pipelines.yml):

| Environment | Service connection used |
|-------------|-------------------------|
| dev | the existing connection (object id `ea0729b6-f3ef-4fe3-8e12-fba61b64a039`) |
| stg | `vdab-stg-service-connection` |
| prd | `vdab-prd-service-connection` |

> Because all environments share one subscription and resource group, you *could* point all three at one
> connection. **Separate connections for stg and prd are recommended** so production access is held by a
> distinct, least-privilege principal and can be authorized to the pipeline independently. If you reuse one
> connection, update the `value:` lines in the pipeline `variables` block accordingly.

### Create a service connection (stg, then repeat for prd)

1. **Project settings → Service connections → New service connection → Azure Resource Manager**.
2. Choose **Workload identity federation (automatic)** (preferred) or **Service principal (automatic)**.
3. Scope: **Subscription** `1691b7b4-…`, Resource group **`vdab`**.
4. Name it exactly `vdab-stg-service-connection` (or `vdab-prd-service-connection`).
5. Save.

### Grant the connection RBAC on the resource group

The Bicep template assigns roles (App Service → Key Vault / Storage), so the connection principal needs
**both** Contributor and User Access Administrator on `vdab`.

1. **Azure Portal → Resource groups → `vdab` → Access control (IAM)**.
2. In Azure DevOps, open the service connection → **Manage App registration** → on the app registration page
   open **Managed application in local directory** to reach the **Enterprise Application (service principal)**,
   and copy its **Object ID**.
3. Back in resource-group IAM, **Add role assignment → User Access Administrator** (Privileged administrator
   roles tab) → assign to the service principal by that Object ID.
4. Repeat: **Add role assignment → Contributor** to the same principal.
5. *(Recommended)* On the User Access Administrator assignment, add a **Condition → Constrain roles**, allowing
   only the roles the template assigns:
   - `Key Vault Secrets User`
   - `Key Vault Crypto User`
   - `Storage Blob Data Contributor`
6. **Review + assign.**

> Use the **Enterprise Application (service principal) Object ID** for the IAM member search. The service
> connection name or app-registration object id often will not resolve in the picker.

---

## B) Variable groups (linked to Key Vault)

Secrets live **only in Key Vault** — there are no values to paste or maintain in Azure DevOps. Each
environment's variable group is *linked* to that environment's Key Vault, so its variables are simply the
Key Vault secret names.

| Group | Linked Key Vault | Variables (= Key Vault secret names) |
|-------|------------------|--------------------------------------|
| `vdab-infrastructure-secrets-dev` | `xorbixvdabdevkv` | `ConnectionStrings--PostgreSql`, `ConnectionStrings--ApplicationInsights` |
| `vdab-infrastructure-secrets-stg` | `xorbixvdabstgkv` | `ConnectionStrings--PostgreSql`, `ConnectionStrings--ApplicationInsights` |
| `vdab-infrastructure-secrets-prd` | `xorbixvdabprdkv` | `ConnectionStrings--PostgreSql`, `ConnectionStrings--ApplicationInsights` |

Both secrets are created by Bicep: `ConnectionStrings--PostgreSql` (the Npgsql connection string for that env's
Lakebase branch — see [6 — Lakebase databases](./6-lakebase-databases.md)) and
`ConnectionStrings--ApplicationInsights` (App Insights, baked into the SPA at build). So the **Key Vault and its
secrets must exist before you create the linked group** — run the first manual Bicep deploy first
([4 — Manual Bicep deployment](./4-deploy-bicep.md)).

### Prerequisite: let the service connection read Key Vault secrets

When you create a Key Vault-linked variable group (a **Library** group), Azure DevOps asks you to pick an
**Azure subscription** — that dropdown is actually a list of **ARM service connections**. Pick this
environment's connection (`vdab-<env>-service-connection`); the group then reads secrets through that
connection's principal. That principal therefore needs **data-plane** secret access on the vault —
specifically **Get** and **List** on secrets. The Contributor / User Access Administrator roles from section A
are management-plane only and do **not** grant this.

Because the vaults use **RBAC authorization** (not access policies), "Get + List on secrets" is granted by the
built-in **Key Vault Secrets User** role. Assign it to the service connection principal on that environment's
Key Vault:

```bash
# SC principal = the same Enterprise Application object id used in section A.
SC_OBJECT_ID="<service-connection enterprise-app object id>"
az role assignment create \
  --assignee "$SC_OBJECT_ID" \
  --role "Key Vault Secrets User" \
  --scope "$(az keyvault show --name "xorbixvdab${ENV}kv" --query id -o tsv)"
```

> **The "Authorize" button frequently does not grant this for you.** In the Library UI, linking a Key Vault
> offers an **Authorize** action that is supposed to grant the connection access — but on RBAC-authorized
> vaults it often silently fails (it tries to write an access policy, which RBAC vaults ignore) or the signed-in
> user lacks rights to assign the role. When that happens, **assign the role manually** with the command above
> (or in the portal: **Key Vault → Access control (IAM) → Add role assignment → Key Vault Secrets User →** the
> service connection's Enterprise Application), then return to the Library page and retry. Allow a minute or two
> for the assignment to propagate before retrying.

### Create the linked group

1. **Pipelines → Library → + Variable group**; name it `vdab-infrastructure-secrets-<env>`.
2. Toggle **Link secrets from an Azure key vault as variables** ON.
3. **Azure subscription** — select this environment's **service connection** (`vdab-<env>-service-connection`).
   This dropdown lists ARM service connections, not raw subscriptions; the chosen connection is what reads the
   vault, which is why it needs **Key Vault Secrets User** (Get + List) from the prerequisite above.
4. **Key Vault name** — select `xorbixvdab<env>kv`. If you are prompted to **Authorize**, click it — but if it
   does nothing or errors, the role assignment is missing: apply the prerequisite role manually, wait a minute,
   and reselect the vault.
5. **+ Add** → select `ConnectionStrings--PostgreSql` and `ConnectionStrings--ApplicationInsights` → **OK**.
6. **Save**, then open **Pipeline permissions** and authorize the VDAB pipeline.

The pipeline references these as `$(ConnectionStrings--PostgreSql)` and `$(ConnectionStrings--ApplicationInsights)`.
Rotate or change a value **in Key Vault** and the next run picks it up automatically — nothing to update in
Azure DevOps.

> If the **Authorize** button on the Key Vault link appears to do nothing, the service connection principal is
> missing **Key Vault Secrets User** (Get + List on secrets) on that vault — apply the role assignment from the
> prerequisite above manually, then refresh and retry.

---

## C) Environments & approval gates

Azure DevOps **Environments** are what gate staging and prod. Each deploy stage targets an Environment named
`dev`, `stg`, or `prd`; any **approval check** on that Environment must pass before that stage runs. The
pipeline promotes one build through the chain, so approving staging then prod is how you advance a release
candidate.

### Create the Environments

**Pipelines → Environments → New environment** (Resource: **None**) for each:

- `dev`
- `stg`
- `prd`

### Add an approval check to `stg` and `prd`

1. Open the **`stg`** Environment → **⋮ → Approvals and checks → + → Approvals**.
2. Add the approver(s) (a person or group). Optionally disallow the requester from approving their own run.
3. Save. Repeat for **`prd`**.

Leave **`dev`** with no approval so merges to `develop` deploy automatically.

### Production "higher bar"

On the **`prd`** Environment, layer additional checks beyond a basic approval:

- **Approvals** — require more / different approvers than staging (e.g. a release manager), and disallow
  self-approval.
- **Business hours** — restrict prod deploys to a change window.
- **Exclusive lock** — prevent two prod deploys running at once.

> **Why not a "branch must be `main`" check on prd?** A branch-control check evaluates the *run's* source
> branch. Because we build once on `develop` and promote that same artifact, the prod deploy runs from a
> `develop`-sourced run — a `main`-only check would block every candidate. Instead, `main` is the production
> **record**: protect it with a PR policy and merge `develop` → `main` as part of releasing (see
> [1 — Overview → a note on `main`](./1-overview.md#a-note-on-main-and-the-production-gate)). If you want a hard
> `main`-only gate, that needs cross-run artifact promotion — ask and we'll wire it up.

### Protect the `main` branch

In **Repos → Branches → `main` → Branch policies**, require a minimum number of reviewers and a successful PR
build. This keeps the `develop → main` promotion reviewable, so what `main` records as production is auditable.

---

## Checklist

- [ ] `vdab-stg-service-connection` and `vdab-prd-service-connection` created and RBAC-assigned (Contributor + User Access Administrator on `vdab`).
- [ ] Each service connection principal granted **Key Vault Secrets User** on its env Key Vault (for the linked variable group).
- [ ] Variable groups `vdab-infrastructure-secrets-{dev,stg,prd}` created as **Key Vault-linked**, exposing `ConnectionStrings--PostgreSql` + `ConnectionStrings--ApplicationInsights`, and pipeline-authorized.
- [ ] Environments `dev`, `stg`, `prd` created.
- [ ] Approval check on `stg` and `prd`; prod higher bar (more approvers + business-hours + exclusive lock).
- [ ] `main` branch policy requires review (production record + hotfix base).

Next: [4 — Manual Bicep deployment](./4-deploy-bicep.md) (first deploy of each environment) and
[5 — Pipeline setup & operation](./5-pipeline-setup.md).
