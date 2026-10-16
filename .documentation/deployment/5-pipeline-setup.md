# 5 — Pipeline Setup & Operation

Back to the guide index: [README.md](./README.md)

The single pipeline [`.pipelines/azure-pipelines.yml`](../../.pipelines/azure-pipelines.yml) builds **one**
artifact and promotes it across dev → staging → prod. This doc covers wiring it up, operating it, and
troubleshooting.

Prerequisites: service connections, variable groups, and approval-gated Environments from
[3 — Service connections & access](./3-service-connections-and-access.md).

## One-time pipeline configuration

1. **Create / point the pipeline** at `.pipelines/azure-pipelines.yml`
   (**Pipelines → New pipeline → Azure Repos Git → Existing YAML file**). The existing VDAB pipeline already
   points here.
2. **Authorize resources.** On the first run (and the first time each environment is reached) you may see a
   "permission needed" banner — click **Authorize** to grant the run access to that variable group, service
   connection, and Environment.

## Stages

The pipeline runs the whole promotion chain in one run — there is no environment picker.

| Stage | What it does |
|-------|--------------|
| **🏗️ Build & validate** | Builds the environment-agnostic React SPA, embeds it into the API `wwwroot`, restores/builds/tests .NET, publishes one App Service zip + the EF migration bundle (`vdab-build`, `migration_bundle`), and validates the Bicep template + publishes `vdab-infrastructure`. Runs on every trigger, including PRs. |
| **🚀 Deploy dev** | Automatic (no approval). Deploys the artifact to `xorbix-vdab-dev`: Bicep what-if + deploy, app package, EF migrations. **Skipped on PR builds.** |
| **🚀 Deploy staging** | Waits on the **stg** Environment approval, then deploys the **same** artifact to `xorbix-vdab-stg`. |
| **🚀 Deploy prod** | Waits on the **prd** Environment approval (higher bar), then deploys the **same** artifact to `xorbix-vdab-prd` **via blue-green slot swap** (deploy to the `staging` slot → migrate → swap). See [8 — Production go-live](./8-production-go-live.md). |

Each deploy stage uses its environment's Key Vault-linked variable group (`ConnectionStrings--PostgreSql`) and
service connection. The build is environment-agnostic — there are no per-environment build inputs to set.

## Operating it

### dev (automatic)

Merge a PR into `develop`. The pipeline builds once and deploys `xorbix-vdab-dev` automatically, then holds at
the staging gate.

### staging (approval)

Open the running pipeline; the **Deploy staging** stage shows **waiting**. An approver clicks
**Review → Approve**, and the same artifact deploys to `xorbix-vdab-stg`. Validate / sign off.

### prod (higher-bar approval, blue-green)

After staging sign-off, approve the **Deploy prod** stage; the same artifact deploys to the prod `staging`
**slot**, migrations run, then the slot **swaps** into the live site (near-zero-downtime). As part of releasing,
merge `develop` → `main` (PR-reviewed) so `main` records what is in production — see
[1 — Overview → a note on `main`](./1-overview.md#a-note-on-main-and-the-production-gate). First-ever go-live
(standing up prod, moving `app.vdab.ai`/`app.vdab.io` off dev) is a one-time runbook:
[8 — Production go-live](./8-production-go-live.md).

> Several `develop` merges can leave multiple candidates queued at the gates. Approve only the one you intend
> to ship; abandon or cancel the superseded runs.

> The **first** deploy of stg or prd must be preceded by a one-time manual deploy that creates the
> infrastructure (`main.bicep`) and then seeds secrets (`secrets.bicep`) — see
> [4 — Manual Bicep deployment](./4-deploy-bicep.md). The pipeline only ever deploys `main.bicep`, so it never
> creates or overwrites Key Vault secrets.

## Custom domain cutover

After an environment deploys successfully at `https://xorbix-vdab-<env>.azurewebsites.net`:

1. **Portal → `xorbix-vdab-<env>` App Service → Custom domains → Add custom domain.**
2. Add `app.vdab.ai` (prd); create the validation CNAME/TXT DNS records as prompted.
3. Add a managed certificate (**TLS/SSL settings**) and bind it to the custom domain.
4. Confirm the domain is in that environment's `ApplicationConfiguration:AllowedOrigins`
   (it is, in the `.bicepparam` files) and that the matching `/callback` is registered in Databricks
   (see [1 — Overview](./1-overview.md#databricks-oauth-callbacks)).

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `Missing required... ConnectionStrings--PostgreSql` (migration step) | The secret isn't in `xorbixvdab<env>kv` (seed it — see [4](./4-deploy-bicep.md)), or the Key Vault-linked group doesn't expose it / isn't authorized for the pipeline. |
| Variable group **Authorize** (Key Vault link) does nothing, or the group fails to load secrets | The service connection principal lacks **Key Vault Secrets User** on `xorbixvdab<env>kv` — see [3 → prerequisite](./3-service-connections-and-access.md#prerequisite-let-the-service-connection-read-key-vault-secrets). |
| Deploy stages don't run on a PR | Expected — PR builds validate only (no deploy). |
| A deploy stage waits indefinitely | Its Environment approval is pending. Open the run → **Review** → approve. |
| `Environment '<env>' could not be found` | Create the Environment (`dev`/`stg`/`prd`) — see [3](./3-service-connections-and-access.md#c-environments--approval-gates). |
| `AuthorizationFailed` assigning roles in Bicep | The service connection lacks **User Access Administrator** on `vdab` — see [3](./3-service-connections-and-access.md#grant-the-connection-rbac-on-the-resource-group). |
| App starts but cannot reach the DB | `ConnectionStrings--PostgreSql` is missing/wrong in that env's Key Vault, or the Lakebase grants are missing — see [6](./6-lakebase-databases.md). |
| Key Vault name conflict | Key Vault names are globally unique; `xorbixvdab<env>kv` should be free. If taken, it may be soft-deleted — purge or pick another. |
