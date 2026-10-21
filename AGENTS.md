# AGENTS.md

**Last Updated:** 2026-10-16
**Generated from AGENTS template version:** 2026-06-17

Guidance for AI coding agents working in this repository. Human-facing contribution policy (branch protection, PR process, QA expectations) lives in the team's contributing docs and is not duplicated here.

## How to Use This File

This file is the **primary** source of rules for agents. Read it in full before making changes.

The **secondary references** below contain concrete code patterns and task workflows. Read them only when the trigger applies:

| Reference | Read it when |
| --- | --- |
| [Node Databricks App architecture](.documentation/standards/node-databricks-app-architecture.md) | Implementing the active Node backend, Lakebase repositories, Databricks integrations, or generated-app behavior. |
| [Legacy .NET backend patterns](.documentation/standards/backend-patterns.md) | Inspecting or temporarily maintaining an existing .NET controller, service, repository, EF configuration, typed error, mapping, current-user lookup, or transaction during retirement. |
| [Frontend patterns](.documentation/standards/frontend-patterns.md) | Implementing or modifying a React component, custom hook, model class, API module, or context. |
| [Pull request workflows](.documentation/standards/pull-requests.md) | The user asks you to review a pull request / branch, or to draft a PR description to paste into Azure DevOps. |

Two **canonical standards documents** ship with this repo as the human-readable source with reasoning and citations. Read them only when:

| Standards document | Read it when |
| --- | --- |
| [Xorbix Development Standards](.documentation/standards/xorbix-dev-standards.md) | A reviewer challenges a rule, you need the reasoning behind a principle for a discussion or ADR, or you're proposing a change to a rule itself. |
| [Node Databricks App architecture](.documentation/standards/node-databricks-app-architecture.md) | You need the active VDAB backend boundaries, identity, Lakebase, security, or delivery guidance. |
| [Legacy .NET API + React architecture](.documentation/standards/dotnet-react-architecture.md) | You need a worked example for existing .NET source or are reviewing its historical design. |

If this file conflicts with the standards docs on a rule, **this file wins**. If you believe a rule should not apply, do not silently ignore it. State the rule, your reasoning, and propose either a deviation entry or a standards-doc update before proceeding.

If a secondary reference or canonical standards document is missing when you read this file, stop and ask the user to resolve it before making changes that depend on it.

## Standards Conformance Posture

**This project's posture: STRICT**
**Strict.** VDAB is new development. All new and modified code must conform to the rules in this file. When a proposed change would violate a rule, stop and propose the conforming alternative before proceeding. The only allowed deviations are listed under [Name Mapping](#name-mapping) and [Known Deviations](#known-deviations).

## Project Overview

**Xorbix Visual Databricks App Builder (VDAB)** is a standalone Databricks App for building and deploying Python/Streamlit applications inside the workspace where VDAB is installed. Users visually arrange UI components, story visualizations, workflows, and custom modules, bind them to current-workspace resources, use customer-configured Databricks AI endpoints, preview output, and deploy child apps. Each installation starts fresh and does not connect to the former SaaS product or import SaaS users/projects.

**Stack:**
- Builder backend: TypeScript/Node.js, packaged and run as a Databricks App
- Frontend: React 19 + React Router v7 (Framework Mode) + shadcn/ui + Tailwind CSS
- Durable builder state: customer-owned Lakebase Autoscaling PostgreSQL bound to each VDAB installation
- Generated applications: Python + Streamlit
- Architecture: Node HTTP boundary → application services → repositories → Lakebase, with isolated workspace API and code-generation adapters
- Former .NET/Aspire/EF implementation: temporary parity reference only; retire each source group after its replacement passes the plan's parity checks

## Repository Layout

```
databricks-app/                                        # Node App source and self-contained deployment output
  app.yaml                                             # Databricks Apps runtime configuration
  package.json                                         # Builder/test package; release artifact has a production-only manifest
  server/                                              # HTTP, services, repositories, adapters, generator, and Lakebase migrations
  test/                                                # Node contract, service, adapter, and package tests
  .build/                                              # Generated deployment package; ignored by Git
xorbix-visual-databricks-app-builder.client/           # Existing React frontend source; bundled into databricks-app/.build/public
scripts/                                               # Cross-platform packaging and repository maintenance tools
.documentation/databricks-app-transition/              # Ordered plan, contracts, parity, evidence, and durable handoff
Xorbix-Visual-Databricks-App-Builder.*                 # Legacy .NET source, temporary parity reference until step 8 retires it
.documentation/                                       # Standards, patterns, plans, references
```

## Name Mapping

These mappings describe the legacy .NET source only. They are not the active architecture for new VDAB code.

| Canonical | VDAB | Role |
| --- | --- | --- |
| `Company.Project.Api` / `.Server` | `.Server` | Controllers, middleware, DI composition root |
| `Company.Project.Services` | `.Services` | Business logic |
| `Company.Project.Infrastructure` / `.Data` | `.DataAccess` | EF Core, repositories, migrations |
| `Company.Project.Contracts` | `.Models` | DTOs, requests, responses, enums, constants, **entities**, config POCOs, typed errors |
| `Company.Project.ServiceDefaults` | `.ServiceDefaults` | Shared telemetry / health-check helpers |
| `Company.Project.AppHost` | `.AppHost` | Aspire orchestration |

During transition, entities remain in legacy `.Models` for source tracing. The Node backend's shared request/response contracts live in TypeScript and are not referenced by the retired C# layers.

---

## Principles

These are the load-bearing rules. Apply them constantly.

- **Simplicity is the default.** Favor clear, straightforward code. If a solution needs a comment to explain *why it works*, look for a simpler one first.
- **DRY, but not premature.** Eliminate true duplication; do not abstract away coincidental similarity.
- **YAGNI.** Build what is needed today. No speculative features, abstractions, or infrastructure.
- **One responsibility per unit.** HTTP handlers handle HTTP. Services hold business logic. Repositories handle data access. UI components render and respond. Splitting these is not a suggestion.
- **Depend on abstractions.** Application services depend on focused repository/integration boundaries, not database drivers or HTTP request objects. HTTP handlers depend on services, not SQL.
- **Favor composition over deep inheritance.** Compose small focused objects; avoid deep hierarchies.
- **Be proactive about complexity.** When a unit exceeds size or complexity threshold, ask the user if a refactor is within scope.
- **Fail fast and fail explicitly.** Validate at the boundary, check preconditions early, and use explicit typed outcomes over ambiguous nulls or swallowed exceptions.
- **Talk only to immediate collaborators.** No chains like `order.GetCustomer().GetAddress().GetCity()`.
- **Leave code better than you found it.** Make small, in-scope improvements; do not opportunistically restructure unrelated files.
- **Design for extension without modification.** New behavior should be addable without rewriting tested code.
- **Consistency within a codebase wins over absolute style adherence.** Match nearby code.
- **Behave predictably.** Method names describe what they do. Side effects are obvious. No surprises.
- **Comments explain *why*, not *what*.** Do not remove existing comments without reason. Never remove `TODO` comments.
- **No magic strings or numbers.** Extract to named constants, enums, or configuration. Keep shared API/domain constants in the server's contracts module.
- **Keep units small.** Targets in [Size & Complexity Targets](#size--complexity-targets). When a unit crosses a threshold, evaluate whether it is doing too much.
- **Names communicate intent.** Describe what something represents, not how it's implemented. Use standard opposite pairs (`min`/`max`, `start`/`end`, `open`/`close`, `first`/`last`). Put computation qualifiers at the end (`totalAmount`, `averageScore`, `minimumValue`, `customerIndex`). Avoid vague words (`flag`, `data`, `item`, `object`, `manager`) unless context makes the meaning unmistakable. Avoid abbreviations and acronyms. One statement per line.
- **Document for the toolchain.** Use XML docs for retained C# legacy code and JSDoc/type hints for TypeScript and Python — the kind tooling can consume.
- **Optimize when the profiler says so.** Correct and readable first. Optimize when measured.
- **No new dependencies without approval.** See [Dependency Approval](#dependency-approval).

## Size & Complexity Targets

Signals, not hard rules. When a unit approaches a threshold, surface a refactor in the same change. Do not extend refactors beyond the scope of the existing task.

| Unit | Target |
| --- | --- |
| Backend method | ≤ 50 LOC |
| Backend class / file | ≤ 500 LOC |
| HTTP handler | ≤ 500 LOC |
| Service method | ≤ 40 LOC |
| React component | ≤ 300 LOC |
| Cognitive complexity (any method) | ≤ 15 |

## Dependency Approval

Do not add new third-party packages (NuGet, npm, PyPI, etc.) without explicit approval. If the task cannot reasonably be completed without a new dependency, stop before writing code, present the Dependency Approval evaluation, and wait for approval.

Dependency approval evaluation:
- **Security:** known CVEs from `dotnet list package --vulnerable`, `npm audit`, `pip-audit`. Unpatched CVEs disqualify.
- **License:** MIT / Apache 2.0 / BSD preferred. Copyleft requires legal review.
- **Maintenance health:** recent releases, multiple maintainers, responsive issues.
- **Scope appropriateness:** the value clearly outweighs the long-term maintenance cost. If you need one utility function, write it.
- **Bundle / deployment impact:** size delta for frontend, startup time for backend.

---

## Active Node.js Backend Rules

Follow `.documentation/standards/node-databricks-app-architecture.md` for the complete backend architecture. These rules apply to all active backend work:

- Use TypeScript in strict mode on the supported Node.js runtime for Databricks Apps. Keep HTTP, application services, repositories, workspace integrations, and code generation in separate responsibilities.
- Keep handlers thin: authenticate through trusted Databricks App context, validate untrusted input, call a service, and map typed results to the versioned HTTP contract. Use same-origin `/api/v1` routes and RFC 9457 Problem Details.
- Use customer Lakebase Autoscaling as the durable store. Use parameterized PostgreSQL operations and transactions in repositories. Version append-only migrations and test them against a disposable database before workspace use.
- Derive the Databricks workspace from trusted App runtime configuration. Use forwarded user authorization for user-triggered Databricks actions and check the acting user's scopes, consent, and resource permissions. Never fall back to VDAB's service principal after a denial.
- Use the VDAB service principal only for approved shared/background operations. Never log or persist tokens, app secrets, Lakebase credentials, or generated credentials.
- Use `async`/`await`, `AbortSignal`, explicit TypeScript types, `unknown` for untrusted values, and runtime validation. Do not use `any`, synchronous I/O, unparameterized SQL, or client-supplied workspace authority.
- Use `package.json` scripts and a committed lockfile for reproducible local/Databricks builds. Bind to `DATABRICKS_APP_PORT` when present. A local mock adapter is not evidence of Databricks behavior.
- Do not add any third-party package before its security, license, maintenance, scope, and deployment-impact review is recorded and the user explicitly approves it.

## Legacy C# / .NET Rules

These rules apply only to existing .NET code that must be inspected or temporarily maintained before retirement. Do not add VDAB product features to the legacy stack.

- Target .NET 10+, C# 14+. Use modern features (primary constructors, collection expressions, `required`, pattern matching, records) where they clarify intent.
- **Naming:** `PascalCase` for classes, methods, properties, public fields, constants, namespaces. `camelCase` for private fields, locals, parameters. `I` prefix on interfaces. `Dto` / `Request` / `Response` suffixes on DTOs. Entities singular; tables plural.
- **File-scoped namespaces.** `namespace Xorbix...;`
- **Separate Interfaces and implementation** into separate files
- **Explicit local variable types.** `Policy? policy = ...` not `var policy = ...`. Exception: anonymous types.
- **Nullable reference types** wherever null is valid.
- **`async`/`await` throughout.** Never block: no `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`.
- **Constructor injection only.** No property injection, no method injection, no service locator. Inject `ILogger<T>`, never use a static logger.
- **`IOptions<T>` for configuration.** Bind from `appsettings*.json`. Config POCO type name = section name.
- **XML docs on public members.** Full text on the **interface**; `<inheritdoc/>` on the implementation.
- **Structured logging.** `logger.LogWarning("Policy {PolicyId} not found", id)` — never string interpolation in the message template.
- **Reserve exceptions for genuinely exceptional conditions** (network, corrupted state). Expected failures use `Result<T>`.

## Legacy FluentResults

- Service methods return `Result<T>` or `Result`. Controllers consume them and map to HTTP via the shared `HandleFluentResult` extension.
- **Prefer typed errors over `Result.Fail("string")`.** A plain-string failure still works, but an untyped error falls through to the default `400 Bad Request` mapping. Use a typed error from `Models/FluentErrors.cs` whenever you need to control the HTTP status code returned to the user or let the caller fork business logic on the failure type:
  - `BadRequestError` → 400
  - `NotFoundError` → 404
  - `UnauthorizedError` → 401
  - `ForbiddenError` → 403
  - `ConflictError` → 409
  - `GoneError` → 410
  - `ValidationError` → 400
  - `NotImplementedError` → 501
  - `UpstreamDependencyError` → 502
  - `AcceptedSuccess` → 202 (success, not error)
  - Domain-specific subclasses: `CodeNameValidationError`, `PartialDatabricksProvisionError`, `IdentityValidationError`, `IdentityDuplicateError`.
- **Adding a new failure mode:** add a typed error to `FluentErrors.cs`. If it maps to the same HTTP status as an existing one, subclass that error (e.g., `CodeNameValidationError : BadRequestError`) so `HandleFluentResult` keeps working without changes.

## Legacy .NET API Design

- Plural nouns, HTTP method is the verb. `/api/policies`, `/api/policies/{id}`. No verbs in URLs.
- Standard verbs: `GET` list / by-id, `POST` create, `PUT` full update, `PATCH` partial update, `DELETE` delete.
- **Controllers handle HTTP only.** Accept request, validate model state, delegate to service, map `Result<T>` to HTTP via `HandleFluentResult`. No business logic.
- **Action return type carries the success shape.** `HandleFluentResult` returns the non-generic `ActionResult`, but actions still declare `Task<ActionResult<T>>` when they return a body and `Task<ActionResult>` when they don't — the declared `T` drives OpenAPI/Scalar 200-body inference. Do not "simplify" a body-returning action to `Task<ActionResult>`, and do not change `HandleFluentResult` to return `ActionResult<T>` (its error paths produce `ProblemDetails`, so the non-generic return is correct).
- **Document non-200 statuses with attributes.** The signature only conveys the 200 body. Declare every other outcome a caller depends on with `[ProducesResponseType(StatusCodes.Status404NotFound)]` (and similar); error bodies are `ProblemDetails` via the global convention.
- Validate at the boundary: ModelState + FluentValidation. Validators live in `Server/Validators/`. Prefer FluentValidation for business-rule validation; use ModelState/DataAnnotations only for basic null/required/format checks. Do not duplicate rules across both.
- Authenticated controllers extend `AuthenticatedControllerBase` for cached claim access.

## Legacy Database & EF Core Rules

- **EF Core only.** Avoid raw SQL unless EF cannot meet a documented performance need; document the justification when used. When raw SQL is necessary: uppercase keywords (`SELECT`, `FROM`, `WHERE`, `JOIN`, `ORDER BY`), parameterized queries only (never string concatenation), and an inline comment explaining why EF couldn't be used.
- **All queries are async.** `await context.Users.ToListAsync()` — never `.ToList()`.
- **Services never inject `DbContext`.** Use repositories.
- **Repository pair per entity.** `INameRepository.cs` + `NameRepository.cs` in `.DataAccess`. Extend the generic `IRepository<T>` where applicable.
- **Read queries use `AsNoTracking()`** in the generic repository.
- **All repository methods accept `CancellationToken`.**
- **Entity configurations** use `IEntityTypeConfiguration<T>`, one per file. Table names come from constants, not magic strings.
- **DateTime is UTC.** A global value converter enforces this on read and write. Do not bypass it.
- **All schema changes go through EF Core migrations.** Never modify a shared database directly. Review generated migrations before applying. Confirm with the team lead before creating migrations against shared environments.
- **Migrations are append-only.** Do not modify a migration that has been applied anywhere shared — create a new one.
- **Seed data is a migration.** Roles, lookups, and reference data are seeded via empty (blank-scaffolded) migrations so they are versioned, repeatable, and ordered with schema changes. Never seed via ad-hoc scripts run against the database.
- **Transactions** use `TransactionScope` with `TransactionScopeAsyncFlowOption.Enabled`. Services do not need direct `DbContext` access.
- **Soft delete** uses a nullable `DeletedOn` timestamp. Repositories filter out soft-deleted records by default.
- **No navigation property cycles.** Configure cascade delete behavior deliberately.

## TypeScript / JavaScript

- All new code in TypeScript. `strict` mode enabled.
- **Avoid `any`.** Use `unknown` and narrow with type guards when the type is genuinely unknown.
- **Naming:** `camelCase` for variables/functions/properties. `PascalCase` for classes, interfaces, type aliases, enums, components. `UPPER_SNAKE_CASE` for true constants. `I` prefix on interfaces only for model contracts mirroring a backend interface; unprefixed for props and internal types.
- **Prettier** formats on save.
- **Models vs. types:** Models are for data (live in `src/models` as interface + class). Types are for code (live in `src/types`, or inline in the component when single-use). See full table under [Frontend conventions](#frontend-conventions).

Backend types and API contracts use the active Node rules above and the versioned transition contracts. Do not use C# `I`-prefixed interface conventions for TypeScript types unless the interface mirrors a backend interface contract.

## React

- **State management:** separate **server state** from **client/UI state**.
  - **Server state** (entities, lookups, DTOs fetched from the API) → **TanStack Query** (`@tanstack/react-query`), the Xorbix standard and pre-approved (no dependency approval needed). Query/mutation hooks live one-per-entity in `src/hooks/`, each owning a query-key factory; the `QueryClient` lives in `src/lib/` with the provider mounted at the app root. Do not hand-roll `useState` + `useEffect` + `fetch` for server data.
  - **Client/UI state** → `useState` / `useContext`. No Redux / MobX / Zustand (client-state stores) without dependency approval.
- **Router:** React Router v7 Framework Mode. Centralized route config in `routes.ts`.
- **UI library:** shadcn/ui in `src/components/ui/` + Tailwind CSS. Do not mix in other component libraries.
- **Component shape:**
  - Always define `interface I<ComponentName>Props` above the component.
  - Wrap props with `Readonly<...>` in the parameter signature.
  - `function` declaration or `const` arrow — match surrounding file.
  - Exactly one default export per file, matching the filename.
- **One component per file.** Trivial presentational helpers (≤ ~20 LOC, single-use) may stay; otherwise extract.
- **One hook per file** in `src/hooks/` (or feature-local `hooks/`), named after the hook.
- **Utilities grouped by purpose** (`dateFormatting.ts`, `csvExport.ts`). No `helpers.ts` / `utils.ts` / `misc.ts`.
- **Do not mix concerns:** a `.tsx` file does not define a component *and* a hook *and* utilities. Extract.
- **When extending a file that already violates these rules,** split the violations out as part of the same change.
- **UX baseline:** responsive layouts, accessibility (WCAG 2.2 AA), loading/error states, navigation guards, confirmation on destructive actions are part of initial implementation — not "we'll fix it later."
- **API layer:** all API calls live in `src/api/` as named functions per resource (pure HTTP — the raw `queryFn`s); the TanStack Query hooks in `src/hooks/` wrap them. Errors surface to the user via toast/snackbar — never swallowed silently.

### Models vs. Types

| Scenario | Location | Pattern |
| --- | --- | --- |
| API request/response | `src/models` | interface + class (allows defaults via `new LoginRequest()` and validation) |
| Database / business entity | `src/models` | interface + class (allows computed properties, date parsing in constructor) |
| Component props | in the `.tsx` file | `interface I<Component>Props` — reference `src/models` types, do not redefine |
| Shared UI config | `src/types` | `interface` / `type` — inline if used by a single component |
| Enums / constants | `src/types` | `enum` for shared fixed lists |

UI and API models representing the same entity share a name and stay as close in shape as possible.

## HTML / CSS / Accessibility

- Use semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>`) over generic `<div>` / `<span>` where applicable.
- All user-facing pages meet **WCAG 2.2 Level AA** as a minimum: ARIA attributes, sufficient color contrast, keyboard navigability, meaningful `alt` text.
- Tailwind only. Do not mix utility-first and traditional CSS.

## Python (if used in tooling / scripts)

- Follow PEP 8. `snake_case` functions/vars, `PascalCase` classes, `UPPER_SNAKE_CASE` module constants. 88-character line limit (Ruff/Black default).
- **Type hints on all function signatures.** `from __future__ import annotations` for forward refs.
- **Docstrings (PEP 257)** on public functions, classes, modules. Google-style format (`Args:`, `Returns:`, `Raises:`).
- Type checking with mypy or Pyright in CI when Python is part of the build.

## Testing

- **Every change builds and runs.** Test manually before submitting.
- **AAA** structure: Arrange, Act, Assert.
- **Naming:** `MethodName_StateUnderTest_ExpectedBehavior`.
- **FIRST:** Fast, Independent, Repeatable, Self-validating, Timely.
- **Update or add tests when behavior changes.** Untested behavior is unverified.
- **Place tests by responsibility.** Even though VDAB uses a single `.Tests` project (see [Known Deviations](#known-deviations)), keep tests organised by the canonical boundaries inside it:
  - `Arch/` — layering and dependency-direction rules.
  - `Services/` — business logic and `Result<T>` handling, with mocked repositories.
  - `Server/` — controllers, HTTP status mapping, `ProblemDetails` output, authorization behavior.
  - `DataAccess/` — repository queries, EF configurations, migration-related tests.
- **Coverage is a signal, not the goal.** Aim for ~80% as a floor and focus on covering risk: branching business rules, controller error mapping, and repository edge cases. Do not pad coverage with tests that don't assert behavior.

## Security

- Validate every API input at the Node HTTP boundary, including nested imports. Never trust client-side validation or TypeScript types alone.
- Authenticate through the Databricks App proxy and enforce project ACLs plus each acting user's Databricks permissions. Reject spoofed proxy identity outside the trusted ingress. Never retry a denied user action as the app service principal.
- **Never commit or log secrets.** Use Databricks-managed App identity and Lakebase OAuth credentials; do not add a secret-based workspace connection flow.
- Keep dependencies current; run `npm audit` for Node/client packages. Run `dotnet list package --vulnerable` only while reviewing the temporary legacy .NET source.

## Documentation

- **C#:** XML doc comments on public members. Full text on interfaces; `<inheritdoc/>` on implementations.
- **TypeScript:** JSDoc on exported functions and complex types.
- **Python:** Google-style docstrings on public functions, classes, modules.
- **ADRs** for significant architectural decisions, in `.documentation/adr/`.

---

## Architecture: Layers and Responsibilities

The active VDAB architecture is:

```text
React client -> Node HTTP boundary -> application services -> repositories -> customer Lakebase
                                      \-> workspace/AI adapters and Python/Streamlit generator
```

No layer may skip the next boundary. HTTP handlers do not contain business rules or SQL. Services do not access HTTP objects or construct SQL. Repositories own PostgreSQL access. Workspace integrations use the installed workspace and the acting user's scoped token for user-triggered actions. Code generation is deterministic and separately tested. See [the active architecture standard](.documentation/standards/node-databricks-app-architecture.md).

### Legacy .NET architecture (retirement reference)

The following sections document the current source tree only. They are not instructions for new backend code.

```
Controllers (.Server) → Services (.Services) → Repositories (.DataAccess) → Database
                                            ↘ .Models (entities, DTOs, mapping, errors, constants) ↙
```

Strict layering. No skipping layers. No reverse references.

### `.Server` (Presentation)

- Responsibility: HTTP contract — accept request, validate, delegate, map result to response.
- May reference: `.Services`, `.Models`, `.ServiceDefaults`. The composition root (`Program.cs`) may also reference `.DataAccess` for DI registration only.
- Must not: contain business logic, talk to `DbContext`, use repositories directly.
- Contains: controllers, middleware, filters, validators, `Program.cs`, DI extension methods, the `HandleFluentResult` controller extension, `AuthenticatedControllerBase`.

### `.Services` (Business Logic)

- Responsibility: all business logic, domain rules, orchestration, workflow.
- May reference: `.DataAccess` (via repository interfaces only), `.Models`.
- Must not: reference `.Server`. Must not inject `DbContext`.
- Contains: `INameService.cs` + `NameService.cs` pairs at the project root (not under `Interfaces/`). (Mapping extensions live in `.Models/Mapping/`, not here — see [`.Models`](#models).)

### `.DataAccess`

- Responsibility: EF Core `DbContext`, repositories, entity configurations, migrations.
- May reference: `.Models`.
- Must not: reference `.Server` or `.Services`.
- Contains: `ApplicationDbContext`, `INameRepository.cs` + `NameRepository.cs` pairs at the project root, `Configurations/`, `Migrations/`, value converters.

### `.Models`

- Responsibility: all shared types. No logic, with one deliberate exception: entity↔DTO mapping extensions.
- May reference: nothing (leaf dependency).
- Referenced by: every other project.
- Contains: entities, DTOs, requests, responses, enums, constants (including `TableNames`, `SchemaNames`), `FluentErrors.cs`, `Config/` POCOs, and mapping extensions in `Mapping/` (the only logic permitted in `.Models`).

### `.ServiceDefaults`

- Responsibility: shared telemetry, health checks, service discovery wiring (`AddServiceDefaults` extension).
- Used by: `.Server` (and any future service project) via `builder.AddServiceDefaults()`.

### `.AppHost` (Aspire)

- Responsibility: local-development orchestration only. Starts projects + dev backing resources (Postgres, etc.).
- Must not: contain business logic, middleware, controllers, or any production runtime code.
- Must not: modify the `builder.Build().Run()` sequence.
- Never deployed. Production resource provisioning lives in `infra/` and the CI/CD pipeline.

### Request flow for a feature `Name`

```
NameApi.ts → NameController.cs → INameService → INameRepository → DbContext
```

Never short-circuit a layer. A controller calling a repository, a service injecting `DbContext`, or a `.Models` class taking a dependency on `.DataAccess` is a **structural bug** — stop and propose the correct structure.

---

## Legacy Project-Specific Backend Conventions

- **Service interfaces sit alongside implementations** at the `.Services` project root, not in `Interfaces/`.
- **Repository interfaces sit alongside implementations** at the `.DataAccess` project root.
- **Configuration POCOs** live in `Models/Config/`. Section name in `appsettings*.json` must match the POCO type name.
- **DI registration:** each layer exposes a `ServiceCollectionExtensions` with `AddXxxServices(this IServiceCollection)`. Register new services through the appropriate extension, not directly in `Program.cs`.
- **Encryption:** symmetric encryption goes through `IEncryptionHelper` (`Xorbix-Visual-Databricks-App-Builder.DataAccess`). Do not call cryptography primitives directly from services.

## Project-Specific Frontend Conventions

- **Folder layout:** flat, role-based under `src/` — `api/`, `components/` (with `ui/` for shadcn primitives), `context/`, `hooks/`, `layouts/`, `lib/`, `models/`, `pages/`, `types/`, `utils/`. Group by what a file is, not by feature. The TanStack Query `QueryClient` lives in `lib/`; the provider mounts at the app root. No frontend `services/` or `store/` folder.
- Routing entry points: `root.tsx`, `entry.client.tsx`, `routes.ts`.
- shadcn/ui components live in `src/components/ui/`. Add new shadcn components via the shadcn CLI; do not hand-roll wrappers around them.
- Tailwind only. Prettier on save.

## Style Quick Reference

- **Node TypeScript:** strict types, `unknown` for untrusted values, asynchronous I/O, JSDoc on exported APIs.
- **Legacy C#:** explicit local variable types, nullable references, file-scoped namespaces, XML docs on interfaces with `<inheritdoc/>` on implementations.
- **TypeScript:** `camelCase` vars, `PascalCase` components/types, Prettier on save.
- **Both:** `async`/`await` throughout. Never block on async work.

## Environments

The previous Azure development URL belongs to the legacy SaaS deployment. A Databricks development workspace and installed VDAB URL are not yet verified; see `.documentation/databricks-app-transition/progress-and-handoff.md`.

## Build, Test, and Run

The Node package builds a self-contained deployment artifact and never deploys the repository root while legacy code remains.

```bash
# Node Databricks App (Node.js 22.16+)
cd databricks-app
npm run install:all
npm run build
npm run smoke
npm test
npm start
# Deploy the generated .build directory, not the repository root.

# Backend + frontend together via Aspire
dotnet build Xorbix-Visual-Databricks-App-Builder.AppHost/Xorbix-Visual-Databricks-App-Builder.AppHost.csproj

# Frontend only
cd xorbix-visual-databricks-app-builder.client
npm install
npm run dev

# Local Postgres: managed by the Aspire AppHost. Set Database:UseExistingDatabase = false in
# Xorbix-Visual-Databricks-App-Builder.AppHost/appsettings.Local.json (see appsettings.Local.example.json)
# to let Aspire run the Postgres container and apply migrations + seed data via the MigrationService.
# The default (true) expects an already-running database at ConnectionStrings:PostgreSql.
```

## Known Deviations

These differences describe the legacy .NET source and must not be reproduced in the Node backend. Do not spend transition scope "correcting" legacy architecture except when needed to replace a feature safely.

- **Project names** use legacy `.Models` / `.DataAccess` instead of `.Contracts` / `.Infrastructure`. See [Name Mapping](#name-mapping).
- **No `src/` parent folder.** Projects live at the repo root. New projects follow the same convention.
- **Service and repository interfaces** sit alongside their implementations at the project root, not in `Interfaces/` subfolders.
- **Entities live in `.Models`**, not in a separate `Infrastructure/Entities/` folder.
- **Single `.Tests` project** instead of the canonical split into `*.Arch.Tests` / `*.Services.Tests` / `*.Server.Tests` / `*.Infrastructure.Tests`. Tests are organised by folder inside the one project — see [Testing](#testing).

## Agent-Specific Notes

- **Full vertical slice.** For active Node work, implement the contract, Lakebase/workspace adapter, service, HTTP route, client API/query hook/UI, tests, docs, and local/Databricks evidence as one slice. See [Node architecture](.documentation/standards/node-databricks-app-architecture.md), the transition plan, and [frontend patterns](.documentation/standards/frontend-patterns.md). The legacy C# vertical-slice rules apply only when maintaining legacy source.
- **Deployment boundary.** Build and deploy only `databricks-app/.build`; never deploy the repository root while legacy SaaS/.NET source remains. The artifact contains its own runtime configuration, production manifest/lockfile, Node sources, and built `public/` assets.
- **Layer violations are blocking.** Stop and propose the Node-conforming structure rather than skipping a boundary.
- **New third-party dependencies** require the [Dependency Approval](#dependency-approval) evaluation. Surface the proposal — do not add unilaterally.
- **Files already over size targets** are extended via extraction/refactor, not by piling on more code.
- **Lakebase schema changes** use reviewed, append-only migrations. Do not run migrations against shared databases; use a disposable test database and require explicit team-lead confirmation before any shared-environment migration.
- **When this file conflicts with the canonical standards documents on a project-specific topic, this file wins.** The standards docs win for principles and reasoning.
