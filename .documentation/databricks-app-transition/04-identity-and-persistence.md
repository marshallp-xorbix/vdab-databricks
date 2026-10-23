# 4. Identity, authorization, and persistence

**Current offline implementation status (2026-10-21):** The Node backend now has the install-local project/component/workflow/module/deployment schema, append-only migrations `001`–`007` with stored checksums, caller-scoped project ACL and deployment services, owner/installation-admin deletion with transactional audit, rotating Lakebase credential handling, export/import, setup diagnostics, and local-test repositories. Migration 007 snapshots required child-App Lakebase resources with each immutable deployment. The package build and fake-backed repository/HTTP/migration suites pass. Disposable PostgreSQL 17 integration verifies deletion while retaining the linked child App, deployment snapshots, and audit history. No bound Lakebase resource or Databricks workspace was accessed. G3, fresh-install resource binding, real migration/restart/upgrade durability, and Databricks OAuth permission behavior remain unverified.

**Implementation status (2026-10-16):** The offline Node slice implements the two-step rotating Lakebase credential provider, a versioned initial schema, startup migration serialization, a PostgreSQL project repository, install-admin recovery allowlist, project creator/editor ACLs, audit records, and create/list/get/grant-editor HTTP routes. It is covered by fake-backed unit/HTTP tests and the packaged local-test smoke. No Lakebase database or Databricks workspace was connected. G3, SQL execution correctness, Apps resource injection, OAuth permission, restart durability, and real concurrent migration behavior remain unverified. The product feature slices in Steps 5–7 are still required before this phase is complete.

**Collaborator removal slice (2026-10-20):** Project owners and audited installation recovery admins can list and revoke editor grants through the standalone editor. Revoke is transactional and audited only when a grant is actually removed; editors cannot manage project ACL. The UI requires confirmation and states that project sharing does not grant Databricks resource access. Adding a collaborator remains gated: Databricks Apps documentation does not currently list the required `scim` or `identity` directory-search scope, so the UI does not accept free-form IDs or claim identity-picker parity. See `progress-and-handoff.md` for verification evidence.

**Operational recovery documentation (2026-10-21):** The deployment runbook now distinguishes portable project JSON from Lakebase database backups and deployment snapshots. It documents Lakebase history-window/snapshot choices, restore-to-new-branch behavior, a separately stored `pg_dump` option, the current non-production Private Preview status of cross-region Lakebase DR, uninstall residue, and recovery troubleshooting. Platform behavior was checked against current official Databricks docs; no backup, restore, or workspace action was executed. G3 durability and the Step 8 operations drill remain unverified.

**Depends on:** G1-G3 and Node foundation.  
**Output:** Customer-local builder data and native access control, with no stored workspace OAuth refresh tokens.

## Identity and authorization

1. Replace SaaS JWT/session/tenant membership policies with Databricks App SSO identity and explicitly configured OAuth user scopes. Trust forwarded identity/token only behind the Databricks proxy; make local development use a distinct mock adapter.
2. Map each endpoint to a required builder permission and downstream Databricks permission. Use per-user authorization for reads and deployments that must respect the caller. Use the builder app's service principal only for narrowly scoped shared metadata/background tasks.
3. Store project creator and explicitly granted collaborators; enforce access on every project read/write/list and export. The creator manages invitations; collaborators may edit and request deployment. Every create/link/deploy call must separately check the acting collaborator's Databricks privileges. Provide an installation-admin recovery path with an audit record. Do not equate `CAN USE` on the builder with visibility into every project or with `CAN MANAGE` on a child app. Verify ownership and sharing semantics through the feasibility spike.
4. Record auditable actor, app/project, action, outcome, time, and Databricks request/deployment ID. Never log OAuth tokens, generated secret values, or unredacted prompts containing sensitive data.

## Persistence

1. Implement a repository-backed install-local schema for apps, components, workflows, custom module source, resource references, deployment history, and schema version in the customer-owned Lakebase Autoscaling database bound to VDAB. G3 must prove the binding and lifecycle before production use.
2. Use customer-owned resource IDs and canonical workspace URLs from the runtime. Omit old `TenantId` and workspace-connection foreign keys from the new schema; no legacy data adapter is needed.
3. Add migrations that are idempotent for a new install, transactional where supported, reversible where data-safe, and run under the approved startup/install procedure. Follow the team's confirmation rule for shared database migrations.
4. Define a **new product** export format with a schema version and explicit validation. Use the old `DTOs/Portability/` code only as a behavior reference; do not accept SaaS bundles or reuse their workspace URLs, child-app names, or paths. On import, require users to reselect resource references and confirm any existing child-app link. Test round trips between separate installs of the new product, duplicate names, invalid references, and rollback. Never export OAuth credentials or secret values.
5. Establish retention, backup/export, disaster recovery, and uninstall behavior. Databricks app removal does not itself imply deletion of customer-managed Lakebase data.

## Tests and exit criteria

- Repository tests for ownership/collaborator filtering, concurrency, transactions, deleted/invalid records, new-product schema migrations, and export/import round trips.
- HTTP tests for creator/collaborator/admin access, collaborator edit/deploy with and without Databricks grants, unrelated-user denial, missing consent, no privilege fallback, and redacted errors.
- Restart/redeploy test proves a saved app and its module/workflow content persist.
- A signed-in authorized user can create, reopen, edit, and export a project without any VDAB SaaS account, tenant, Stripe, or manually entered workspace token.
