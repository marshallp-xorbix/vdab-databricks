# 7 — Add a Brand-New Environment

> **Legacy .NET/Azure deployment reference:** These instructions describe the former SaaS App Service deployment retained while transition gates remain open. They do not install or deploy the standalone Databricks App. Use [the standalone runbook](../../databricks-app/DEPLOYMENT.md) and [manual workspace checklist](../databricks-app-transition/manual-workspace-testing.md) for the new product.

Back to the guide index: [README.md](./README.md)

The end-to-end checklist for standing up a new VDAB environment from scratch. The running example adds **`stg`**;
substitute your environment short-name (`dev` / `stg` / `prd`, or a future one) for `<env>` throughout. It
assumes the shared resource group `vdab` and subscription already exist ([2 — Azure setup](./2-azure-setup.md)).

> If you are adding an environment whose short-name is **not** `dev`/`stg`/`prd`, first widen the allowed list:
> add it to `@allowed([...])` on the `environment` parameter in
> [`.infrastructure/main.bicep`](../../.infrastructure/main.bicep).
>
> Note: the pipeline promotes one build through a fixed dev → staging → prod chain. A genuinely new
> *position* in that chain (rather than a replacement) means adding a new deploy stage — see Step 2. Most of
> the time you are configuring one of the three existing environments, not adding a fourth.

## Step 1 — Bicep parameter file

Create `.infrastructure/main.<env>.bicepparam` (copy `main.stg.bicepparam` and adjust). Set at minimum:

- `param environment = '<env>'`
- `param frontendUrl = '...'` (custom domain, or `''` to use the default `*.azurewebsites.net` host)
- `param allowedOrigins = '...'` (custom domain + `https://xorbix-vdab-<env>.azurewebsites.net` + any localhost)
- `param jwtIssuer` / `param jwtAudience` (the public URL)
- `appServiceAlwaysOn` / SKU params, `deployCommunicationService`, Stripe values as appropriate
- Secret values are **not** set in this file — they are seeded separately via `secrets.<env>.bicepparam` (Step 5).

Validate it binds locally:

```bash
az bicep build-params --file .infrastructure/main.<env>.bicepparam --stdout >/dev/null && echo OK
```

## Step 2 — Pipeline wiring

In [`.pipelines/azure-pipelines.yml`](../../.pipelines/azure-pipelines.yml), add a deploy stage for the new
environment in the promotion chain (place it where it belongs in the order, `dependsOn` the previous stage):

```yaml
  - stage: Deploy_<Env>
    displayName: 🚀 Deploy <env> (approval)
    dependsOn: Deploy_<PreviousEnv>
    condition: and(succeeded(), ne(variables['Build.Reason'], 'PullRequest'))
    variables:
      - group: vdab-infrastructure-secrets-<env>
    jobs:
      - template: templates/deploy.yml
        parameters:
          environment: <env>
          serviceConnection: "vdab-<env>-service-connection"
          subscriptionId: $(subscriptionId)
          azureLocation: $(azureLocation)
          resourceGroup: $(resourceGroup)
          webAppName: "xorbix-vdab-<env>"
          bicepParametersFile: "main.<env>.bicepparam"
          postgresConnectionString: "$(ConnectionStrings--PostgreSql)"
```

The `Build` stage and the `deploy.yml` template are environment-agnostic and need no changes.

## Step 3 — Lakebase branch & connection string

- Create / choose the Lakebase branch for this environment and build its Npgsql connection string
  ([6 — Lakebase databases](./6-lakebase-databases.md)).
- Apply the required role grants on that branch.

## Step 4 — Azure DevOps prerequisites

- **Service connection** `vdab-<env>-service-connection`, scoped to the `vdab` resource group, granted
  **Contributor** + **User Access Administrator** ([3 — Service connections & access](./3-service-connections-and-access.md#a-service-connections)),
  plus **Key Vault Secrets User** on `xorbixvdab<env>kv` so the linked variable group can read secrets.
- **Key Vault-linked variable group** `vdab-infrastructure-secrets-<env>` exposing `ConnectionStrings--PostgreSql`
  and `ConnectionStrings--ApplicationInsights` from `xorbixvdab<env>kv`; authorize it for the pipeline.
  (Create this *after* Step 5, once the Key Vault and its secrets exist.)
- **Environment** `<env>`; add an **approval check** if this is a protected environment (and the prod higher-bar
  checks for a production-grade environment) — see [3 → Environments & approval gates](./3-service-connections-and-access.md#c-environments--approval-gates).

## Step 5 — First deploy: infrastructure, then secrets

Two manual steps ([4 — Manual Bicep deployment](./4-deploy-bicep.md)):

```bash
ENV="<env>"

# 1. Infrastructure — creates the Key Vault + derived secrets + App Service (no secret params).
az deployment group create --resource-group vdab \
  --template-file .infrastructure/main.bicep \
  --parameters ".infrastructure/main.${ENV}.bicepparam"

# 2. Seed externally-sourced secrets into that Key Vault (the real param file is gitignored).
cp .infrastructure/secrets.example.bicepparam ".infrastructure/secrets.${ENV}.bicepparam"
# Edit it: environment='${ENV}', seedJwtSecret=true, and the Postgres/Stripe/Databricks/GeoLite values.
az deployment group create --resource-group vdab \
  --template-file .infrastructure/secrets.bicep \
  --parameters ".infrastructure/secrets.${ENV}.bicepparam"
```

Now `JwtConfiguration--SecretKey`, `ConnectionStrings--PostgreSql`, etc. exist, so you can create the
**Key Vault-linked variable group** (Step 4) — it can only link secrets that already exist.

Before pipeline validation, complete [GeoLite2 IP geolocation setup](../geolite2_setup_readme.md): upload
`GeoLite2-City.mmdb` to the environment storage account's `geolite` container and confirm
`GeoLiteConfiguration:BlobUri` points to it.

Restart the App Service afterward so its Key Vault references and GeoLite configuration resolve.

## Step 6 — Deploy the app via the pipeline

Merge to `develop` to trigger a run (or re-run the latest). The new `Deploy_<Env>` stage runs in chain order;
approve its Environment gate if one is configured. Confirm:

- The app loads at `https://xorbix-vdab-<env>.azurewebsites.net`.
- Network calls reach the API; sign-in / DB access works (data lands only on this env's Lakebase branch).

## Step 7 — Custom domain (optional)

Bind the custom domain and certificate, and register its `/callback` in Databricks
([5 — Pipeline setup → Custom domain cutover](./5-pipeline-setup.md#custom-domain-cutover)).

## Step 8 — Documentation

- Add the environment to the tables in [README.md](./README.md), [1 — Overview](./1-overview.md), the root
  [`readme.md`](../../readme.md), and [`.infrastructure/readme.md`](../../.infrastructure/readme.md).

---

### Quick checklist

- [ ] `main.<env>.bicepparam` created and binds
- [ ] `Deploy_<Env>` stage added to the promotion chain in `azure-pipelines.yml`
- [ ] Lakebase branch + connection string + grants ready
- [ ] Service connection (Contributor + User Access Administrator + Key Vault Secrets User on the env vault)
- [ ] Environment created (+ approval / prod higher-bar if protected)
- [ ] First deploy done: `main.bicep` (infra) then `secrets.bicep` (seeded `JwtConfiguration--SecretKey` + `ConnectionStrings--PostgreSql` + …)
- [ ] GeoLite setup completed for the environment (`GeoLite2-City.mmdb` uploaded and `GeoLiteConfiguration:BlobUri` verified) — see [GeoLite2 setup](../geolite2_setup_readme.md)
- [ ] Key Vault-linked variable group created (exposes both `ConnectionStrings--*` secrets) + pipeline-authorized
- [ ] Pipeline deploy succeeded; app verified
- [ ] Custom domain bound + Databricks callback registered (if applicable)
- [ ] Docs updated
