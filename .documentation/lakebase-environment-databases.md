# Lakebase Environment Databases

VDAB uses **Databricks Lakebase Postgres Autoscaling** branches as environment-specific databases.

| VDAB environment | Lakebase branch | Connection string location |
|------------------|-----------------|----------------------------|
| Local | N/A (local PostgreSQL) | `appsettings.Local.json` / AppHost |
| Staging (`xorbix-vdab-dev`) | **`staging`** | Key Vault `ConnectionStrings--PostgreSql` in `xorbixvdabdevkv` + ADO group `vdab-infrastructure-secrets-stg` |
| Production (`xorbix-vdab-prod`) | **`production`** | Key Vault in `xorbixvdabprodkv` + ADO group `vdab-infrastructure-secrets-prod` |

## Before pointing staging at the staging branch

The `staging` branch must contain the data shape you expect for testing. If it was created empty and never cloned from production:

1. List profiles and choose the workspace profile:

   ```bash
   databricks auth profiles
   ```

2. List branches:

   ```bash
   databricks postgres list-branches projects/<PROJECT_ID> --profile <PROFILE>
   ```

3. If the existing `staging` branch is disposable, create or reset from `production` only after explicit approval (destructive to current staging data):

   ```bash
   databricks postgres create-branch projects/<PROJECT_ID> staging \
     --json '{"spec": {"source_branch": "projects/<PROJECT_ID>/branches/production", "no_expiry": true}}' \
     --profile <PROFILE>
   ```

   Or use `reset-branch` per [Databricks Lakebase docs](https://docs.databricks.com/) if the branch already exists and has no children.

4. Get the endpoint connection details:

   ```bash
   databricks postgres list-endpoints projects/<PROJECT_ID>/branches/staging --profile <PROFILE>
   databricks postgres get-endpoint projects/<PROJECT_ID>/branches/staging/endpoints/<ENDPOINT_ID> --profile <PROFILE>
   ```

5. Build an Npgsql connection string (`sslmode=require`) and store it in:
   - Azure DevOps `POSTGRES_CONNECTION_STRING` in `vdab-infrastructure-secrets-stg`
   - Key Vault secret `ConnectionStrings--PostgreSql` for the staging Key Vault

## Production connection string

Use the **`production`** branch primary endpoint. Store in:

- `vdab-infrastructure-secrets-prod` → `POSTGRES_CONNECTION_STRING`
- Production Key Vault → `ConnectionStrings--PostgreSql`

## EF migrations

The pipeline runs `migrate.exe` with `POSTGRES_CONNECTION_STRING` from the variable group for the target environment. **Never** run staging migrations against the production branch or vice versa.

## Safety rules

- Do not delete the Lakebase `production` branch.
- Do not reset or overwrite `staging` without confirming no required test data will be lost.
- Verify connection strings in Key Vault after any branch or endpoint change.
