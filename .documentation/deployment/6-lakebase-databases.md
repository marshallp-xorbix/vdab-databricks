# 6 — Lakebase Environment Databases

> **Legacy .NET/Azure deployment reference:** These instructions describe the former SaaS App Service deployment retained while transition gates remain open. They do not install or deploy the standalone Databricks App. Use [the standalone runbook](../../databricks-app/DEPLOYMENT.md) and [manual workspace checklist](../databricks-app-transition/manual-workspace-testing.md) for the new product.

Back to the guide index: [README.md](./README.md)

VDAB's backend database is **Databricks Lakebase (autoscaling managed PostgreSQL)**. Each Azure environment
points at its **own Lakebase branch**, so dev, stg, and prd never share data.

| Environment | Lakebase branch | Connection string lives in |
|-------------|-----------------|----------------------------|
| Local | — (local PostgreSQL via Aspire) | `appsettings.Local.json` / AppHost |
| dev | `dev` | Key Vault `xorbixvdabdevkv` → `ConnectionStrings--PostgreSql` |
| stg | `stg` | Key Vault `xorbixvdabstgkv` → `ConnectionStrings--PostgreSql` |
| prd | `prd` | Key Vault `xorbixvdabprdkv` → `ConnectionStrings--PostgreSql` |

> Branch names above are a recommended convention. Use whatever branch names exist in your Lakebase project,
> but keep one branch per environment and never cross them.

The connection string lives in **one place per environment** — the Key Vault secret
`ConnectionStrings--PostgreSql`. It is consumed by both:

- the **running App Service** (via a Key Vault reference in app settings), and
- the **pipeline's EF migration step**, via the Key Vault-linked variable group — so there is no separate copy
  to keep in sync.

## Preparing an environment's branch

Before pointing a new environment at a branch, make sure the branch holds the data shape you expect. If it was
created empty, you may want to clone it from another branch.

1. List profiles and pick the workspace profile:

   ```bash
   databricks auth profiles
   ```

2. List branches in the project:

   ```bash
   databricks postgres list-branches projects/<PROJECT_ID> --profile <PROFILE>
   ```

3. *(Optional, destructive — get approval first)* create a branch from an existing one:

   ```bash
   databricks postgres create-branch projects/<PROJECT_ID> stg \
     --json '{"spec": {"source_branch": "projects/<PROJECT_ID>/branches/dev", "no_expiry": true}}' \
     --profile <PROFILE>
   ```

4. Get the endpoint connection details:

   ```bash
   databricks postgres list-endpoints projects/<PROJECT_ID>/branches/<BRANCH> --profile <PROFILE>
   databricks postgres get-endpoint projects/<PROJECT_ID>/branches/<BRANCH>/endpoints/<ENDPOINT_ID> --profile <PROFILE>
   ```

5. Build an Npgsql connection string (`...;Ssl Mode=Require;`) for the branch primary endpoint and store it in
   the environment's Key Vault secret `ConnectionStrings--PostgreSql` by setting `postgresConnectionString` in
   `secrets.<env>.bicepparam` and running `secrets.bicep` — see [4 — Manual Bicep deployment](./4-deploy-bicep.md).
   The Key Vault-linked variable group exposes it to the pipeline automatically; there is no second copy to set.

## Database role grants

The role used by the connection string must be able to read/write VDAB's schema and run migrations. Apply the
required `GRANT`s for that Postgres role in the target branch's database. The grant patterns (CONNECT / USAGE /
SELECT/INSERT/UPDATE/DELETE / sequence + default privileges) are documented in
[autoscaling_lakebase_steps.md](../autoscaling_lakebase_steps.md) — the same SQL applies here, against VDAB's
own database/schema.

## EF migrations

The pipeline's **Execute EF Migrations** step runs `migrate.exe` with the connection string resolved from the
**target environment's** Key Vault secret `ConnectionStrings--PostgreSql` (via the linked variable group).
`migrate.exe` is idempotent — it applies only pending migrations.

> ⚠️ **Never** run one environment's migrations against another environment's branch. The variable group →
> environment mapping is what keeps them separate; each deploy stage uses its own environment's variable group,
> so confirm you are approving the intended stage (stg vs prd) before promoting.
> See [EF Core & database instructions](../data-access-ef-instructions.md) for migration commands and
> shared-database history caveats.

## Safety rules

- Do **not** delete the `prd` branch.
- Do **not** reset/overwrite a branch that holds data you still need (especially `stg` before sign-off).
- After any branch or endpoint change, update `ConnectionStrings--PostgreSql` in that environment's Key Vault
  (the only place it lives) and re-run a deploy so the App Service and migration step pick it up.
