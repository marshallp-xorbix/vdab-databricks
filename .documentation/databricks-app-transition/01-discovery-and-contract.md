# 1. Discovery and product contract

**Depends on:** D1-D19 in [Decisions](./00-decisions-and-gates.md).  
**Output:** An approved feature/contract matrix that can drive implementation and deletion.

## Work

1. Enumerate all routed frontend pages, shared shell providers, HTTP endpoints, services, repositories, entities, migrations, generated files, tests, and deployment assets. Start with [Current state](./source-inventory.md); include transitive dependencies, not just filenames.
2. For every builder capability, capture the current user journey, API shape, data fields, failure modes, generated code, and test coverage. Mark `keep`, `adapt`, or `remove`; specify a replacement for each `adapt` item.
3. Define the install-local model: app owner/editor identity, app/component/workflow IDs, generated child-app name and ID, resource bindings, deployment history, and schema version. Distinguish customer-owned durable metadata from Databricks APIs that can be queried live.
4. Document the decided fresh-install boundary: no old SaaS projects, identities, workspace connections, credentials, billing records, or deployment history move into this separate product. Define the new product's first-project experience and its versioned standalone export/import with resource reselection.
5. Define user roles using Databricks permissions rather than old tenant/seat roles. Record which operation uses user authorization and which uses the builder app's service principal. Define denial behavior and audit fields.
6. Define child-app support: existing app linkage, new app creation, generated runtime, app resources, preview, publish, redeploy, failed deploy recovery, and the 100-app workspace limit behavior.
7. Define AI model selection and who pays for inference; identify available local workspace endpoint types and egress needs.
8. Capture product non-goals and a threat model: input JSON, generated code, module execution, SQL write-back, secrets, deployment privilege escalation, cross-user project access, and prompt/tool output.
9. Use the [workspace binding map](./workspace-binding-map.md) to enumerate every external-connection parameter, serialized workflow reference, UI selector, and OAuth token path. Replace them with installed-workspace context while retaining the feature they served.

## Deliverables

- `feature-parity-matrix.md` with one row per capability and a source/test/target mapping.
- Versioned HTTP and app-export contracts with representative fixtures: `contracts/http-v1.md`, `contracts/standalone-project-v1.schema.json`, and `contracts/fixtures/`.
- Install/editor journeys, permission matrix, and threat model in `contracts/permission-and-journey-matrix.md`.
- Fresh-install contract and customer-facing statement that this product has no SaaS project carryover.
- Updated decision log; architecture ADR and AGENTS change proposal prepared for approval.

## Exit criteria

- Every current routed builder flow has a disposition and test owner.
- Every SaaS removal has a trace to replacement or explicit product decision.
- A reviewer can map any retained UI action to a Node endpoint, application service, storage/integration path, and authorization identity.
- The exact Databricks scope path for Jobs and direct REST catalog API scopes remains explicitly marked as unproven rather than guessed.
- No Node implementation begins until the standards change and package approvals required for its first slice are settled.
