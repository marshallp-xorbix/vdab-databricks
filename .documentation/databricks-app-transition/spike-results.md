# Databricks feasibility spike results

**Date:** 2026-10-16.  
**Status:** Not run; no spike passed. The user has explicitly instructed that no workspace connection be made at this time.  
**Do not interpret documentation evidence or a local build as a live Databricks result.**

**Generated Lakebase offline slice (2026-10-21):** The user approved exactly `asyncpg==0.32.0`. Generated Lakebase Autoscaling reads/writes now pass against disposable local PostgreSQL 17, including DataWindow, four charts, all eight story readers, workflow `RunSql`, `SaveToTable`, viewer-role table denial, and parameterized write persistence. This does not pass Spike B: no Databricks resource was bound, no user credential was exchanged, no viewer role/scope was tested, and no restart/redeploy durability test ran in a workspace. It also does not pass Spike C: generated Streamlit was not deployed and the target Python 3.11 installation was not tested.

**Existing Provisioned compatibility slice (2026-10-21):** The local fake-runtime harness now executes all 13 generated visual readers, the EditableDataWindow read/write path, and workflow BuildSql → RunSql → SaveToTable for an existing Provisioned binding. It verifies the caller token/email, instance host binding, credential exchange, TLS settings, parameterized transactional writes, missing identity, permission denial, and no service-principal fallback. This does not change Spike B or C status: no Databricks resource/API was contacted, no installed-app OAuth/role behavior was observed, and no deployed Streamlit runtime or Python 3.11 installation was exercised.

**Official documentation recheck:** 2026-10-21. Databricks documents the Lakebase Autoscaling app resource, the `postgres` user scope, endpoint-form OAuth credential requests, and Python 3.11 for pip-based Apps. Those contracts align with the local implementation but do not establish workspace authorization, user PostgreSQL grants, child-App deployment, or Marketplace installation. Current links and limits are recorded in `research.md`.

**Read-only documentation recheck:** 2026-10-20. No workspace access was attempted. The current Apps authorization guide lists API scopes (`apps`, `files`, `genie`, `model-serving`, `postgres`, `sql`, and others) plus catalog SDK scopes, but still omits a `jobs` scope, `scim`, and `identity`. The direct Volumes API's `unity-catalog` scope is still absent from that Apps list. The current Lakebase guide documents binding grants/variables and redeploy durability. The Marketplace provider guide documents public-provider enrollment through the Databricks Data Partner Program, but does not establish VDAB eligibility or app publication. These documentation findings do not change any live spike status below.

**Apps lifecycle API cross-check:** The current official [Apps API reference](https://docs.databricks.com/api/apps/v1/app) labels Create App (`POST /api/2.0/apps`) and Create App deployment (`POST /api/2.0/apps/{app_name}/deployments`) with the `apps` API scope and describes `user_api_scopes` plus resource bindings in the app model. The current [App Spaces guide](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-spaces) documents `CAN CREATE APP` for app development in a space and `CAN MANAGE` for space settings. This is enough to make the G2 experiment precise, but remains documentation-only: no forwarded-token create, bind, upload, deploy, status, rollback, non-admin, or denied-user result was observed. If the workspace uses App Spaces, record the relevant space permission as part of the test.

**Apps scope and Marketplace route refresh — 2026-10-21:** Current official authorization docs document the `apps` user scope and consent; the Apps API exposes create/deployment, while Workspace Import uses a separate `workspace` scope and has a 10 MB per-file limit. G2 must test the selected source-upload method as well as app create/deploy. The App Spaces guide documents admin-controlled scopes/roles and `CAN CREATE APP`. Current Marketplace consumer docs explicitly describe third-party App vendor submission, comprehensive security review, consumer installation with scope/resource setup, and notices for new versions. Public providers apply through the Data Partner Program; private-exchange-only signup is available in the provider console for an account admin. This narrows the documentation gap but does not establish VDAB's eligibility, exact App submission channel, review acceptance, paid App purchase/entitlement mechanics, or a successful VDAB install/update. No spike status changed; no partner contact or workspace operation was made. See `research.md` for current sources and limits.

**App Space child-App slice — 2026-10-21:** The first-party CLI documents `apps create --space`; its implementation maps this flag into `apps.App.Space` before calling the generated Apps SDK, whose `App` model contains JSON field `space`. The published Apps API schema currently omits that field, so treat SDK/CLI evidence as a documented contract with a manual workspace confirmation still required. VDAB now reads the installed builder App's space with `DATABRICKS_APP_NAME`, sends that value when creating a child App, requires linked/recovered apps to match it, and validates effective user scopes when present. Focused local server and client tests passed; no Databricks connection was made. This does not pass Spike A or G2, and no workspace permission or App Space result is claimed.

## Environment and starting state

- Local Databricks CLI: `0.295`.
- Configured profile: `patrick.marshall@xorbix.com` at `https://dbc-bc2a5dd3-798c.cloud.databricks.com` (workspace ID `1655539421928636`).
- The CLI configuration identifies a workspace, but does not establish it as disposable. No disposable target has been confirmed.
- The stored refresh token is invalid. The CLI recommends reauthentication with `databricks auth login --profile patrick.marshall@xorbix.com`.
- No Apps API call, deployment, resource binding, OAuth consent check, Lakebase write, generated-app test, or Marketplace install was reached. No token was captured or added to the repository.
- On 2026-10-16 the user said there is no disposable workspace available and instructed: “dont connect or anything now, just build the app”. Continue offline. Do not retry the configured CLI profile or contact any workspace until the user provides a disposable target and requests it.

## Commands and observed results

| Command                                                            | Result                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `databricks auth describe --profile patrick.marshall@xorbix.com`   | Exit 0 for local configuration display, with `Unable to authenticate: A new access token could not be retrieved because the refresh token is invalid.` The host/workspace/profile are configured; credentials are unusable. |
| `databricks current-user me --profile patrick.marshall@xorbix.com` | Exit 1: `A new access token could not be retrieved because the refresh token is invalid.` No workspace identity was returned.                                                                                               |
| `databricks auth token --profile patrick.marshall@xorbix.com`      | Failed before token retrieval because the refresh token is invalid. No token value was returned.                                                                                                                            |
| `databricks apps list --profile patrick.marshall@xorbix.com`       | Failed at authentication before the Apps API was reached. No app inventory or API behavior was observed.                                                                                                                    |

## Spike A — identity and child-app deployment

**Status:** Not run; authentication and disposable-target gates unmet.

- Official documentation confirms that Databricks Apps can forward a scoped user token and supports the `apps` scope. Apps exposes create/deployment API operations. Those docs do not prove that a Marketplace-installed VDAB instance may create, bind, upload, and deploy a child App as a non-admin user.
- Workspace source upload is a distinct authorization question: the Workspace Import API documents a separate `workspace` scope and a 10 MB per-file limit. Test the chosen file/Git deployment path under the actual installed-App scope policy; do not infer upload authority from `apps` scope alone.
- No app was created, no user role was exercised, and no scope/permission response was observed.
- Before the live operation, inspect the target workspace's App Space setup (if enabled) and record whether the test user has `CAN CREATE APP`; separately record app-level scopes/resource binding privileges. Do not treat one of these checks as a substitute for successful and denied API-path tests.
- The official Apps authorization guide identifies Jobs as a typical user-authorization use case, while its supported scope list omits `jobs`. Exact Jobs authorization is an open spike question for the builder and generated apps.
- Required next experiment: reauthenticate, confirm this workspace is disposable or provide another disposable profile, then run create/link/deploy under a representative non-admin user and a denied user, with app identity permissions deliberately greater than the denied user's permissions to prove no fallback.

## Spike B — Lakebase binding and durability

**Status:** Not run; no workspace access or database binding was attempted.

- Official documentation says Apps can bind an existing Lakebase Autoscaling resource and the service principal receives database access through the resource binding; adding/binding the resource requires appropriate project management permission. This does not prove Marketplace installation can create/provision the resource.
- No database, project, schema, role, migration, or persistence test was created.
- Required next experiment: in the confirmed disposable workspace, bind an existing test Lakebase resource, initialize schema, write a disposable project, restart/redeploy, and verify persistence and app service-principal grants.

## Spike C — AI and generated child app

**Status:** Not run; no workspace endpoint or generated child App was exercised.

- Official scope documentation lists `model-serving`, `ai-gateway`, `sql`, `genie`, `files`, `postgres`, and catalog SDK scopes. Actual endpoint-level grants and a viewer's consent/permissions remain untested.
- No AI request, streamed tool call, generated Streamlit app, SQL query, Job operation, two-viewer permission comparison, dependency install, or no-fallback check ran.
- The `jobs` scope gap must be resolved with a supported API/SDK path and live authorization evidence before Jobs parity can be declared.

## App Space response fail-closed update — 2026-10-21

The Apps REST response schema and examples do not show `space`, but the SDK model has the field. The parser now rejects a returned App object with no `space` property; only an explicit null/empty value is interpreted locally as unspaced. This blocks all child-App mutation when the response shape cannot establish the installed App's space. No workspace call was made; confirm the actual installed response shape and meaning of null before treating either App Space or default-workspace deployment as verified.

## Spike D — Marketplace provider and consumer path

**Status:** Not run; external Databricks partner/provider action required.

- Current consumer documentation explicitly describes third-party Apps, vendor submission followed by comprehensive security review, consumer configuration of resources/scopes, and notices when new versions are available. This is the general App lifecycle; VDAB has not been submitted or installed.
- Public provider onboarding uses the Data Partner Program; private-exchange-only signup is through the provider console for an account admin. The docs do not establish VDAB's eligibility, exact App submission channel/review acceptance, paid App purchase or entitlement mechanics, or a complete update/rollback test.
- No listing, preview package, Marketplace installation, update, or entitlement signal was exercised.
- Required next external action: confirm VDAB eligibility and the App submission channel, submit and pass security review, record approved distribution/commercial terms, then execute a second-workspace install/update/rollback before claiming Marketplace readiness.

## Additional official documentation review (read-only)

Checked 2026-10-16 by an independent research agent; no repo edits or Databricks workspace/API/CLI operations were performed. Current docs confirm Node.js 22.16, app environment variables, `app.yaml`, build/install behavior, forwarded user auth, Lakebase Autoscaling resource binding and credential rotation, existing Apps create/deploy APIs, and a Marketplace third-party Apps consumer workflow. This changes the earlier research note: the consumer workflow is documented, but it does not prove VDAB provider eligibility or successful VDAB install/update. Official docs do not settle whether a Marketplace-installed VDAB can create/deploy child Apps with forwarded user permissions, nor the full Apps + Node Lakebase binding path. Spike A/B remain unverified.

Sources: [Apps environment](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env), [App runtime](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime), [Deploy](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy), [Lakebase Apps resource](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase), [Node Lakebase credentials example](https://docs.databricks.com/aws/en/oltp/projects/external-apps-manual-api), [Marketplace consumer](https://docs.databricks.com/aws/en/marketplace/get-started-consumer), [provider onboarding](https://docs.databricks.com/aws/en/marketplace/become-provider).

## Documentation sources checked

- [Databricks Apps authorization and supported scopes](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth) (updated 2026-10-09)
- [Create App API](https://docs.databricks.com/api/apps/v1/create-app)
- [Create deployment API](https://docs.databricks.com/api/apps/v1/create-app-deployment)
- [Databricks Apps resources](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources)
- [Lakebase resource for Apps](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase)
- [Marketplace consumer guide](https://docs.databricks.com/aws/en/marketplace/get-started-consumer)
- [Marketplace provider guide](https://docs.databricks.com/aws/en/marketplace/become-provider)

Documentation research is not a substitute for the workspace experiments above.

**Official documentation recheck — 2026-10-22 (read-only):** The AWS Apps authorization guide remains last updated 2026-10-09 and lists API scopes `ai-functions`, `ai-gateway`, `apps`, `files`, `genie`, `model-serving`, `postgres`, `sql`, `vector-search`, and `sql:restricted-query`, plus SDK scopes `catalog.catalogs`, `catalog.connections`, `catalog.schemas`, `catalog.tables`, and `workspace.workspace` with documented `:read` variants. It still does not list `jobs`, `scim`, or `identity`; direct Unity Catalog Volumes scope compatibility remains unresolved. The App Spaces guide is marked Beta and remains last updated 2026-09-28; its Data + AI preset lists 11 scopes, including `mcp.external` and `mcp.functions`, and `CAN CREATE APP` permits app development in a space. This is consistent with the current offline validator and runbook but does not prove that the installed VDAB App can perform these operations. The current Lakebase Apps guide continues to document both Autoscaling and existing Provisioned resources; Marketplace provider documentation still describes generic provider onboarding and does not establish VDAB eligibility or the App submission path. Sources: [Apps authorization](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth), [App Spaces](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-spaces), [Lakebase App resources](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase), and [Marketplace provider onboarding](https://docs.databricks.com/aws/en/marketplace/get-started-provider). No workspace, CLI profile, Marketplace console, or provider team was contacted.

## Offline implementation update — 2026-10-21

The user approved exactly `asyncpg==0.32.0` for generated child-app requirements and local verification. The generated Lakebase Autoscaling reader/writer paths now locally execute DataWindow, all four charts, all eight stories, workflow `RunSql`, and workflow `SaveToTable`. The Node integration runner created a disposable local PostgreSQL 17 cluster, passed the migration integration test and generated workflow read/write plus viewer-denial checks, executed all 13 generated reader queries, and shut the cluster down. This is local implementation evidence only; it does not close Spike B or establish Apps OAuth scopes, viewer PostgreSQL roles/grants, Lakebase binding durability, or generated Streamlit execution.

Official docs rechecked the `apps` scope for Apps create/deployment APIs and the separate `workspace` scope for Workspace Import, which has a 10 MB per-file content limit. API documentation does not prove an installed VDAB instance is authorized to create another App. Spike A was not run. The user explicitly said there is no disposable workspace and not to connect; no Databricks CLI/auth/API/workspace action occurred. Spike D/provider eligibility and Marketplace consumer install also remain external and unverified. See `research.md` and `progress-and-handoff.md` for sources, full commands, and test counts.

**Optional child-App SQL warehouse binding (2026-10-21):** The official Create App API, Apps resource guide, and environment-variable guide document existing SQL warehouse resources, `CAN_USE`, custom resource keys, and `valueFrom` resolution. VDAB now locally derives and persists this resource for generated features requiring the installed-workspace default; explicit BuildSql selections remain independent. Focused local tests are followed by the full local regression. No Databricks workspace was contacted; the configured default, resource acceptance/injection, viewer grants, and SQL behavior remain manual tests.
