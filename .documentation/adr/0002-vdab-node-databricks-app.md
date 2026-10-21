# ADR 0002: Convert VDAB to a workspace-native Node.js Databricks App

- **Status:** Accepted for implementation on 2026-10-16
- **Deciders:** Product owner
- **Related decisions:** `.documentation/databricks-app-transition/00-decisions-and-gates.md` (D1–D19)

## Context

VDAB's current SaaS implementation is a .NET/Aspire API and React client. The approved product is a standalone Databricks App installed in each customer's workspace. It has no runtime link to the former SaaS product and does not migrate SaaS users, projects, credentials, tenants, or entitlements. Existing builder behavior is the source of parity requirements.

The builder and its generated products have separate runtimes. The builder backend must run as TypeScript/Node.js inside Databricks Apps; generated child apps remain Python/Streamlit. Each VDAB installation stores new builder state in a customer-owned Lakebase Autoscaling database. Databricks supplies the app's own service principal and can forward a scoped user token. User-triggered external actions must preserve the acting user's permissions and must not fall back to the builder service principal.

Databricks supports Apps APIs, user scopes, and Lakebase resources, but those platform primitives do not yet prove that a Marketplace-installed VDAB app can create and deploy child apps as a non-admin user. Marketplace provider publication is also an external validation gate. The scope decision is settled; platform feasibility still needs direct evidence.

## Decision

Convert this repository in place to a standalone Node.js Databricks App. Keep the React builder UI and preserve all agreed capabilities: the full component catalog, all eight story visualizations, workflows/actions, custom/prebuilt modules, AI tools, current-workspace data discovery and binding, Python/Streamlit preview and generation, create-new and link-existing child-app flows, deployment/recovery, and versioned standalone-to-standalone project export/import.

Use the following boundaries:

```text
React UI -> Node HTTP boundary -> application services -> repositories -> customer Lakebase
                                     |-> Databricks workspace APIs / customer AI endpoints
                                     |-> Python/Streamlit generator and child-app deployment
```

Derive workspace context from the trusted hosting App. Use Databricks forwarded user authorization for user-triggered workspace operations, with explicit scopes, permission checks, consent handling, and audit records. Use the app identity only for bounded shared/background work. Store project ACLs, workflows, component definitions, deployment history, and audit metadata in the installation's bound Lakebase resource. Imported projects require current-workspace resource reselection and never include credentials.

Revise `AGENTS.md` and the active architecture standard before writing backend code. Continue to require explicit evaluation and approval for third-party dependencies. Retire SaaS/.NET/Azure source only after replacement parity tests pass.

## Consequences

### Positive

- Customers install and operate VDAB inside their Databricks workspace and control the resources, identity, data, and model endpoints it uses.
- Builder state is durable and customer-owned per installation.
- User-triggered actions can honor the same Databricks permissions as direct workspace use.
- Generated Streamlit behavior and the agreed builder surface remain first-release requirements.
- Repository ownership and installation flows become independent of the former SaaS tenant and billing system.

### Costs and constraints

- The backend, persistence model, API contracts, deployment workflow, and client integration require a full replacement rather than a compatibility facade.
- Marketplace installation and update behavior, required resource grants, user scopes, child-app lifecycle operations, and generated-app Jobs authorization need live proof.
- Each direct npm dependency adds security, licensing, maintenance, and deployment review work. No new package may be added before approval.
- The current Databricks CLI refresh token is invalid; live workspace claims require renewed authentication and a confirmed disposable workspace.
- Marketplace provider approval, commercial route, and public publication remain external gates.

## Validation and review

Implement in the numbered order in `.documentation/databricks-app-transition/README.md`. At each step, record baseline state, changed contracts/paths, acceptance criteria, risks, focused and full test results, assembled-app behavior, Databricks evidence, and unresolved gates in `progress-and-handoff.md`. Before deleting any legacy group, show passing parity checks for its replacement. Revisit this ADR only if direct platform evidence makes an agreed capability infeasible; record the exact evidence and a conforming alternative before changing scope.
