# 8. Retirement, documentation, and final validation

**Offline documentation and package-safety slice (2026-10-21):** `databricks-app/DEPLOYMENT.md` and `manual-workspace-testing.md` document project export versus database backup, Lakebase scheduled snapshots and restore branches, `pg_dump`/`pg_restore`, the current Lakebase DR preview limitation, uninstall residue, operational troubleshooting, and the unqualified cloud/region matrix. They now also call out npm/Python package-registry egress requirements and the asyncpg license copy in both the builder notices report and Lakebase child source. The root README, client README, and active `AGENTS.md` commands point to the standalone Node package; retained deployment, release, QA, and process documentation is explicitly marked as legacy reference. The standalone Databricks client build substitutes a no-op telemetry adapter, and a dedicated packaged-asset smoke check rejects Application Insights, external connection/tenant model pickers, and workspace credential strings in `.build/public`. The Azure DevOps CI build publishes this self-contained package as a separate artifact. Its legacy .NET/Azure Deploy_Dev stage still auto-deploys on non-PR `develop` builds; Staging/Prod promotion uses Azure DevOps Environment approvals. It does not deploy to Databricks. Retire those Azure stages only after G5 and the Marketplace install/update/rollback gates pass. These changes are covered by the production package build, full client regression, typechecks, focused lint, and packaged smoke. Workspace recovery drills, Marketplace installation, G5, and source retirement remain unverified and gated; no SaaS/.NET source was removed.

**Depends on:** G5 parity and tested Marketplace installation.  
**Output:** One coherent Databricks App repository, with obsolete SaaS runtime removed.

## Deletion order

1. Freeze the accepted parity matrix and record successful fresh install, security review, and rollback drill. Tag the last working SaaS commit in this repository before broad source deletion. Use the [retirement manifest](./retirement-manifest.md) to coordinate each removal batch and its references.
2. Remove SaaS-only frontend routes/pages/components/hooks/API modules/types and the corresponding tests. Remove Stripe and Application Insights browser packages only after the import graph is clear and lockfiles are regenerated with approved package tooling.
3. In this repository, remove obsolete .NET controllers/services/repos/models/migrations/tests after the Node slices no longer depend on them. Delete Aspire AppHost, MigrationService, ServiceDefaults, solution/props, Azure App Service Bicep, Azure-specific pipelines, and related scripts after the new CI/deploy path passes.
4. Replace the root README, client README, AGENTS, architecture diagrams, deployment guide, release workflow, QA strategy, environment table, and setup instructions. Search the entire tracked tree for stale `.NET`, Aspire, EF, Stripe, Azure App Service, Key Vault, tenant/seat, JWT, workspace connection, and old URL references. Keep historical SaaS/requirements docs in a clearly named archive only if needed for traceability; otherwise delete them and update links.
5. Remove dead assets, diagnostic pages, orphaned tests, obsolete variables, secrets examples, and unused dependencies. Preserve legal/licensing records per company policy. Run a full import/reference scan after each deletion batch.
6. Document the Node layer boundaries, API/error conventions, app resource configuration, identity matrix, data schema/migrations, generated child app format, installation/update/uninstall, backup/export, monitoring, troubleshooting, and supported Databricks clouds/regions.

## Final verification matrix

| Gate           | Evidence                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Clean checkout | Install with lockfile; typecheck/lint/test/build/package without .NET or Azure credentials.                                  |
| Install        | Marketplace consumer install in a clean customer-like workspace, including resources/scopes and first run.                   |
| Builder        | Each retained component/action, save/reopen, AI, preview, custom code, data discovery, and new-product export/import.        |
| Child app      | New/link existing, bind resource, deploy/redeploy, run under permitted user, denial and rollback.                            |
| Persistence    | A fresh install can create projects; restart/update preserves those projects and deployment history. No SaaS data is loaded. |
| Security       | Identity spoofing, cross-user access, token/secret leakage, SQL/code injection boundaries, scope denial, audit record.       |
| Operations     | Logs, health, cost/quota messaging, backup/export, upgrade and rollback drill.                                               |
| Documentation  | All root and linked docs match the shipped architecture; no broken links or stale commands.                                  |

## Why broad deletion waits

The current builder's `App` data, services, controllers, UI shell, and tests depend on SaaS tenant, membership, billing, and stored workspace connection code. Removing those trees now would break the existing app and erase useful behavior references. Remove them in this repository after native replacements pass parity. Only a file proven unreferenced and irrelevant to parity should be removed early, with a clean build afterward.
