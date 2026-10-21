# VDAB TypeScript and Databricks Apps Architecture

**Status:** Active architecture for VDAB's approved standalone Databricks App transition.  
**Last updated:** 2026-10-16.  
**Decision record:** [ADR 0002](../adr/0002-vdab-node-databricks-app.md).

This standard applies to all new VDAB backend code and to replacement code during the in-place conversion. The existing .NET architecture document remains a historical reference for the legacy implementation only. Do not add SaaS features or extend legacy .NET services as a shortcut around the transition.

## Runtime and boundaries

The product has three distinct runtimes:

1. The installed builder is a TypeScript/Node.js Databricks App.
2. The builder UI is the existing React 19 application, served by the installed app.
3. Generated child apps remain Python/Streamlit applications.

The active request flow is:

```text
React UI -> Node HTTP boundary -> application services -> repositories -> customer Lakebase Autoscaling
                                     |-> current workspace APIs and customer AI endpoints
                                     |-> Python/Streamlit generator and app deployment
```

Keep HTTP, business rules, persistence, workspace calls, and generated-code rendering in separate units. The HTTP layer authenticates the app session, constructs a trusted caller context, validates request shapes, invokes a service, and maps typed application errors to RFC 9457 Problem Details. Services own rules and orchestration. Repositories own SQL and transaction boundaries. Workspace adapters own Databricks API calls. The generator owns Python/Streamlit output.

Use small interfaces at real boundaries that need substitution or independent testing: Lakebase repositories, Databricks workspace APIs, app identity/current user, AI endpoints, and generated source/deployment. Avoid interface-per-class abstraction when there is no boundary or test value.

## Identity and workspace security

- The builder is installed in one customer workspace. Derive the workspace host from trusted Databricks App runtime configuration; never accept a browser host, PAT, refresh token, connection ID, tenant ID, or workspace URL as an API authority.
- Resolve the caller from Databricks App proxy-provided identity. Treat proxy identity/token headers as trusted only behind the Databricks App ingress. Local development must use a clearly separated test identity adapter and must never trust arbitrary forwarded headers.
- Use the forwarded user token for every user-initiated Databricks action that must respect that user's permissions. Request only documented scopes needed by implemented APIs. A denied user operation must not retry as the VDAB service principal.
- Use the VDAB app service principal only for explicitly approved shared/background tasks. Keep its resource grants narrow, and audit its use.
- Project access is creator/collaborator ACL in Lakebase. Databricks `CAN USE` on VDAB does not imply project membership or rights on child resources. Collaborator grants never elevate Databricks API rights.
- Do not log, export, persist in project data, or return user tokens, app secrets, database credentials, or generated credentials.
- Apply an authorization check to each project read/write and each external resource action. Hide unrelated projects as not found. Audit create/link/deploy/overwrite/retry/rollback and access-grant changes.

Current workspace scopes must be verified against the current Databricks Apps authorization docs and tested against the selected API/SDK. The current Apps guide lists `apps`, `files`, `genie`, `model-serving`, `postgres`, `sql`, and catalog SDK scopes, but describes Jobs as a user-authorization use case without listing a `jobs` scope; implementation must identify and prove the exact supported Jobs path before relying on it. The direct Volumes API's documented `unity-catalog` scope is not listed among the Apps scopes, and the guide does not list `scim` or `identity`. Do not infer endpoint authorization from the existence of an API or a scope.

## Lakebase persistence and migrations

- Store durable builder state in the customer-owned Lakebase Autoscaling database bound to this VDAB installation. Local filesystem, process memory, and app identity are not project persistence.
- Use parameterized PostgreSQL queries and explicit transaction boundaries. Repositories accept cancellation signals and return domain-shaped values; services do not construct SQL.
- Obtain database credentials through the supported Databricks/Lakebase OAuth mechanism at runtime. Do not write a static password into app configuration, source, or project exports. Refresh OAuth credentials as required by the selected driver.
- Migrations are versioned, append-only source files. Apply idempotent schema-version checks during installation setup, serialize concurrent migration runners, and never run an unreviewed migration against a shared database. Schema changes are tested against a disposable database before workspace validation.
- The application cannot assume it may provision the Lakebase project/database. The customer administrator binds an existing compatible resource and grants the permissions required by Databricks Apps.
- Test install-local isolation, restart/redeploy durability, upgrade compatibility, optimistic concurrency, project ACLs, audit entries, and backup/export behavior.

## HTTP and TypeScript conventions

- Keep browser routes same-origin under the versioned `/api/v1` contract. Use JSON with camelCase and RFC 9457 Problem Details for errors. Declare and test request/response examples as stable fixtures.
- Validate all untrusted input at the HTTP boundary, including nested project/component/workflow imports. Reject unknown authority-bearing fields such as workspace hosts, SaaS tenant IDs, external connection IDs, and secrets. Do not trust TypeScript types at runtime.
- Represent expected failures with typed error classes or discriminated results and map them centrally. Reserve thrown exceptions for unexpected infrastructure/programming failures; sanitize details at the HTTP boundary.
- Use `async`/`await`, `AbortSignal` for cancellable work, strict TypeScript, `unknown` for untrusted data, and one statement per line. Do not introduce `any` or sync I/O.
- Keep SQL identifiers constant or safely selected from allowlists; parameterize all values. Never build a SQL statement by concatenating user input.
- Use structured logs with request, actor, project, action, and result identifiers; omit tokens, SQL parameter values containing user data, connection secrets, and generated source that may contain user content.
- Keep public/exported TypeScript APIs documented with JSDoc. Keep HTTP handlers thin and services small enough to test independently.

## Repository layout and registration

The deployment source is `databricks-app/.build`, generated from the Node App source in `databricks-app/` and the existing client build. Keep the repository-root `package.json` intact because it is pre-existing tooling metadata, not the installed App manifest. Preserve the flat, role-oriented client structure documented in `AGENTS.md`. The server is organized by responsibility (`http/`, `services/`, `repositories/`, `integrations/`, `models/`, `db/`) and registered in one composition root. Do not add `controllers/` with business rules, frontend `services/`, a second frontend state store, or deep feature inheritance.

Use the Node built-in HTTP/runtime capabilities where they meet requirements. Any framework, ORM, validation library, telemetry library, Databricks SDK, or database client requires the repository's dependency evaluation and explicit user approval before it is added. Prefer the smallest reviewed dependency set; pin direct dependencies and commit the lockfile. Prefer official Databricks REST interfaces or SDKs only after documenting scope/auth behavior and package maturity.

The App package must expose a reproducible build/start flow compatible with Databricks Apps, bind to the runtime-provided port, serve the built UI and same-origin API, and provide a local mock-identity mode that is clearly marked as a development adapter. Production must fail closed if native identity or required resource bindings are missing. The generated `databricks-app/.build` output must be self-contained and exclude legacy SaaS/.NET source, local configuration, tests, and secrets. Deploy only this directory. A local mock passing is not Databricks evidence.

## React and generated apps

Use the existing React standards in `AGENTS.md`: TanStack Query for server state, React state/context for client state, centralized API modules, accessible shadcn/ui + Tailwind, and complete loading/error/empty states. Keep all agreed builder capabilities; a runtime or platform limitation must be recorded with evidence and brought back as a decision rather than silently removing a feature.

Generated apps remain Python/Streamlit. Generate reproducible, inspectable source. User-initiated SQL/Jobs work must use the viewer's Databricks identity where the platform supports it; an app identity is permitted only for separately approved shared background work. Never embed the builder's token, database credentials, or its privilege grants in generated code.

## Tests and delivery evidence

- Put tests by responsibility: HTTP/contract, services, repositories/database, workspace adapters, generator/runtime, and end-to-end app flows.
- Cover authorization allow and deny cases, consent/scope failures, empty resource lists, workspace pinning, project ACLs, stale versions, malformed/hostile imports, secret exclusion, and every retained component/workflow/story output.
- Keep a local test adapter for deterministic tests. Add live Databricks tests only against a confirmed disposable workspace and record actor role, workspace/app configuration, exact commands, request/result summaries, and cleanup.
- Run the focused slice, full regression suite, build, and assembled app smoke after each slice. Do not advance steps on unresolved failures. Separate inherited baseline failures from introduced regressions.
- A passing local test does not prove Marketplace installation, customer-workspace scopes, child-app creation, Lakebase binding, or publication. Record each as verified only after it actually ran.

## Legacy .NET boundary

The current .NET/Aspire/EF code remains source material only while replacement slices are developed. Existing .NET-specific instructions in `AGENTS.md` and `dotnet-react-architecture.md` apply only to legacy code that must be inspected or temporarily maintained during the transition. Do not add new product behavior there. Delete each legacy source group only after its Node replacement and parity tests pass, as required by the retirement manifest.
