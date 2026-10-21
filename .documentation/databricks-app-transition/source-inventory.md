# Current-state inventory and disposition

This is an implementation map, not a deletion list. Source references were inspected on 2026-10-16.

| Area | Current evidence | Planned treatment |
| --- | --- | --- |
| Builder records | `Xorbix-Visual-Databricks-App-Builder.Models/EF/App.cs`, `.../AppComponent.cs`; `AppService.cs` requires owner/tenant/subscription and stores workflow/custom-module data. | Port app/component/workflow data to an install-local model and define a new standalone export schema. Do not reuse SaaS bundle compatibility. |
| Portability | `Models/DTOs/Portability/ExportBundleDto.cs` has schema version 1; `AppExportDto.cs` excludes identity/tenant/audit but includes workspace URL, child-app name/path, workflow, custom code, and components; `Services/AppImportExportService.cs` resolves owner and connection on import. | Behavior reference only. The separate product starts fresh and does not accept SaaS project bundles. It keeps export/import between standalone installs using a new format and resource reselection. |
| Builder HTTP | `Server/Controllers/AppController.cs`, `AppComponentController.cs`, `AppActionsController.cs`, `CodeController.cs`, `ComponentRegistryController.cs`. | Port API contracts slice by slice and strip tenant/subscription checks only after native authorization exists. |
| Designer/generator | `Services/ComponentRegistry/`, `Services/Workflow/`, `StreamlitTemplateService.cs`, `DeployService.cs`; emits `app.py`, `custom_modules.py`, `requirements.txt`, `app.yaml`, optional theme/library files. | Inventory every component/action, then port generator with golden output and executable child-app tests. |
| Databricks integration | `DatabricksApiService.cs`, `DatabricksAppProvisioningService.cs`, `DatabricksDataConnectorService.cs`, `DatabricksConnectionService.cs`. | Replace stored multi-workspace OAuth with native app/user authorization and own-workspace API calls. |
| AI | `AiBuilderService.cs`, `AiModelResolverService.cs`, `AiBuilderKernelFactory.cs`, `TenantAiModelService.cs`, `PlatformAiQuotaService.cs`. | Retain builder assistance with endpoints in the installed customer workspace; prove required scopes and remove SaaS quotas/tenant PAT model after parity. |
| SaaS backend | `BillingController.cs`, `StripeWebhookController.cs`, `IdentityController.cs`, `TenantController.cs`, `TenantInviteController.cs`, `ManagementController.cs`, related services/models/repos. | Remove at cutover after dependent builder types, policies, and UI are replaced. |
| Shared persistence | `DataAccess/ApplicationDbContext.cs` derives from Identity DB context and mixes builder, membership, billing, audit tables. | New store/schema for fresh projects; no SaaS data migration. |
| Frontend routes | `client/src/routes.ts`: `/apps`, `/apps/:appId`, `/databricks`, `/callback` plus SaaS signup/account/admin routes. | Keep app list/builder; remove account/admin routes after replacing providers/layout. |
| Frontend shell | `client/src/root.tsx`, `layouts/AuthenticatedLayout.tsx`, `providers/BaseApi.ts`, `config/section-sidebar.ts`. | Replace JWT/tenant/billing gates and token storage with Databricks App session behavior. |
| Client API | `client/src/providers/` still contains core builder HTTP calls, alongside `src/api/` and `src/hooks/`. | Move to resource API modules and TanStack Query hooks while switching contracts. |
| Hosting/CI | `AppHost/`, `MigrationService/`, `ServiceDefaults/`, `.infrastructure/`, `.pipelines/`, `.documentation/deployment/`, `readme.md`. | Replace SaaS hosting/CI in this repository after Databricks packaging is verified. Preserve the last working SaaS commit as a reference, not a runtime dependency. |

The builder controllers are protected by `RequireTenantMembership` and its JWT policy in `ServiceDefaults/AuthenticationExtensions.cs`. Builder records carry tenant and workspace connection IDs. `DatabricksApiService.cs` resolves a SaaS user/tenant/connection and stored OAuth token before Databricks calls. This dependency chain makes early deletion of billing, tenant, identity, or workspace-connection trees unsafe.

The starting Git status already contained a user deletion of the unrouted, unreferenced diagnostic page `client/src/pages/LoggerTestPage.tsx`. It was absent from `src/routes.ts` and had no imports or documentation references. This transition preserved that deletion and did not remove any migration-critical feature tree.

## Verification baseline (2026-10-16)

- Client `npm run build` exited 0. Vite reported existing large chunks and a mixed static/dynamic Plotly import warning.
- The initial client `npm test -- --run` exposed 10 test-harness failures: `useSubscription.test.tsx` lacked its mocked identity context, and `AppSettingsTab.test.tsx` lacked the same `ThemeProvider` wrapper used by the neighboring theme tests. Added those wrappers without changing application behavior. The focused rerun passed 15/15; the full rerun passed 278/278 across 44 files.
- `dotnet test Xorbix-Visual-Databricks-App-Builder.slnx --no-restore` exited 0: 905 passed, 6 skipped, 0 failed (911 total).
- `dotnet build Xorbix-Visual-Databricks-App-Builder.AppHost/Xorbix-Visual-Databricks-App-Builder.AppHost.csproj --no-restore` exited 0 with 8 warnings. Existing warnings include NU1608 version constraint mismatch, NU1902 AngleSharp, NU1903 Microsoft.OpenApi, NU1904 SemanticKernel, nullable warnings, and xUnit1051. These are baseline legacy-source risks, not transition changes.
- A disposable dependency-review lockfile for candidate `pg@8.23.1` and `@types/pg@8.23.1` passed `npm audit`: 0 vulnerabilities in the resolved graph. The packages were not added to the repository; see `dependency-approval-proposal.md`.

## Feature parity checklist to expand in step 1

- Canvas: layout, forms/inputs, tables/editable data, file upload, charts, dashboard embed, Genie/model chat, story visualizations.
- Actions: toast, modal, save to table, SQL build/run, binding, Databricks Job, prebuilt module, custom module.
- App lifecycle: create, edit, autosave, preview code, link existing child app, create child app, resource configuration, deploy/status/retry, and new-product import/export.
- Data: Unity Catalog browse, SQL warehouses, Jobs, serving endpoints, Genie spaces, Lakebase selectors and metadata.
- AI builder: prompts, tool calls, model selection, streamed progress, error handling, quota removal.
- Security: per-user access, audit, resource grants, secret handling, arbitrary custom code boundaries.

For each line, step 1 must record: exact existing endpoint and UI call, input/output schema, current tests, target identity, disposition (`keep`, `adapt`, `remove`), and an acceptance test.

## Step 1 expanded source and route inventory

The full 201-action legacy API map is in [`contracts/current-api-source-map.md`](./contracts/current-api-source-map.md). It records all 22 routed controllers and groups every action as retained/adapted, replaced, or SaaS-only. Run the documented `rg` command there after API changes and update the route inventory with the same change.

### Frontend routes and primary UI entry points

The current `client/src/routes.ts` declares these route families:

- Public/auth shell: `/` (`LandingPage`), `/login`, `/passwordless`, `/confirm-email`, `/reset-password`, `/confirm-email-change`, `/forgot-password`, `/verify-code`, `/signup`, `/beta-signup`, `/account-created`, `/accept-invite`, `/accept-invite/register`, `/set-password`.
- Status/setup: `/status`, `/account/setup/billing`, `/account/policy-acceptance`.
- Builder shell: `/apps` (`AppManagement`), `/apps/:appId` (`AppBuilder`), `/callback` (`DatabricksCallback`), `/databricks` (`DatabricksConnections`).
- Account shell: `/account`, `/account/profile`, `/account/sessions`, `/account/billing`, `/account/invoices`, `/account/activity`, `/account/team-activity`, `/account/seats`, `/account/seats/users/:userId`.
- Administration shell: `/administration`, `/administration/dashboard`, `/administration/health`, `/administration/tenants`, `/administration/tenants/new`, `/administration/tenants/:tenantId`, `/administration/auditlogs`, `/administration/stripe-events`, `/administration/users`, `/administration/users/:userId`, `/administration/users/:userId/edit`, `/administration/users/new`.

`/apps` and `/apps/:appId` are retained as primary builder routes. The standalone shell replaces login/signup/tenant/billing/admin guards with native Databricks app identity; `/databricks` becomes a current-workspace readiness page; the manual OAuth `/callback` flow is removed. Exact route component names are in `client/src/routes.ts`; sidebar and provider dependencies are in `client/src/config/section-sidebar.ts`, `client/src/layouts/AuthenticatedLayout.tsx`, `client/src/root.tsx`, and `client/src/providers/BaseApi.ts`.

### Source and contract counts

Counts below use tracked source paths rather than generated `bin`, `obj`, `node_modules`, or Vite build output:

| Boundary | Tracked source evidence | Current transition seam |
| --- | --- | --- |
| Server | 22 routed controllers, 201 `[Http*]` actions; plus `AuthenticatedControllerBase` | Builder endpoints require JWT tenant membership; controllers forward to SaaS services. See route map. |
| Services | 327 tracked `.cs` files | Includes `AppService`, `AppComponentService`, `AppActionService`, `AppImportExportService`, `StreamlitTemplateService`, `DeployService`, `DatabricksApiService`, `DatabricksConnectionService`, `DatabricksDataConnectorService`, AI services, component registry and workflow layers. |
| DataAccess | 64 tracked `.cs` files; 17 repository/interface pairs | `ApplicationDbContext` mixes builder records with identity, tenant, billing, and audit. |
| Models | 20 EF model/entity files; `DTOs/App`, `DTOs/AppComponent`, `DTOs/BuilderComponents`, `DTOs/AiBuilder`, `DTOs/DatabricksDataConnector`, `DTOs/Portability`, and `Workflow/` | App and workflow DTOs currently serialize `WorkspaceConnectionId` and SaaS owner/tenant fields. |
| Database history | 11 migration class/designer pairs plus model snapshot (23 migration `.cs` files) | Existing schema is SaaS state and is not reused or migrated into the standalone product. |
| Backend tests | 103 tracked test `.cs` files | 143 files appeared under a broad `rg` scan including non-tracked/build-generated sources; tracked count is the parity baseline. |
| Client | 44 tracked Vitest test/spec files; role-based flat `src/` tree | Builder API calls remain split between `src/providers/` and `src/api/`; current workspace IDs are threaded through selectors. |

Reproducible tracked-count source: `git ls-files` pathspecs for each project, plus `rg -n '^\s*\[Http(Get|Post|Put|Patch|Delete)' Xorbix-Visual-Databricks-App-Builder.Server/Controllers` for HTTP action attributes. A separate count including `[Route]` attributes is 223; the 201-action figure excludes those 22 route templates. Do not count generated artifacts as source.

### Contract and transitive dependency map

| Behavior | Current contract files | Client call sites | Dependencies to preserve or retire |
| --- | --- | --- | --- |
| App aggregate/create/update/delete | `.Models/DTOs/App/{AppDto,CreateAppRequest,UpdateAppRequest}.cs` | `client/src/providers/AppApi.ts`, wizard, app list and builder page | `AppService` → `IAppRepository`/`ApplicationDbContext`, owner/tenant/subscription/connection guards. Replace with `ProjectService` and Lakebase repository. |
| Component persistence | `.Models/DTOs/AppComponent/{AppComponentDto,UpsertAppComponentRequest,UpsertBatchRequest}.cs` | `client/src/providers/AppApi.ts`, `CanvasApi.ts` | `AppComponentService` → component repository/context. Preserve ordering, stable front-end correlation, child/layout/binding semantics. |
| Workflow data | `.Models/Workflow/WorkflowDefinitionModel.cs`, `WorkflowRouteModel.cs`, `WorkflowActionKind.cs`, `Workflow/Actions/`, `Workflow/SharedReferences/` | `client/src/types/workflow/`, workflow builder, validation utilities | Generators validate/parse graph then emit Streamlit code. Replace serialized `WorkspaceConnectionId` references with project-local resource keys and require re-resolution at import. |
| Component catalog/generation | `.Models/DTOs/BuilderComponents/`; `.Services/ComponentRegistry/Components/{Standard,Layout,Data,Charts,Embedding,Genie,Model,Stories}/`; `StreamlitTemplateService*` | `client/src/types/components/`, component editors, renderers | Preserve every definition, property schema, binding type and generated Python. Eight story services and renderers each retain an independent acceptance fixture. |
| Preview/deploy | `.Models/DTOs/GeneratedCodePreviewModels.cs`, `DeployAppFromFolderModels.cs`, deployment status models | `client/src/providers/CodeApi.ts`, `DatabricksApi.ts`, `AppActionApi.tsx`; code tab and publish/settings UI | `DeployService` and provisioning service currently obtain SaaS connection + stored token. Adapt to user-authorized current workspace; keep Python output, lifecycle, status, retry/recovery. |
| Databricks discovery | `.Models/DTOs/DatabricksDataConnector/` | `client/src/providers/DatabricksDataConnectorApi.ts`, resource selectors/hooks | `DatabricksDataConnectorService`/`DatabricksApiService` currently resolve workspaceConnectionId and a stored OAuth token. Replace with trusted runtime host plus forwarded user identity/scopes. |
| AI Builder | `.Models/DTOs/AiBuilder/`; workflow tool schemas | `client/src/providers/AiBuilderApi.ts`, model-selection hook, chat components | `AiBuilderService` → resolver/kernel/tool plugin plus tenant models and quota. Keep tools/streaming; replace provider, selected model persistence and caller identity. |
| Export/import | `.Models/DTOs/Portability/ExportBundleDto.cs`, `AppExportDto.cs`, `AppComponentExportDto.cs`, `ImportAppRequest.cs` | `client/src/providers/AppApi.ts` plus import/export UI | `AppImportExportService` strips SaaS identity but currently exports workspace URL/path and resolves tenant connection. Keep behavior only via the new `standalone-project-v1` schema; reject old bundles. |
| SaaS account/commercial | `.Server/Controllers/{Identity,Tenant,TenantInvite,User,Billing,Management,Reports,LegalPages,StripeWebhook}Controller.cs` and corresponding services/DTOs/repositories | Auth pages, account pages, billing providers, admin pages, tenant invite API | Retire only after project ACL, Databricks SSO, setup/recovery, audit and native deployment are implemented and tested. |

The detailed keep/adapt/remove table and test ownership are in [`feature-parity-matrix.md`](./feature-parity-matrix.md). The explicit target endpoint contract and fixtures are in [`contracts/http-v1.md`](./contracts/http-v1.md) and `contracts/fixtures/`.
