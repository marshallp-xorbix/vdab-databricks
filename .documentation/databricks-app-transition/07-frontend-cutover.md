# 7. Frontend cutover

**Depends on:** Native identity, replacement builder APIs, product scope.  
**Output:** A React builder UI that behaves as an installed Databricks App.

**Local shell slice verified 2026-10-20:** The Databricks runtime route manifest contains only the standalone root, project list/editor, installed-workspace app list, and workspace setup routes. A packaged local-test server serves the app shell and those SPA paths; its session endpoint returns the safe local-test identity contract. SaaS pages remain in source as parity references but are absent from the built Databricks route manifest and JavaScript asset text. The full Step 7 remains open: no Databricks proxy/session/browser test, resource readiness diagnosis, user permission journey, or workspace deployment was performed.

## Work

1. Keep the `/apps` list and `/apps/:appId` designer as the primary navigation. Replace `root.tsx`, `AuthenticatedLayout.tsx`, `BaseApi.ts`, and sidebar dependencies on VDAB JWT, tenant, Stripe, seats, account setup, and manually entered workspace OAuth. Use the Databricks App SSO session and only expose actions that the current user may perform.
2. Replace `DatabricksConnections.tsx` and callback flow with a current-workspace setup/status page. Show bound resources, consent status, and diagnostic guidance without asking for a PAT/client secret for same-workspace work.
3. Move core HTTP calls from `src/providers/` into resource-specific `src/api/` modules and TanStack Query hooks in `src/hooks/`, in vertical slices; keep server state out of hand-written `useEffect` fetch logic. Remove the old provider only after the last consumer is switched.
4. Preserve canvas, drag/drop, property editing, workflow, AI assistance, custom modules, preview, app resource editor, new-product import/export, deployment status, and error messages according to the parity matrix. Replace tenant AI model selection and subscription UI with endpoint/resource selectors for the workspace hosting VDAB.
5. Remove SaaS routes, pages, navigation, guards, API models, and unused packages only after the replacement shell builds and all references are gone. Update `routes.ts`, `section-sidebar.ts`, public links, tests, and client README in the same change. Do not leave dead links to pricing, login, docs, or account pages.
6. Ensure responsive behavior, WCAG 2.2 AA semantics/contrast/keyboard access, loading/empty/error states, and confirmation for destructive operations. A denied Databricks permission should state the missing grant and the action needed without exposing a token.

## Verification and exit criteria

- End-to-end journeys for installer, authorized editor, read-only/denied user, and post-update user.
- No request sends a VDAB SaaS JWT or refresh token; no browser storage contains Databricks OAuth tokens.
- Build, lint, client tests, keyboard/accessibility checks, and browser smoke test pass against the packaged Node app in Databricks.
- Every visible navigation target resolves; removed SaaS flows are absent from routes and import graph.
