# Node server and API

The Node server is the installed App's HTTP boundary and application host. Its code is under `server/src/`; tests are under `server/test/`.

## Request path

1. The HTTP boundary resolves the trusted Databricks App caller context.
2. The route validates path, query, and body values, including nested project/import content.
3. The route invokes an application service with typed input and caller context.
4. Services apply business rules and call repositories or integration adapters.
5. The route maps typed results to JSON or RFC 9457 Problem Details.

All product APIs are same-origin and versioned under `/api/v1`. Health liveness is separately available at `GET /api/health/live` and does not require a caller session.

## Route groups

Route modules expose project CRUD and project subresources, collaborators, component definitions, workflows, custom modules, resource references, preview, export/import, AI Builder, workspace/session/resource discovery, and child-App deployment lifecycle. Source modules are registered in `server/src/http-app.ts`; inspect them for the precise request/response schema when implementing a caller.

## Errors and cancellation

Expected failures use typed application errors and a central mapping to status and Problem Details. Unexpected exceptions are sanitized at the HTTP boundary. Workspace and database operations use async APIs and cancellation where supported. Do not return raw Databricks error bodies, credentials, forwarded tokens, or SQL values to the browser.

## Persistence and integrations

Services depend on focused repository and adapter contracts. Repositories own PostgreSQL statements, parameterization, and transaction boundaries. Workspace clients derive the host from trusted App runtime configuration; user-triggered calls use the forwarded viewer token and do not retry a denial as the builder's service principal.

## Contract changes

When changing a route, update the request validator, response contract, frontend API function/hook, and tests for success and expected failures. Validate nested imports and generated source inputs on the server even when the browser already performs validation.
