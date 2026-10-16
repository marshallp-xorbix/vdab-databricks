# AGENTS.md

**Last Updated:** 2026-06-17  
**Generated from AGENTS template version:** 2026-06-17

Guidance for AI coding agents working in this repository. Human-facing contribution policy (branch protection, PR process, QA expectations) lives in the team's contributing docs and is not duplicated here.

## How to Use This File

This file is the **primary** source of rules for agents. Read it in full before making changes.

The **secondary references** below contain concrete code patterns and task workflows. Read them only when the trigger applies:

| Reference | Read it when |
| --- | --- |
| [Backend patterns](.documentation/standards/backend-patterns.md) | Implementing or modifying a controller, service, repository, EF configuration, typed error, mapping, current-user lookup, or transaction. |
| [Frontend patterns](.documentation/standards/frontend-patterns.md) | Implementing or modifying a React component, custom hook, model class, API module, or context. |
| [Pull request workflows](.documentation/standards/pull-requests.md) | The user asks you to review a pull request / branch, or to draft a PR description to paste into Azure DevOps. |

Two **canonical standards documents** ship with this repo as the human-readable source with reasoning and citations. Read them only when:

| Standards document | Read it when |
| --- | --- |
| [Xorbix Development Standards](.documentation/standards/xorbix-dev-standards.md) | A reviewer challenges a rule, you need the reasoning behind a principle for a discussion or ADR, or you're proposing a change to a rule itself. |
| [Xorbix .NET API + React Architecture](.documentation/standards/dotnet-react-architecture.md) | You need a worked end-to-end example beyond what the backend pattern reference shows, or you're proposing an architectural change. |

If this file conflicts with the standards docs on a rule, **this file wins**. If you believe a rule should not apply, do not silently ignore it. State the rule, your reasoning, and propose either a deviation entry or a standards-doc update before proceeding.

If a secondary reference or canonical standards document is missing when you read this file, stop and ask the user to resolve it before making changes that depend on it.

## Standards Conformance Posture

**This project's posture: STRICT**
**Strict.** VDAB is new development. All new and modified code must conform to the rules in this file. When a proposed change would violate a rule, stop and propose the conforming alternative before proceeding. The only allowed deviations are listed under [Name Mapping](#name-mapping) and [Known Deviations](#known-deviations).

## Project Overview

**Xorbix Visual Databricks App Builder (VDAB)** is a low-code platform with a chatbot feature for building and deploying apps to the Databricks environment. Users visually arrange UI components (tables, charts, filters, buttons, forms) on a canvas and bind them to Databricks SQL queries, Delta tables, or ML models. The builder generates a runnable app and deploys it directly to Databricks with authentication and Unity Catalog governance.

**Stack:**
- Backend: .NET 10 with Azure Aspire orchestration
- Frontend: React 19 + React Router v7 (Framework Mode) + shadcn/ui + Tailwind CSS
- Database: PostgreSQL (Databricks Lakebase) via EF Core; local Postgres managed by the Aspire AppHost
- Architecture: N-Layer (Controller → Service → Repository → Database)

## Repository Layout

```
Xorbix-Visual-Databricks-App-Builder.AppHost/         # Aspire orchestration entrypoint (dev-time only)
Xorbix-Visual-Databricks-App-Builder.Server/          # ASP.NET Core API: controllers, middleware, DI composition root
Xorbix-Visual-Databricks-App-Builder.Services/        # Business logic: services + interfaces
Xorbix-Visual-Databricks-App-Builder.DataAccess/      # EF Core repositories, DbContext, migrations, entity configurations
Xorbix-Visual-Databricks-App-Builder.Models/          # Entities, DTOs, requests, responses, enums, constants, config POCOs, FluentErrors
Xorbix-Visual-Databricks-App-Builder.ServiceDefaults/ # Shared telemetry, health checks, service discovery
Xorbix-Visual-Databricks-App-Builder.MigrationService/ # One-shot EF migration worker, run only from the Aspire AppHost graph
Xorbix-Visual-Databricks-App-Builder.Tests/           # Unit + integration tests
xorbix-visual-databricks-app-builder.client/          # React frontend
.documentation/                                       # Standards, patterns, plans, references
```

## Name Mapping

VDAB project names differ from the generic names used in the canonical architecture document. These are naming differences only, not architectural deviations.

| Canonical | VDAB | Role |
| --- | --- | --- |
| `Company.Project.Api` / `.Server` | `.Server` | Controllers, middleware, DI composition root |
| `Company.Project.Services` | `.Services` | Business logic |
| `Company.Project.Infrastructure` / `.Data` | `.DataAccess` | EF Core, repositories, migrations |
| `Company.Project.Contracts` | `.Models` | DTOs, requests, responses, enums, constants, **entities**, config POCOs, typed errors |
| `Company.Project.ServiceDefaults` | `.ServiceDefaults` | Shared telemetry / health-check helpers |
| `Company.Project.AppHost` | `.AppHost` | Aspire orchestration |

**Entities live in `.Models`** — not in a separate `Infrastructure/Entities/` folder. Treat `.Models` as the canonical Contracts project plus entities.

---

## Principles

These are the load-bearing rules. Apply them constantly.

- **Simplicity is the default.** Favor clear, straightforward code. If a solution needs a comment to explain *why it works*, look for a simpler one first.
- **DRY, but not premature.** Eliminate true duplication; do not abstract away coincidental similarity.
- **YAGNI.** Build what is needed today. No speculative features, abstractions, or infrastructure.
- **One responsibility per unit.** Controllers handle HTTP. Services hold business logic. Repositories handle data access. UI components render and respond. Splitting these is not a suggestion.
- **Depend on abstractions.** Services depend on `IRepository<T>`, not `DbContext`. Controllers depend on `IUserService`, not `UserService`.
- **Favor composition over deep inheritance.** Compose small focused objects; avoid deep hierarchies.
- **Be proactive about complexity.** When a unit exceeds size or complexity threshold, ask the user if a refactor is within scope.
- **Fail fast and fail explicitly.** Validate at the boundary, check preconditions early, prefer explicit `Result<T>` over null or swallowed exceptions.
- **Talk only to immediate collaborators.** No chains like `order.GetCustomer().GetAddress().GetCity()`.
- **Leave code better than you found it.** Make small, in-scope improvements; do not opportunistically restructure unrelated files.
- **Design for extension without modification.** New behavior should be addable without rewriting tested code.
- **Consistency within a codebase wins over absolute style adherence.** Match nearby code.
- **Behave predictably.** Method names describe what they do. Side effects are obvious. No surprises.
- **Comments explain *why*, not *what*.** Do not remove existing comments without reason. Never remove `TODO` comments.
- **No magic strings or numbers.** Extract to named constants, enums, or configuration. Put shared constants in the `Models` layer.
- **Keep units small.** Targets in [Size & Complexity Targets](#size--complexity-targets). When a unit crosses a threshold, evaluate whether it is doing too much.
- **Names communicate intent.** Describe what something represents, not how it's implemented. Use standard opposite pairs (`min`/`max`, `start`/`end`, `open`/`close`, `first`/`last`). Put computation qualifiers at the end (`totalAmount`, `averageScore`, `minimumValue`, `customerIndex`). Avoid vague words (`flag`, `data`, `item`, `object`, `manager`) unless context makes the meaning unmistakable. Avoid abbreviations and acronyms. One statement per line.
- **Document for the toolchain.** Use XML docs (C#), JSDoc + type hints (TS/JS, Python) — the kind tooling can consume.
- **Optimize when the profiler says so.** Correct and readable first. Optimize when measured.
- **No new dependencies without approval.** See [Dependency Approval](#dependency-approval).

## Size & Complexity Targets

Signals, not hard rules. When a unit approaches a threshold, surface a refactor in the same change. Do not extend refactors beyond the scope of the existing task.

| Unit | Target |
| --- | --- |
| C# method | ≤ 50 LOC |
| C# class / file | ≤ 500 LOC |
| Controller | ≤ 500 LOC |
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

## C# / .NET Rules

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

## FluentResults

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

## API Design

- Plural nouns, HTTP method is the verb. `/api/policies`, `/api/policies/{id}`. No verbs in URLs.
- Standard verbs: `GET` list / by-id, `POST` create, `PUT` full update, `PATCH` partial update, `DELETE` delete.
- **Controllers handle HTTP only.** Accept request, validate model state, delegate to service, map `Result<T>` to HTTP via `HandleFluentResult`. No business logic.
- **Action return type carries the success shape.** `HandleFluentResult` returns the non-generic `ActionResult`, but actions still declare `Task<ActionResult<T>>` when they return a body and `Task<ActionResult>` when they don't — the declared `T` drives OpenAPI/Scalar 200-body inference. Do not "simplify" a body-returning action to `Task<ActionResult>`, and do not change `HandleFluentResult` to return `ActionResult<T>` (its error paths produce `ProblemDetails`, so the non-generic return is correct).
- **Document non-200 statuses with attributes.** The signature only conveys the 200 body. Declare every other outcome a caller depends on with `[ProducesResponseType(StatusCodes.Status404NotFound)]` (and similar); error bodies are `ProblemDetails` via the global convention.
- Validate at the boundary: ModelState + FluentValidation. Validators live in `Server/Validators/`. Prefer FluentValidation for business-rule validation; use ModelState/DataAnnotations only for basic null/required/format checks. Do not duplicate rules across both.
- Authenticated controllers extend `AuthenticatedControllerBase` for cached claim access.

## Database & EF Core

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

- Validate all inputs at the boundary (controllers). ModelState + FluentValidation. Never trust client-side validation alone.
- JWT authentication on every request. Apply authorization policies at controller or action level.
- **Never commit secrets.** Use Azure Key Vault, env vars, or user secrets locally.
- Keep dependencies current; run `dotnet list package --vulnerable` and `npm audit` periodically.

## Documentation

- **C#:** XML doc comments on public members. Full text on interfaces; `<inheritdoc/>` on implementations.
- **TypeScript:** JSDoc on exported functions and complex types.
- **Python:** Google-style docstrings on public functions, classes, modules.
- **ADRs** for significant architectural decisions, in `.documentation/adr/`.

---

## Architecture: Layers and Responsibilities

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

## Project-Specific Backend Conventions

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

- **C#:** explicit local variable types, nullable references, file-scoped namespaces, XML docs on interfaces with `<inheritdoc/>` on implementations.
- **TypeScript:** `camelCase` vars, `PascalCase` components/types, Prettier on save.
- **Both:** `async`/`await` throughout. Never block on async work.

## Environments

| Environment | URL |
| --- | --- |
| Development | `xorbix-vdab-dev.azurewebsites.net` |

## Build, Test, and Run

```bash
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

Intentional differences from the canonical architecture. Do not "correct" them.

- **Project names** use legacy `.Models` / `.DataAccess` instead of `.Contracts` / `.Infrastructure`. See [Name Mapping](#name-mapping).
- **No `src/` parent folder.** Projects live at the repo root. New projects follow the same convention.
- **Service and repository interfaces** sit alongside their implementations at the project root, not in `Interfaces/` subfolders.
- **Entities live in `.Models`**, not in a separate `Infrastructure/Entities/` folder.
- **Single `.Tests` project** instead of the canonical split into `*.Arch.Tests` / `*.Services.Tests` / `*.Server.Tests` / `*.Infrastructure.Tests`. Tests are organised by folder inside the one project — see [Testing](#testing).

## Agent-Specific Notes

- **Full vertical slice.** A new table or functional area creates: entity in `.Models`, repository pair in `.DataAccess`, service pair in `.Services`, controller in `.Server`, and API module + model class in `xorbix-visual-databricks-app-builder.client/src/`. Work bottom-up (`.Models` → `.DataAccess` → `.Services` → `.Server` → client) and confirm the solution builds at each layer before proceeding. See [backend patterns](.documentation/standards/backend-patterns.md) and [frontend patterns](.documentation/standards/frontend-patterns.md) for concrete examples.
- **Layer violations are blocking.** Stop and propose the correct structure rather than proceeding.
- **New third-party dependencies** require the [Dependency Approval](#dependency-approval) evaluation. Surface the proposal — do not add unilaterally.
- **Files already over size targets** are extended via extraction/refactor, not by piling on more code.
- **Schema changes** require team-lead confirmation before generating migrations. Never modify shared databases directly.
- **When this file conflicts with the canonical standards documents on a project-specific topic, this file wins.** The standards docs win for principles and reasoning.
