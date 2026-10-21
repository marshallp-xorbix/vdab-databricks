# 0. Decisions and gates

## Decision log

| ID | Decision | Current state | Recommended default | Blocks |
| --- | --- | --- | --- | --- |
| D1 | Who may author and deploy? | **Decided 2026-10-16:** Authorized workspace users may create and deploy using their own Databricks permissions. | Request the required user scopes; check each caller's workspace permissions. Reserve the builder app's service principal for shared settings and background work. | Identity, Apps API design, audit. |
| D2 | Existing SaaS customer projects | **Decided 2026-10-16:** The Databricks version is a separate product. Every install starts fresh; no SaaS projects, users, credentials, or records carry over. | Design its own project schema; D12 separately retains export/import between standalone installs. | Data model, onboarding, deletion. |
| D3 | Generated app runtime | **Decided 2026-10-16:** Keep Python/Streamlit child-app output; rewrite the VDAB builder backend in Node.js. | Preserve generated app behavior, files, resource binding, and custom Python modules while porting the generator. | Generator parity and scope. |
| D4 | Builder persistence | **Decided 2026-10-16:** Each installed VDAB App stores its own projects and workflows in a customer-owned Lakebase Autoscaling database bound as an App resource. | Document administrator provisioning and grants, initialize a fresh schema, verify persistence across redeploy/update, and provide backup/export guidance. | Setup UX, repository implementation, packaging. |
| D5 | AI provider and costs | **Decided 2026-10-16:** AI Builder uses only model or AI Gateway endpoints configured in the customer's Databricks workspace. The customer controls grants, usage, and cost. | Remove Xorbix-hosted model credentials, tenant PAT setup, and platform AI quotas; define required endpoint resource/scopes and degraded UX when none is configured. | AI feature parity and installation. |
| D6 | Target workspaces | **Decided 2026-10-16:** An installed VDAB instance builds and deploys only in its own Databricks workspace. A different workspace requires its own install. | Remove multi-workspace connection selection and stored cross-workspace tokens; derive the workspace from Databricks runtime context. | Auth, data connector, navigation. |
| D7 | Commercial entitlement | **Decided 2026-10-16:** The installed VDAB App has no license server, license key, or in-app payment check. Commercial access is handled through the agreed Databricks distribution process. | Remove Stripe and entitlement paths from the product; confirm paid App listing/transaction mechanics with Databricks before Marketplace release. | Marketplace release. |
| D8 | Core scope | **Decided 2026-10-16:** Retain all existing builder functionality in the first standalone release: every component and workflow action, AI Builder, custom/prebuilt modules, data discovery/binding, preview, standalone export/import, create/link/deploy child app, and publish audit. Remove SaaS-only account, tenant, billing, and external-workspace connection behavior. | Port or adapt every builder capability in the parity matrix; a removal requires a new explicit product decision. | Parity matrix. |
| D9 | Publication route | External validation needed from Databricks. | Use official third-party App submission and security review after partner-team confirmation. | Public release. |
| D10 | Node architecture and standards | **Decided by requested transition:** TypeScript/Node.js backend replaces .NET/Aspire/EF in this repository. | Revise AGENTS and architecture ADR before Node implementation; retain clear HTTP/service/repository boundaries and dependency approval. | All code changes. |
| D11 | Repository boundary | **Decided 2026-10-16:** Convert this repository in place into the standalone Databricks product. The current SaaS implementation is source material, not a connected runtime or a second product kept in this repository. | Replace slices and remove obsolete SaaS code here once their dependencies are gone. | Source deletion, CI, docs, standards. |
| D12 | Standalone project portability | **Decided 2026-10-16:** Keep export/import between standalone VDAB installations using a new versioned format. Do not accept SaaS exports. | On import, validate the project and require users to reselect workspace resources and confirm child-app links; never export secrets. | Data model, UI, tests. |
| D13 | Child-app lifecycle | **Decided 2026-10-16:** Keep both create-new and link-existing flows for Databricks Apps in the same workspace. | Verify the acting user's management permission; warn and require confirmation before deploying over an existing app; capture previous deployment for recovery. | Deployment, UI, audit. |
| D14 | Child-app resources | **Decided 2026-10-16:** VDAB selects and binds existing customer Databricks resources; it does not provision SQL warehouses, Jobs, Lakebase databases, model endpoints, or Unity Catalog assets. | Show prerequisites, permissions, and missing-resource errors before deploy. | Installer, resource editor, deployment. |
| D15 | Story visualizations | **Decided 2026-10-16:** Keep all eight existing story visualizations in the first standalone release. | Port amoeba, flow field, heat map, honeycomb, network web, pulse wave, spiral, and terrain generation and runtime tests. | Builder/generator parity. |
| D16 | Generated app user authorization | **Decided 2026-10-16:** User-initiated data queries and Jobs in generated child apps run under each viewer's Databricks permissions where supported. Shared background work may use the child app's service principal. | Change current service-principal SQL/Job generation to scoped user authorization, validate Unity Catalog policies, and test missing-consent/permission paths. | Generator, resources, security, tests. |
| D17 | Builder project visibility | **Decided 2026-10-16:** A project is visible to its creator and collaborators explicitly granted access; an installation admin has a recovery/manage path. | Store and enforce project-level access in Lakebase; `CAN USE` on VDAB alone does not reveal every project. Replace SaaS invitations with Databricks identity selection. | Data model, API authorization, UI. |
| D18 | Collaborator capability | **Decided 2026-10-16:** Invited project collaborators may edit and deploy the project, provided their own Databricks permissions allow the requested action. The creator manages collaborators. | Project sharing grants VDAB access only; it never elevates Databricks API rights. | API authorization, sharing UI, deployment. |
| D19 | Connection-dependent features | **Decided 2026-10-16:** Preserve existing builder functionality that previously used an external workspace connection, but resolve it against the workspace hosting this VDAB install. AI model selection, Unity Catalog browsing, SQL warehouses, Jobs, Genie, serving endpoints, Lakebase selectors, app creation/linking, and deployment use current-workspace context. | Replace `workspaceConnectionId`/stored OAuth inputs with runtime workspace identity and scoped user/app authorization; retain feature behavior and error states. | All Databricks integrations, UI contracts, generator. |

Product scope decisions are settled by the user's answers and the instruction to use the recommended course for remaining questions. D9 is an **external Databricks release gate**, not a pending product preference. Future implementation may revisit a decision only when platform evidence makes it infeasible; record the evidence and conforming alternative before changing scope.

### D1 implementation consequence

The installed builder's `CAN USE` grant allows a user to open VDAB; it does not grant the user permission to create or manage Databricks Apps. For user-triggered child-app creation and deployment, VDAB must request the necessary OAuth scopes and call Databricks with that user's forwarded token. It must report a missing scope or workspace permission and never retry the operation using its own service principal. Shared settings and background work may use the app identity with narrow grants. Spike A must prove this works for a representative non-admin editor and correctly denies an unprivileged user.

## Critical gates

### G1: Product contract

Define allowed users, authorization identity, supported child-app runtime, repository boundary, supported workspace topology, feature keep/remove list, and purchase/entitlement policy. Record a fresh-install journey and an ordinary editor's build/deploy journey.

### G2: Platform proof

In a disposable development workspace, install or faithfully emulate the intended Marketplace builder permissions. Prove: signed-in user identity, `apps` scope consent, create child app, upload/sync code, deploy, bind resources, read deployment status, and recover from failed deploy. Repeat with an authorized non-admin and a denied user. Record exact API response and required privileges. If this fails, redesign the product around admin-approved deployment or a supported alternate publication path before porting the generator.

### G3: Store and fresh-install proof

Prove that a fresh builder install can initialize its own customer-managed durable store and preserve newly created projects after restart/redeploy. Choose a schema/version policy. The installer does not contact or import data from the SaaS platform. If within-product export/import is retained, test it using projects created in the new product only.

### G4: Marketplace route

Get direct confirmation from Databricks on provider eligibility, app submission path, security review, private/public distribution, update mechanism, purchase/entitlement signal, and required installer resources. The consumer installation guide describes third-party Apps; public provider documentation does not yet describe an end-to-end App publishing workflow.

### G5: Cutover

Complete the parity matrix, security review, end-to-end install/deploy test, rollback procedure, and documentation/CI replacement **in this repository**. Remove obsolete SaaS backend and Azure infrastructure once replacement slices pass. Tag the last working SaaS commit for reference and rollback during development; the completed repository contains only the standalone product.

## Standards change record

At transition start, [AGENTS.md](../../AGENTS.md) required all new/modified backend code to target .NET 10/C# 14, use EF Core, and follow `.Server → .Services → .DataAccess → .Models` with Aspire. Those rules are incompatible with the decided Node.js backend. The request authorizes revising repository guidance before implementation. The resulting active architecture is recorded in [ADR 0002](../adr/0002-vdab-node-databricks-app.md) and `.documentation/standards/node-databricks-app-architecture.md`. Existing .NET instructions remain applicable only to legacy code during retirement. Third-party packages still require an evaluated, explicit approval.

1. Write an ADR for the approved runtime and customer-workspace deployment.
2. Revise `AGENTS.md`, repository layout, build/test instructions, and applicable canonical architecture docs to specify TypeScript/Node.js, data access, DI, HTTP conventions, migration tooling, and Databricks authentication. Keep the existing rules in force for .NET code until it is removed.
3. Evaluate each new third-party dependency for security, license, maintenance, scope, and deployment cost; obtain explicit approval before adding it.
4. Execute the migration through tested vertical slices; do not use the architecture change as permission to bypass layer boundaries or tests.
