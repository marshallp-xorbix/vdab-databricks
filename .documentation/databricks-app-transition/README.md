# VDAB workspace-native transition plan

**Status:** Product scope agreed; Databricks feasibility and Marketplace publication gates remain.  
**Prepared:** 2026-10-16.  
**Target:** A Marketplace-installable VDAB Databricks App that runs in each customer's workspace and builds other Databricks Apps.

## Outcome

Convert **this repository** into a standalone Databricks product, using the existing VDAB implementation as a source of proven builder behavior. Each Marketplace install starts fresh in a customer's workspace; it has no runtime, account, project, or data connection to the SaaS platform. Keep the visual designer, workflows, component catalog, data bindings, AI-assisted building, custom modules, preview, and deployment where they fit the approved product contract. Build its backend in TypeScript/Node.js inside the installed Databricks App. Remove tenant signup, Stripe checkout, seats, passwordless login, workspace OAuth connection catalog, and Azure hosting code after native replacements pass parity checks.

The installed **builder app** and the **apps it generates** are separate runtimes. The builder backend will be Node.js; the apps it generates will remain Python/Streamlit for the first release. See [Decisions and gates](./00-decisions-and-gates.md).

## Delivery sequence

| Order | Plan | Result |
| --- | --- | --- |
| 0 | [Decisions and gates](./00-decisions-and-gates.md) | Product contract, authorization, commercial, and standards decisions recorded. |
| 1 | [Discovery and contract](./01-discovery-and-contract.md) | Traceable feature/API/data inventory and parity matrix. |
| 2 | [Feasibility spikes](./02-feasibility-spikes.md) | Workspace-native app creation, identity, persistence, and Marketplace route proven. |
| 3 | [Node foundation](./03-node-foundation.md) | Databricks App shell, TypeScript server, local development, CI, contracts. |
| 4 | [Identity and persistence](./04-identity-and-persistence.md) | Databricks SSO/OAuth and durable per-install builder state. |
| 5 | [Builder and AI](./05-builder-and-ai.md) | Core designer, generation, integrations, AI, and custom modules ported. |
| 6 | [Deployment and Marketplace](./06-deployment-and-marketplace.md) | Create/link/deploy child apps and package the builder for Marketplace. |
| 7 | [Frontend cutover](./07-frontend-cutover.md) | Workspace-native UI without SaaS gates, with complete builder flows. |
| 8 | [Retirement and validation](./08-retirement-and-validation.md) | Parity evidence, docs/CI/infra updates, safe deletion of obsolete code. |

Read [Current-state inventory](./source-inventory.md) for source-level seams, the [feature parity matrix](./feature-parity-matrix.md) for keep/adapt/remove scope, the [workspace binding map](./workspace-binding-map.md) for connection-dependent features, the [retirement manifest](./retirement-manifest.md) for path-level cleanup, and [Research](./research.md) for Databricks requirements. Each step lists its dependencies, implementation work, tests, and exit criteria. Execute steps in order and update platform findings as evidence changes.

## Architectural direction

```text
Databricks SSO / App proxy
        |
React builder UI -> Node HTTP boundary -> application services -> repositories -> customer Lakebase
                                      |-> Databricks workspace APIs / AI endpoints
                                      |-> child-app generator and deployment
```

Each installed VDAB instance builds only in its own customer workspace; another workspace needs another install. Authorized workspace users create and deploy child apps under their own Databricks permissions. Databricks supplies the installed app's separate identity for shared settings and background work. Projects are visible to their creator and invited collaborators; collaborators may edit/deploy only within their own Databricks rights. Generated Python/Streamlit apps use each viewer's permissions for user-initiated queries and Jobs. The feasibility spike must prove these on-behalf-of-user operations. Keep generated app execution and permissions isolated from the builder's identity.

## Non-negotiable gates

1. **Standards:** Revised [AGENTS.md](../../AGENTS.md), the active [Node architecture](../../standards/node-databricks-app-architecture.md), the legacy .NET architecture notice, and [ADR 0002](../../adr/0002-vdab-node-databricks-app.md) record the approved Node.js transition before backend code. Existing .NET rules apply only to the temporary source reference.
2. **Dependencies:** No new npm package is added until the [Dependency Approval](../../AGENTS.md#dependency-approval) evaluation is recorded and approved. The user approved exactly `pg@8.23.1` and `@types/pg@8.23.1` on 2026-10-16; see [`dependency-approval-proposal.md`](./dependency-approval-proposal.md). Any further package needs separate approval.
3. **Databricks:** Prove installed builder identity can create and deploy a child app, and confirm provider submission/security review with Databricks. The user has asked that no workspace connection be made right now; workspace feasibility and Marketplace tests remain unverified until they provide a disposable target and request the tests. API existence alone does not prove Marketplace authorization.
4. **Customer data:** Each install uses its own customer-owned Lakebase Autoscaling database for **new** projects. No SaaS projects or records carry over. Do not generate schema migrations against shared environments without team-lead confirmation.
5. **Repository boundary and deletion:** This repository becomes the standalone product. Keep the current app buildable during the transition and tag its last working SaaS commit. Remove obsolete SaaS source, tests, infrastructure, and docs here as replacement slices pass, updating their references in the same changes.

## How to use this plan

Implement one vertical slice at a time. For every slice: add or revise a contract, implement persistence/integration, service and HTTP boundary, switch the client call, run unit and contract tests, exercise the flow in a Databricks development workspace, and record the evidence. Do not build a SaaS project migration path. Do not interpret a passing local build as proof of a Marketplace install.
