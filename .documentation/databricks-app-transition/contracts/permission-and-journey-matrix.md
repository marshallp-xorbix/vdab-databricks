# Standalone install, editor, and authorization contract

**Status:** Step 1 product contract. Databricks operation-level permissions remain subject to the step 2 live spike.  
**Date:** 2026-10-16.

## Fresh installation journey

1. A workspace administrator installs VDAB in the target workspace, grants access to approved users/groups, and binds an existing customer-owned Lakebase Autoscaling database. Each install starts with an empty VDAB schema and no SaaS identity or project data.
2. The administrator configures only the Apps user authorization scopes the workspace allows. VDAB's setup page reports missing resources/scopes and does not display credentials.
3. The first authorized user opens VDAB through Databricks SSO and creates a project. The app resolves the user's identity from trusted Databricks App context and assigns that user as creator.
4. The creator composes the canvas, workflows, integrations, modules, and AI configuration. Project collaborators are explicit app-level grants; each collaborator's external Databricks actions continue to use that collaborator's own forwarded token and permissions.
5. Before creating or linking a child App, the acting user selects `createNew` or `linkExisting`. The app checks required scope and Databricks permission and reports denial without retrying as VDAB's app identity.
6. The user binds existing same-workspace resources, previews generated Python/Streamlit source, confirms any overwrite, and deploys. Deployment status, actor, source version, and recovery snapshot are recorded in Lakebase audit/history.
7. On another standalone installation, the user imports a versioned VDAB export. The import creates a new project and requires resource and child-App reselection. It never imports SaaS bundles or credentials.

Lakebase provisioning during Marketplace installation, the exact app scope allowlist, child-App API privileges, and generated-app SQL/Jobs viewer authorization are not yet verified. They are hard step 2 gates, not assumed behaviors.

## Project and platform permission matrix

| Principal / operation | VDAB project rule | Databricks identity | Scope/permission evidence required |
| --- | --- | --- | --- |
| Workspace user opens VDAB | Requires workspace access to the installed app; no project access implied | Databricks App user session | Confirm trusted proxy identity and default identity scopes in the packaged App |
| Creator reads/edits/deletes own project | Creator ACL; delete and destructive deployment operations require confirmation | App identity for Lakebase repository only; user identity for any workspace API | Project ACL contract tests; Lakebase app service principal has only required DB grants |
| Explicit collaborator reads/edits/deploys | Project collaborator ACL allows builder work; never grants workspace resource rights | Collaborator's forwarded user token for external operations | Per-operation user scope, consent, and Databricks resource permission; no SP fallback |
| Unrelated VDAB user | Not a project member; API returns `404` for hidden project | No workspace call | Service/HTTP tests cover read, write, export, preview, AI, deploy, audit |
| Installation recovery administrator | Recovery/manage path; every access or mutation is audited | User token for Databricks operations; app identity only for Lakebase | Define trusted admin source in implementation; prove project recovery and audit |
| Catalog/schema/table browse | Project permission required when invoked in a project editor | Current user's forwarded token | Apps guide documents SDK scopes `catalog.catalogs:read`, `catalog.schemas:read`, `catalog.tables:read`; confirm the chosen direct API/SDK maps correctly |
| SQL warehouse discovery/query | Project permission required | Current user's forwarded token for user-specific reads/writes | `sql` scope plus warehouse/table grants; test restricted query and write behavior |
| Job discovery/start | Project permission required | Current user's forwarded token | Apps guide calls Jobs a user-auth use case but omits a `jobs` scope from supported scopes; exact API/SDK scope and permission path are unknown and must be proven |
| Serving endpoint / AI Gateway | Project permission required for model selection and generation | User token or app token only after identity decision and endpoint grants are proven | `model-serving` and/or `ai-gateway`; customer owns endpoint access/cost |
| Genie, files, Lakebase discovery | Project permission required | Current user's forwarded token for user-specific operations | `genie`, `files`, `postgres`, plus endpoint/resource permissions; exact endpoint coverage tested |
| Create/link/deploy child App | Creator/collaborator can request action, but workspace permission is independent | Acting user's forwarded token | `apps` scope and actual workspace ACL; non-admin success and denied-user failure are G2 gates |
| Generated app viewer SQL/Jobs | Viewer request is not authorized by builder project membership | Generated child's viewer identity where supported | SQL and Jobs scopes/consent, differing viewer grants, denial without child app SP fallback |
| Shared background maintenance | No broader project visibility than explicitly needed; audited | VDAB app service principal | Narrow resource grants and isolated service-owned operation; never execute a denied user's request |

## Threat model and contract mitigations

| Threat | Required control and acceptance test |
| --- | --- |
| Forged identity or workspace headers | Trust proxy-derived identity only behind Databricks ingress; local adapter rejects forwarded identity headers. Hostile-header HTTP test. |
| Cross-user project access | Check creator/collaborator ACL for every project route; hide unrelated projects with `404`. Matrix test for creator, collaborator, unrelated user, and recovery admin. |
| Privilege escalation through the builder app identity | External action adapter requires an acting user token for user-triggered operations; no fallback branch. Test denial with app SP otherwise granted more access. |
| Cross-workspace requests | Resolve API host from runtime; reject workspace URL/host/connection ID fields at every request/import layer. Test malicious host injection. |
| Malformed or hostile project/workflow import | Validate version, component/action schemas, graph links, limits, and resource keys before storage/generation. Reject old SaaS format and unknown authority-bearing keys. |
| Leaked token, credential, or secret | Keep credentials outside project schema; omit token values from logs/errors; do not export them. Scan/reject recognized credential-bearing fields and known secret patterns in custom source. Add secret-exclusion fixtures. |
| Unsafe custom Python/module execution | Never execute user-provided Python in VDAB. Include it only in the generated child app with clear permissions and deterministic packaging. |
| SQL injection or unintended writes | Parameterize values; allowlist SQL identifiers and statements; require explicit action configuration for writes; apply the acting viewer's authorization. Tests cover parameter injection and denied writes. |
| AI prompt/tool injection or invalid generated edits | Treat endpoint output as untrusted; validate tool names/arguments and resulting project changes against the same service rules; do not allow AI to grant resource permissions or deploy without explicit user action. |
| Deployment overwrite or partial failure | Require overwrite confirmation, save last known good source/deployment, audit actor and target, expose retry/rollback, and test failed-upload/deploy recovery. |
| Resource references become stale on import | Export project-local keys/labels only; import marks each reference unresolved and requires user reselection before preview/deploy. |

`standalone-project-v1.schema.json` enforces shape and forbids authority-bearing property names recursively. Runtime import/export still needs a source-text secret check and negative tests; schema validation alone cannot prove arbitrary custom Python contains no secret literal.
