# Standalone SaaS UI parity plan

## Direction update — 2026-10-27

The user clarified that the Databricks installation should use the **same retained React frontend** as the SaaS app, with only small product-specific changes. The reference implementation is already in this repository: `src/pages/AppManagement.tsx`, `src/pages/AppBuilder.tsx`, the legacy create wizard, and their shared builder components. Do not treat the newer `ProjectManagementPage.tsx` / `ProjectEditorPage.tsx` layouts as visual replacements for those pages.

The next implementation must route the Databricks runtime through the retained React screens and adapt their data/API boundaries to the Node `/api/v1` project and workspace contracts. Preserve the existing SaaS build behavior. Keep Databricks-only changes limited to install-local project identity and access, workspace-scoped resource binding, project portability, and child-App deployment/readiness. SaaS login, tenant administration, billing, and manual workspace credentials remain excluded.

The present standalone route still selects the lower-fidelity project pages. The earlier “local implementation completed” status below describes that first pass only; it is **superseded** by this direction update. Exact React-screen parity and the backend adapters are not complete until the retained pages run against the Databricks APIs and are browser-verified.

**Earlier status — 2026-10-28, snapshot 044 (superseded below):** The standalone runtime uses install-local project APIs and retained SaaS React building blocks; it does not connect to SaaS APIs. Snapshots 036–038 split the route graphs, connect retained page theme controls to version-guarded Lakebase persistence, and add accessible component palette buttons. Snapshot 040 adapts Unity Catalog and Lakebase pickers to the current workspace APIs. Snapshot 041 handles Lakebase's empty terminal pagination response. Snapshot 042 resolves Lakebase metadata calls to a readable branch endpoint. Snapshot 043 passes the actual database resource ID (`databricks-postgres`) to that resolver. Snapshot 044 allows Lakebase column metadata's `nullable` boolean in Amoeba component save and preview validation; the previous strict parser rejected this field and returned HTTP 400. Live verification on a fresh tab reached `VDAB Sandbox` → `production` → `databricks_postgres`, listed schemas (`__db_system`, `public`), listed tables in `public`, and loaded `vdab_projects` columns into the story field mapper. Snapshot 044 was running successfully. At that point, a live component-save retest in the approved parity project was pending. The full client suite then had 482 tests: 445 passed, 37 failed, including editor tests with an outdated journey assumption and selectors using the old `Current-workspace catalog` label. That was an earlier test state, superseded by the focused checks noted below. Full SaaS page and behavior parity remains incomplete.

**Latest status — 2026-10-28, snapshot 046 active:** The first live Amoeba Story autosave after snapshot 044 exposed a contract mismatch: root components were sent with a `{ y: 0 }` layout although the backend requires root Story/embed components to persist with `layout: null`. Snapshot 045 introduced the root-null layout and activated successfully, but exposed that the browser's root drag order must be stored in the component array; snapshot 046 fixes that ordering while retaining null root layouts. Snapshot 046 (`01f1d317ff1e1025abb4416fd3cac8f6`, `/Workspace/Users/patrick.wayne.marshall@gmail.com/.vdab/builder/vdab-builder-sandbox-20261028-root-layout-fix-046`) is RUNNING with ACTIVE compute. In project `VDAB UI parity verification` (`4ea2115c-f27d-468d-afb6-9e49875a2f83`), the added Amoeba Story persisted. Live Lakebase selection reached `VDAB Sandbox` → `production` → `primary` → `databricks_postgres` → `public` → `vdab_projects`; column metadata loaded in the mapper, and the final component PUT returned HTTP 200. An earlier intermediate selector attempt returned HTTP 400 while endpoint/database metadata was incomplete; completing the ordered picker flow saved successfully. This was an additive project component/binding write in the sandbox only. Focused client checks pass: 5 files, 9 tests. The latest package build passed backend typecheck, 484 backend tests (483 passed, 1 skipped), and packaged smoke checks. The previous full client run was 113 files / 482 tests with 478 passing and 4 failing; those four were stale assertions from before the root-layout adjustment. Exact full-app SaaS screen and behavior parity remains incomplete; do not treat this component-flow success as parity acceptance.

**Sandbox functional follow-up — 2026-10-28:** After the Lakebase-bound Amoeba Story save, the field mapper was configured with `entityId=id`, `entityLabel=name`, `category=workspace_id`, and the `version` column for numeric metrics. The preview rendered its documented sample-data visualization; this verifies the preview path, not a query against live table rows or generated child-app behavior. The Code section loaded its file tree and editor. With the `databricks-gpt-oss-20b` workspace Serving endpoint, the AI Builder produced the proposal to add a label and applied it to the draft; after a full page reload, `Sandbox AI proposal check` remained present in Main Page, confirming durable project save. These were additive writes in the approved test project. No child App was deployed. Snapshot 046 remains the active release; the full retained-SaaS screen and behavior parity effort is not yet complete.

### 2026-10-28 sandbox follow-up — snapshots 040–043

- 040 — `01f1d3012a7a1025aa3ad3cc19202f3f`, `/Workspace/Users/patrick.wayne.marshall@gmail.com/.vdab/builder/vdab-builder-sandbox-20261028-workspace-resource-pickers-040`: connect current-workspace Unity Catalog and Lakebase resource pickers.
- 041 — `01f1d3025a7c1b35879d577a4c8c3b5a`, `/Workspace/Users/patrick.wayne.marshall@gmail.com/.vdab/builder/vdab-builder-sandbox-20261028-lakebase-picker-pagination-041`: accept Lakebase's empty trailing page after a page token.
- 042 — `01f1d30312ea1688b973424f0e9596e7`, `/Workspace/Users/patrick.wayne.marshall@gmail.com/.vdab/builder/vdab-builder-sandbox-20261028-lakebase-metadata-endpoint-042`: resolve metadata reads through a branch's read-write endpoint. The original open browser tab retained its earlier client bundle, so it showed a stale error until a fresh tab loaded the active snapshot.
- 043 — `01f1d3044ecf10da81bb7a040a86b5d5`, `/Workspace/Users/patrick.wayne.marshall@gmail.com/.vdab/builder/vdab-builder-sandbox-20261028-lakebase-resource-id-043`: resolve the database's `databricks-postgres` resource ID separately from the SQL name `databricks_postgres`. The live picker lists schemas and tables and supplies selected table columns to the mapper. All four immutable source folders and deployment records are retained.
- 044 — `01f1d3064da311098f102cf442ca46a9`, `/Workspace/Users/patrick.wayne.marshall@gmail.com/.vdab/builder/vdab-builder-sandbox-20261028-lakebase-nullability-044`: accept and validate the Lakebase metadata `nullable` field in the Amoeba save and preview column readers. At snapshot 044 deployment time the live component save was still pending; the subsequent snapshot 046 test and save is recorded above.
- The parity test project had an earlier saved baseline of `Workspace name` plus its nested `Columns` input, at 730px width. The Amoeba Story and AI label added during approved live testing are now saved in this project, as recorded in the latest status above. No project, component, schema, or workspace resource was deleted.

## Live reference observations — 2026-10-27

Read-only browser review of the signed-in SaaS app confirmed the builder chrome contains a branded app header, a left `Canvas` / `Workflow` / `Code` / `Settings` navigation, and a shared toolbar with `Prompt`, `Save`, `Deploy`, `Refresh`, and compute status/start controls. The Canvas opens a React Flow page graph; opening `Main Page` shows a searchable, categorized component palette, a central page canvas, and a right properties panel. The Code section contains a `.streamlit`/file tree and an editable Monaco editor. `Prompt` opens an AI Builder drawer that remains available across sections. Settings has `App Details`, `App Theme`, `Resources`, and `Permissions` subtabs.

Browser review of snapshot 019 confirmed the VDAB logo in the shell, the App Flow graph as the default editor screen, the Add Page/Modal panel, the retained SaaS component palette/properties adapted to project persistence, Monaco Code view with generated files and custom module editing, and Prompt drawer. The Code tree is still generated from the standalone preview contract and does not yet reproduce every SaaS file operation. SaaS Settings has four subtabs; the local update reuses `AppThemeTab` and adds App Details, App Theme, Resources, and Permissions tabs. The standalone wizard intentionally omits workspace selection and starts with app details because this installation already fixes the workspace.

The 2026-10-28 live comparison verified the App Flow graph, component palette, Workflow screen, Code file tree, theme controls, and Permissions card styling against the signed-in SaaS staging app. Snapshot 037 now shows the same page-width control in the Main Page properties rail and persists it through the Databricks project API. Snapshot 033 displays the current user's email when Databricks' trusted user ID matches the project owner; otherwise it preserves the owner ID. Collaborator lookup remains read-only because Databricks Apps' supported user-authorization scope list does not include the SCIM scope required for the SaaS directory picker. The create wizard has two steps (app details and review) instead of the SaaS three, because workspace selection and SaaS Databricks-app linking do not apply to this installation. Functional differences remain: Resources manages child-App deployment/readiness rather than the builder App's workspace grants; Permissions manages creator/editor project access instead of SaaS owner/viewer roles; and AI uses a workspace Serving endpoint plus proposal application instead of SaaS model selection and usage metering. Settings omits SaaS workspace-connection fields by design.

Snapshots 020–022 add caller-authorized workspace App status/start/stop routes using the supported Databricks Apps API, and a toolbar control that only becomes actionable for a project with a linked child App. No child App was started or stopped during verification. Snapshot 021 also fixed the editor height at the active Databricks browser size; 023 restores the SaaS Properties rail width; 024 fits toolbar actions; 025 aligns the initially visible canvas tabs with SaaS. Live verification on 025 shows the full-height App Flow graph and correct initial `App Flow`-only tab state.

The Databricks product equivalents need to keep install-local projects, current-workspace authorization, Lakebase persistence, and child-App deployment. Live acceptance is checked against the signed-in SaaS staging reference and sandbox app; comparisons are read-only in SaaS.

## Goal

Restore the familiar VDAB builder experience in the installed Databricks App while retaining the standalone Node/Lakebase contracts and workspace-scoped authorization. The legacy React client is the source of truth for layout and interaction patterns; legacy SaaS APIs, identity, billing, tenant administration, and workspace connection management are not runtime dependencies of the installed app.

## Source inventory

The former SaaS React implementation remains in `xorbix-visual-databricks-app-builder.client/src/pages/AppManagement.tsx`, `src/components/CreateAppWizardDialog.tsx`, and `src/pages/AppBuilder.tsx`, with the canvas, code tab, workflow editor, settings, and AI chat under `src/components/AppBuilderComponents/`. These files are valid visual/interaction references. The active Databricks route intentionally avoids SaaS app and auth APIs.

The standalone routes continue to use `ProjectManagementPage.tsx` and `ProjectEditorPage.tsx`, backed by standalone project APIs. The parity implementation adapts existing standalone capabilities and retained SaaS visual components; it does not bring SaaS persistence or identity back into the runtime. The project route is not a direct invocation of legacy `AppBuilder`, which still owns SaaS API and persistence assumptions.

## Target interaction map

1. **Apps home:** searchable project cards, status/last-edited details, a prominent Create New App action, import/export that uses standalone project portability, and a guided project creation flow.
2. **Builder shell:** branded header and project name; familiar Canvas, Main Flow, Code, and Settings navigation; responsive left component palette, central canvas, and right properties panel; save/preview/deploy status visible without leaving the builder.
3. **Canvas:** add components from the palette, select and configure them, drag/drop and reorder compatible siblings, preserve nested layout containers, and provide empty/loading/read-only/error states.
4. **Main Flow:** retain the existing React Flow workflow editor and custom-module/AI Builder capabilities, wired only to `/api/v1` and workspace resource APIs.
5. **Code:** show generated project files in a Monaco editor, read-only for generated files; provide editable custom Python modules with explicit save/reload and unsaved-change handling.
6. **Settings:** retain project metadata, project access, resource bindings, preview, and child-App deployment/readiness/history. No SaaS login, tenant, subscription, payment, or manual Databricks credential steps.

## Implementation sequence

### A. Shell and home parity — partial local implementation

- Replace the plain home form with searchable cards and a create wizard that creates an install-local project through the existing TanStack Query API.
- Use Databricks-native project/deployment concepts in wizard copy and defer child-App creation/binding to the existing deployment flow.
- Retain current project import/export and safe workspace navigation.
- The install-local Apps list now uses the SaaS card hierarchy, status treatment, search/action placement, and edit/open/deploy actions, backed by project APIs. Project deletion remains an explicit confirmed project action.

### B. Canvas-first builder — partial local implementation

- Add a builder chrome matching the legacy canvas-first hierarchy and expose the current editor capabilities through recognizable tabs.
- Reuse standalone component definitions, validators, edit operations, autosave, and API hooks; do not call the legacy SaaS `AppApi`/`CanvasApi` persistence.
- Support palette-to-canvas drops, compatible palette drops into nested containers, and sibling reordering at every hierarchy level. Keep the existing keyboard-operable move controls as an alternative.
- The installed editor now uses full-height VDAB builder chrome, app identity in the top toolbar, Canvas/Main Flow/Code/Settings tabs, and keeps metadata in Settings. The existing standalone editor still supplies the state and project API adapters.
- The legacy `AppBuilder` React screen is **not yet the active Databricks editor route**. Standalone project contracts also do not yet model the legacy page/modal context graph, so simply routing to `AppBuilder` would lose project persistence and would invoke incompatible SaaS APIs. A parity adapter and contract gap closure are required before claiming identical behavior.

### C. Code and AI surfaces — locally available, parity unverified

- Add the generated-file code view using the existing Monaco dependency and project preview contract.
- Move custom modules into the code surface without losing optimistic version guards or safe save/reload behavior.
- Make the existing workspace-endpoint AI Builder discoverable from the builder shell and keep its validated operation application flow.

### D. Settings and verification — partial local implementation

- Organize metadata, resources, deployment, access, and workspace setup under a familiar Settings area while preserving all existing permission checks and confirmation dialogs.
- The standalone settings surface retains project details, collaborators, resource bindings, preview, and child-App deployment/readiness/history.
- The AI Builder drawer and shared toolbar have been checked in the running Databricks browser. Further visual and behavioral iterations remain necessary.
- The App Theme tab now reuses retained `AppThemeTab`; theme is saved with the project optimistic version guard, stored in the existing `vdab_projects.theme` JSONB column, applied to the standalone canvas, and emitted as Streamlit theme configuration in generated previews. Local validation and a new live snapshot are pending.

### E. Remaining parity work

- Verify Settings tabs and saved theme in the running Databricks app. Compare Resources and Permissions semantics with SaaS and retain only appropriate workspace-scoped equivalents. Snapshot 035's nested Permissions surface is live; user directory search is unavailable because SCIM is not a supported Databricks Apps scope.
- Verify page/modal contexts against the retained SaaS React Flow model. Modal creation and modal canvas/workflow tabs are wired through the standalone component aggregate. `Add Page` is disabled in the shared retained SaaS `AddModalPanel` as well, so it is not a Databricks-only gap.
- Align the Code tree file set and edit/save behavior with SaaS, including the virtual prebuilt library and generated runtime files, while retaining deterministic generation and guarded custom module saves.
- Compare home/create wizard, project toolbar, AI Builder behavior, empty/loading/error states, deployment lifecycle, responsive layout, and branding directly in both browsers; iterate on measured differences. The home dashboard and builder header now show a readable Databricks identity label beside the installation theme control.
- Report completion only after feature-by-feature acceptance has been browser verified in both apps. A successful deployment alone is not parity evidence.

## Constraints and acceptance

- No new third-party packages; `@dnd-kit` and `@monaco-editor/react` are already present in the client lockfile.
- No legacy .NET SaaS endpoints, SaaS identity/token storage, tenant APIs, Stripe/billing flows, or manually entered workspace credentials in the Databricks runtime bundle.
- User actions that call Databricks use the signed-in user's forwarded authorization and current workspace; denied actions fail closed.
- The user has authorized future deployments as part of syncing these frontends. Use a new, confirmed-unused workspace source folder for each snapshot and retain earlier versions; do not delete workspace resources.
- Local acceptance requires the retained SaaS React page tree to run against standalone project contracts, including pages/modals, canvas, workflows, custom modules, AI, generated code, settings, resource bindings, and child-App deployments.
- Full visual and runtime parity acceptance requires browser review in the user's sandbox after each iteration. The latest snapshot is deployed; further snapshots remain authorized by the user's standing instruction.
- Snapshot 038 builds and deploys successfully. The backend suite passes 482 tests with one skipped, and assembled-app smoke checks pass. A full client suite is not green: its standalone editor-flow tests need to open the Main Page before using the palette, and must assert the retained page-first workflow rather than assuming the palette is on the initial App Flow screen. Resolve this before parity acceptance.
