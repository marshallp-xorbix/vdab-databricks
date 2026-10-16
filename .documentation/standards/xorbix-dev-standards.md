Development and Coding Standards - Xorbix Technologies, Inc.
Last Updated: 11 June 2026

# Introduction

This document establishes a practical development standard for Xorbix software projects. It combines our current technology direction with proven day-to-day development discipline, so teams can build applications that are consistent, secure, maintainable, and easier to support over time.

The goal is not to create rules for the sake of rules. The goal is to make quality easier to repeat. Every developer, reviewer, architect, project manager, and technical lead should be able to use this document as a common reference for how Xorbix code should be written, reviewed, tested, committed, and maintained.

This is a living document. As our tools, client needs, and development practices evolve, this standard should evolve with them through deliberate updates and team review.

# 1. Purpose and Scope

This standard is intended to be easy to read, easy to apply, and practical for real project delivery. It should help developers make consistent decisions without slowing them down, and it should give reviewers a clear basis for evaluating code without relying on personal preference.

This document defines the development standards for all Xorbix projects. It exists to ensure consistency across teams and codebases, reduce friction during code review, accelerate onboarding of new developers, and establish a shared vocabulary for making technical decisions.

These standards apply to all Xorbix production code regardless of project or client. They cover our primary working languages and frameworks: C#/.NET, TypeScript/JavaScript, React, Angular, HTML/CSS, and Python.

Where a project-specific document (such as an `AGENTS.md` or `copilot-instructions.md`) provides additional rules, those project rules supplement, but do not override, this document unless explicitly noted.

# 2. Code Ownership and Developer Accountability

Every developer is personally responsible for the code they commit. This is the foundational expectation that every other standard in this document builds on, standards only work when each person on the team takes ownership of meeting them.

Code ownership means:

- **Your code follows these standards.** Before committing, verify that your work adheres to the naming conventions, patterns, size limits, and architectural boundaries defined in this document. “I didn’t know” is a reason to ask questions early; it is not a reason to submit non-conforming code.
- **Your code builds.** Every commit on a shared branch must compile and pass CI. A broken build blocks the entire team. Verify the build locally before pushing.
- **Your code works.** Test your changes manually and verify that they behave correctly *at the time you submit your Pull Request*. Walk through the feature or fix as a user would. Confirm that the happy path works, that edge cases are handled, and that error states behave as expected.
- **Your code doesn’t break other things.** When your changes touch multiple areas, shared services, database schemas, APIs consumed by other components, you are responsible for testing those areas to ensure you haven’t introduced regressions. If your change to a service method breaks three screens that call it, that’s your bug, not QA’s discovery to make.
- **You are your own first line of QA.** The QA team exists to catch what escapes, subtle interaction bugs, cross-browser issues, requirements misunderstandings. They are not a substitute for developer testing. Code submitted to a shared branch should already be working, tested, and ready for someone else to build on. Submitting code that “mostly works” or “works on my machine” and relying on QA to find the problems is not acceptable, it slows the entire team down and erodes trust.

> **Reasoning:** Code review, CI pipelines, and QA processes are safety nets, not substitutes for diligence. When a developer submits untested or non-conforming code, the cost is not limited to the eventual fix, it includes the reviewer’s time, the QA cycle, the context switch back to the original author, and the delay to everyone waiting on that branch. Ownership at the point of commit is the single most effective way to keep a team moving fast.

## 2.1 Developer Precommit Checklist

Before committing code or opening a Pull Request, each developer should verify the following items:

- Updates from the target branch have been merged into your working branch and any conflicts resolved.
- The code builds successfully with no compilation errors.
- There are no avoidable compiler warnings or linting errors.
- The code has been manually tested by the developer.
- Relevant unit tests have been added or updated.
- Unused imports, unnecessary blank lines, temporary comments, and commented out code have been removed.
- Exception handling has been considered where failures may occur.
- Logging has been added where it would help support, troubleshooting, or auditability.
- No development only values, test credentials, hardcoded secrets, or temporary settings remain.
- Security implications have been considered, including input validation, authorization, and sensitive data handling.
- Performance implications have been considered, especially for database calls, loops, async code, and UI responsiveness.

This checklist is not a substitute for code review or QA. It is the minimum self review expected before another person spends time reviewing or testing the work.

# 3. Principles and General Guidance

The standards in this section are the foundation everything else in this document builds on. They are not original to Xorbix, they draw from well-established industry principles (attributed in [Section 18: Canonical References](#18-references)), but they represent the specific subset we adopt and how we apply them in practice.

## 3.1 Simplicity Is the Default

Write code for the next person who will read it, not for the compiler. Favor clear, straightforward implementations over clever abstractions. If a solution requires a comment to explain *why it works*, consider whether a simpler solution exists that wouldn’t need one. Unnecessary complexity is the single greatest threat to long term maintainability, add it only when a concrete requirement demands it.

> **Reasoning:** Clever code creates a maintenance burden that compounds over time. Every team member, including your future self, should be able to read and understand a block of code without needing the original author present to explain it.

## 3.2 Don’t Repeat Yourself, But Don’t Over-Abstract Either

Every piece of knowledge should have a single, authoritative representation within a system. Duplicated logic is duplicated bugs.

However, apply this judiciously. Two pieces of code that *look* the same but serve different business purposes are not duplication, they are coincidence. Premature abstraction to eliminate superficial similarity can create coupling that is harder to undo than the duplication itself.

## 3.3 Build What Is Needed Today

Do not build features, abstractions, or infrastructure for anticipated future requirements. Build what is needed now, and design it well enough that it can be extended later. Speculative code carries maintenance cost from day one and may never deliver value.

## 3.4 One Responsibility Per Unit

Every class, service, component, and method should own a single, well-defined responsibility. When a unit starts doing two things, split it. Controllers handle HTTP concerns. Services contain business logic. Repositories manage data access. UI components render and respond to user interaction. These boundaries are not suggestions, they are the load-bearing walls of our architecture.

> **Reasoning:** A class with multiple responsibilities changes for multiple reasons, and each change risks breaking something unrelated. Small, focused units are easier to name, test, and reason about.

## 3.5 Depend on Abstractions, Not Implementations

High-level modules should not depend on low-level modules; both should depend on abstractions. This is the principle that drives our use of interfaces, constructor injection, and the repository pattern. Services depend on `IRepository<T>`, not `DbContext`. Controllers depend on `IUserService`, not `UserService`.

> **Reasoning:** When business logic depends on a concrete database implementation, you can’t test it without a database. When it depends on an interface, you can substitute a mock, swap implementations, or restructure the data layer, all without touching a line of business logic.

## 3.6 Favor Composition Over Deep Hierarchies

Assemble behavior by composing smaller, focused objects rather than building deep inheritance trees. Inheritance creates tight coupling between parent and child; composition allows flexible recombination. On the frontend, this means favoring composable hooks and utility functions over deeply nested component hierarchies. On the backend, it means preferring injected services over base class methods.

## 3.7 Be Proactive About Complexity

If a file, class, or component starts to grow beyond our established size limits, recommend a refactor or restructure *during initial implementation* rather than allowing technical debt to accumulate.

> **Reasoning:** Refactoring a 50-line method the day it’s written costs minutes. Refactoring a 400-line method six months later, when its behavior is load-bearing and poorly understood, costs days and introduces risk.

## 3.8 Fail Fast and Fail Explicitly

Detect and surface errors as early as possible. Validate inputs at the boundary, check preconditions at the top of methods, and prefer loud failures over silent corruption. Return explicit result types (like `Result<T>`) rather than null or silently swallowed exceptions.

> **Reasoning:** A `NullReferenceException` three layers deep from the actual problem wastes debugging time and erodes confidence. An explicit `Result.Fail("Policy 42 not found")` at the point of detection tells you exactly what went wrong and where.

## 3.9 Talk Only to Your Immediate Collaborators

An object should interact with its direct dependencies, not reach through them. Avoid chaining calls like `order.GetCustomer().GetAddress().GetCity()`, each link in that chain is a coupling point. Pass the information a method needs directly.

> **Reasoning:** Long call chains mean that a change to `Address` can break `Order`, even though `Order` shouldn’t know `Address` exists. This creates fragile code where seemingly unrelated changes cause cascading failures.

## 3.10 Leave Code Better Than You Found It

If you touch a file and see a minor improvement opportunity, a clearer variable name, an extracted method, a removed dead import, make it. Small, continuous improvements prevent codebase entropy. However, keep opportunistic improvements within the scope of your current task; do not opportunistically reformat or restructure entire files unrelated to your work.

## 3.11 Design for Extension Without Requiring Modification

Structure services and components so that new behavior can be added, via interfaces, composition, or configuration, without rewriting existing, tested code. When adding a new notification channel shouldn’t require changing the notification service itself, the design is right.

## 3.12 Consistency Within a Codebase

When working in an existing codebase, keep style consistent with nearby code, even if this document would suggest a slightly different approach for greenfield work.

> **Reasoning:** Consistency within a file is more important than absolute adherence to a style guide. Inconsistent formatting creates noisy diffs, complicates reviews, and makes `git log` less useful.

## 3.13 Software Should Behave Predictably

Method names should describe what they do. Return types should be consistent. Side effects should be obvious. If a method named `GetUser` also sends an email, rename it or restructure it. Code that surprises its readers is code that produces bugs.

## 3.14 Comments Explain Why, Not What

Do not over-use comments. Good code is largely self documenting through clear naming and small, focused functions. When comments are necessary, explain *why* a decision was made, not *what* the code does.

> **Internal Rule:** Do not remove existing comments without reason. Only update or remove comments when the logic they describe no longer applies or when clarification is needed. Never remove `TODO` comments, they represent known work items.

## 3.15 No Magic Strings or Magic Numbers

Hardcoded literal values scattered throughout code are a maintenance hazard. Extract them into named constants, enumerations, or configuration. Create constants in a shared location (e.g., `Contracts` project in .NET, `src/types` in frontend).

> **Reasoning:** When a value like `"Administrator"` or `30` appears in multiple places, changing it requires a search-and-replace across the codebase with no compiler safety net. A single named constant makes the intent clear and changes trivial.

## 3.16 Keep Units Small and Complexity Low

Methods should target **50 lines of code or fewer**. Files should target **500 lines of code or fewer**. Methods should also target a **cognitive complexity score of 15 or below**. Cognitive complexity measures how difficult a method’s control flow is to understand, unlike cyclomatic complexity (which counts branching paths for testability), it accounts for nesting depth, logical operator sequences, and structural breaks in linear flow, producing a score that correlates with how hard a method actually is to *read*.

These thresholds apply across all languages and all layers, controllers, services, components, utilities. They are not hard rules, they are indicators. When a method or file crosses a threshold, it is a signal to pause and evaluate whether the unit is doing too much and would benefit from being broken apart. Some methods and files will legitimately exceed these limits after review; the goal is intentional awareness, not arbitrary truncation.

> **Reasoning:** Line limits and complexity scores attack the same problem from two angles. Line count catches methods that are simply *long*. Cognitive complexity catches methods that are *short but dense*, a 30-line method with four levels of nested conditionals and mixed boolean logic can be harder to understand than a straightforward 60-line method. Together, they give a more complete picture of when a method needs attention. Both are rooted in [3.4 One Responsibility Per Unit](#34-one-responsibility-per-unit), a method that exceeds either threshold is almost certainly doing more than one thing.

## 3.17 Document for the Toolchain, Not Just for Humans

Code documentation serves two audiences: the developers who read it and the tools that consume it. The most valuable documentation is the kind that the compiler, linter, or IDE can use to improve the development experience, surfacing warnings, enabling autocomplete, and catching misuse at write time rather than at runtime.

Each language in our stack has a structured documentation format that tooling understands:

- **C#, XML Documentation Comments** (`/// <summary>`, `/// <param>`, `/// <returns>`, `/// <exception>`, `/// <remarks>`): These are consumed by IntelliSense, Roslyn analyzers, and documentation generators. When a public method has a `<param>` tag, the IDE shows parameter descriptions as you type. When `<exception>` tags are present, analyzers can warn about unhandled exception types. StyleCop Analyzers enforce their presence on public members, turning documentation from a suggestion into a build time requirement.
- **TypeScript/JavaScript, JSDoc** (`@param`, `@returns`, `@throws`, `@deprecated`, `@example`): TypeScript’s compiler reads JSDoc annotations and uses them for type inference in `.js` files. ESLint plugins like `eslint-plugin-jsdoc` enforce completeness and correctness. The `@deprecated` tag causes IDEs to display strikethrough on usage, guiding developers away from outdated APIs without a breaking change.
- **Python, Docstrings + Type Hints** (PEP 257 + PEP 484): Type hints are consumed by mypy, Pyright, and IDE autocomplete. Google-style docstrings with `Args:`, `Returns:`, and `Raises:` sections are parsed by documentation generators and by Ruff’s docstring-related rules. Together, they give Python the same tooling benefits that statically typed languages get by default.
- **HTML, Semantic attributes and ARIA**: While not “documentation” in the traditional sense, attributes like `aria-label`, `alt`, and `role` are consumed by accessibility linters (axe-core, eslint-plugin-jsx-a11y) and screen readers. They serve the same purpose: structured metadata that tools use to catch problems before users encounter them.

The goal is to write documentation that *does work*, that powers IntelliSense tooltips, triggers linter warnings on misuse, enables automated API doc generation, and catches contract violations at compile time. If a documentation comment doesn’t improve the tooling experience or clarify a non obvious decision, it’s noise.

> **Reasoning:** Documentation that only lives in a wiki or a README gets stale. Documentation embedded in the code and enforced by the toolchain stays current because the build breaks when it drifts. A `<param>` tag that no longer matches a method’s parameters is a compiler warning, not a quiet lie. This approach turns documentation from a chore into a force multiplier, you write it once, and the entire team benefits every time their IDE autocompletes a method signature or warns about a deprecated API.

## 3.18 Optimize When the Profiler Says So, Not Before

Write correct, readable code first. Optimize only when profiling identifies an actual bottleneck. Optimized code is almost always harder to read and maintain, that cost is only justified when the performance gain is measurable and necessary.

## 3.19 Do Not Introduce Dependencies Without Approval

Do not add new third party packages, libraries, or frameworks to a project without explicit approval from the team lead or architect. This applies to all package ecosystems, NuGet, npm, PyPI, and any other source.

Before proposing a new dependency, evaluate it against the following criteria:

- **Security posture:** Check for known vulnerabilities using `dotnet list package --vulnerable`, `npm audit`, `pip-audit`, or the relevant advisory database. A package with unpatched CVEs is disqualified until they are resolved.
- **License compatibility:** Verify that the package’s license is compatible with the project’s licensing requirements and any client contractual obligations. Copyleft licenses (e.g., GPL) require legal review before adoption. Prefer permissive licenses (MIT, Apache 2.0, BSD).
- **Maintenance health:** Assess whether the package is actively maintained. Consider the recency of releases, responsiveness to issues, number of maintainers, and whether the project appears to have a sustainable contributor base. A package with a single maintainer and no activity in twelve months is a risk, not a shortcut.
- **Scope appropriateness:** The dependency should solve a problem that is substantial enough to justify the cost of adopting it. If the functionality you need is a single utility function, write it, do not import a library for one function. The threshold question is: *does the value this package provides clearly outweigh the long term cost of maintaining the dependency?*
- **Bundle and deployment impact:** For frontend packages, evaluate the effect on bundle size. For backend packages, consider the impact on deployment size and startup time. A dependency that adds hundreds of kilobytes to deliver a feature achievable in a few dozen lines of code is not justified.

Every dependency is a long term commitment: it must be kept up to date, monitored for vulnerabilities, tested against framework upgrades, and understood well enough to debug when it breaks. Dependencies that fall out of maintenance become your maintenance burden. Treat each addition with the same scrutiny you would apply to a permanent hire, not a contractor you can easily let go.

> **Reasoning:** The average enterprise project accumulates dependencies faster than it retires them. Each one expands the attack surface, increases upgrade friction, and adds a failure mode outside the team’s control. The cost of evaluating a dependency before adoption is measured in minutes; the cost of extracting a deeply embedded one after it becomes a liability is measured in days or weeks. This is a direct application of [3.3 Build What Is Needed Today](#33-build-what-is-needed-today), if you don’t need a library, don’t take on the obligation of maintaining one.

## 3.20 Naming Should Communicate Intent

Names should describe what something represents, not how it is implemented. A good name reduces the need for comments and helps another developer understand the code without tracing every line.

When applicable:

- Use standard opposite pairs consistently, such as `min` and `max`, `begin` and `end`, `start` and `end`, `open` and `close`, and `first` and `last`.
- Use computation qualifiers at the end of variable names, such as `totalAmount`, `averageScore`, `minimumValue`, `maximumValue`, and `customerIndex`.
- Avoid vague words such as `flag`, `data`, `item`, `object`, or `manager` unless the meaning is clear in context.
- Even short lived variables should have meaningful names, except simple loop indexes in small loops.
- Function and method names should make the returned value or operation clear, such as `GetOwnerName`, `CalculateInvoiceTotal`, or `FindActivePolicies`.
- Avoid abbreviations and acronyms. Meaning can differ by context and a meaning understood during initial implementation may not be obvious 1+ years after
- Avoid placing more than one statement on a single line. Each line should represent one clear action or declaration unless the language convention strongly suggests otherwise.

# 4. C# / .NET Standards

**Primary References:**

- Microsoft C# Coding Conventions, https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions
- .NET Framework Design Guidelines, https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/
- C# Identifier Naming Rules, https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/identifier-names
- C# Coding Guidelines (Aviva Solutions), <https://csharpcodingguidelines.com/>

Xorbix conventions are intended to follow industry standards and best practices. As the industry evolves so will our conventions. If conflicts surface, address them with a tech lead or supervisor.

## 4.1 Naming Conventions

- **PascalCase** for classes, methods, properties, public fields, constants, and namespaces.
- **camelCase** for private fields, local variables, and method parameters.
- **Prefix interfaces** with `I` (e.g., `IUserService`).
- **Suffix DTOs** with `Dto`, `Request`, or `Response` (e.g., `PolicyDto`, `LoginRequest`).
- **Entities are singular** (`Policy`, `User`); **database tables are plural** (`Policies`, `Users`).

> **Reasoning:** Singular entities map naturally to the domain language (“a Policy”), while plural tables describe what the table *contains* (“the Policies table”). This convention aligns with both Microsoft’s EF Core documentation and our existing codebases.

## 4.2 Typing and Nullability

- **Use explicit local variable types.** Write `UserDto user = ...` rather than `var user = ...`. The sole exception is when the type cannot be named directly (e.g., anonymous types).
- **Use explicit nullable reference types** where null is a valid state: `App?`, `User?`, etc.

> **Reasoning:** Explicit types make code self documenting at the point of declaration. A developer reading `List<PolicyDto> policies = await _service.GetAllAsync()` immediately knows the shape of the data without hovering or navigating. `var` hides this information and forces reliance on IDE tooling that isn’t available in diffs, PRs, or printed code.

## 4.3 Async/Await

Use `async`/`await` consistently throughout the stack. Never block asynchronous code with `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()`. This does not prevent use of synchronous methods where appropriate.

> **Reasoning:** Blocking on async code in ASP.NET causes thread pool starvation under load and can produce deadlocks. All I/O-bound operations (database calls, HTTP requests, file access) must be awaited.

## 4.4 FluentResults Pattern

All service and application layer methods must return `Result<T>` or `Result` (from the FluentResults library) instead of throwing exceptions for expected domain or validation failures.

```csharp
public async Task<Result<PolicyDto>> GetPolicyAsync(int id)
{
    Policy? policy = await _repository.GetByIdAsync(id);
    if (policy == null)
        return Result.Fail($"Policy {id} not found");

    PolicyDto dto = MapToDto(policy);
    return Result.Ok(dto);
}
```

Reserve exceptions for unexpected or truly exceptional conditions (e.g., network failures, corrupted state). Controllers consume `Result<T>` and map to appropriate HTTP responses.

> **Reasoning:** Exceptions are expensive to throw and catch, they disrupt normal control flow, and they force callers to guess which methods might throw what. `Result<T>` makes success and failure explicit in the type signature, enables pattern matching, and prevents the “swallowed exception” anti-pattern. It also makes unit testing straightforward, assert on `result.IsSuccess` rather than wrapping tests in try/catch. Beyond the technical benefits, the pattern encourages developers to deliberately consider and handle each outcome path, success, validation failure, not-found, at the time of writing, rather than leaving unexpected behaviors to surface later as unhandled exceptions. This is a direct application of [3.8 Fail Fast and Fail Explicitly](#38-fail-fast-and-fail-explicitly).

## 4.5 Dependency Injection

- Use **constructor injection exclusively**. No property injection, no method injection, no service locator patterns.
- Register services in DI using `AddTransient`, `AddScoped`, or `AddSingleton` as appropriate.
- Use the `IOptions<T>` pattern for configuration binding.
- Inject `ILogger<T>` for logging. Never use static loggers.

> **Reasoning:** Constructor injection makes dependencies visible and explicit, you can see everything a class needs by reading its constructor. Property injection hides dependencies and makes classes appear simpler than they are. The service locator pattern (resolving from `IServiceProvider` directly) is widely regarded as an anti-pattern because it obscures dependencies and makes testing difficult. This follows directly from [3.5 Depend on Abstractions, Not Implementations](#35-depend-on-abstractions-not-implementations).

## 4.6 File-Scoped Namespaces

Use file-scoped namespaces (`namespace Xorbix.Services;` instead of the block-scoped `namespace Xorbix.Services { ... }`).

> **Reasoning:** File-scoped namespaces eliminate one level of indentation across the entire file, reducing visual noise. Available since C# 10, this is now the recommended default.

## 4.7 Modern C# Features

Use current .NET (10+) and C# (14+) features where they improve clarity: primary constructors, collection expressions, pattern matching, `required` properties, and records for immutable data. Do not use new features merely because they are new, adopt them when they make intent clearer.

## 4.8 XML Documentation

Add XML documentation comments (`/// <summary>`, `/// <param>`, `/// <returns>`) on all public members.

For services that implement interfaces: - Place the full XML documentation on the **interface** method. - Use `/// <inheritdoc/>` on the concrete implementation.

```csharp
// Interface
/// <summary>
/// Retrieves a policy by its unique identifier.
/// </summary>
/// <param name="id">The policy identifier.</param>
/// <returns>A result containing the policy DTO, or a failure if not found.</returns>
Task<Result<PolicyDto>> GetPolicyAsync(int id);

// Implementation
/// <inheritdoc/>
public async Task<Result<PolicyDto>> GetPolicyAsync(int id) { ... }
```

> **Reasoning:** Placing documentation on the interface ensures it is visible to every caller regardless of which implementation they resolve. `<inheritdoc/>` on the implementation avoids duplication while maintaining correct IDE tooltip behavior. See also [3.17 Document for the Toolchain, Not Just for Humans](#317-document-for-the-toolchain-not-just-for-humans).

# 5. TypeScript / JavaScript Standards

**Primary References:**

- Airbnb JavaScript Style Guide, https://github.com/airbnb/javascript
- Google TypeScript Style Guide, https://google.github.io/styleguide/tsguide.html
- TypeScript Handbook, https://www.typescriptlang.org/docs/handbook/

## 5.1 Naming Conventions

- **camelCase** for variables, functions, and object properties.
- **PascalCase** for classes, interfaces, type aliases, enums, and React/Angular components.
- **UPPER_SNAKE_CASE** for true constants (values that are genuinely fixed and never reassigned).
- **Prefix interfaces** with `I` only when they represent a model contract mirroring a backend interface (e.g., `IApplicationUser`). For component props and internal types, unprefixed names are fine.

## 5.2 TypeScript Over JavaScript

All new code must be written in TypeScript. Enable `strict` mode in `tsconfig.json`. Avoid `any`, use `unknown` when the type is genuinely not known, and narrow it with type guards.

> **Reasoning:** TypeScript’s type system catches entire categories of bugs at compile time that would otherwise surface at runtime. `strict` mode ensures we get the full benefit. `any` disables type checking and should be treated as a last resort, not a convenience.

## 5.3 Models vs. Types

> **The Golden Rule: Models are for Data. Types are for Code.**

| Scenario | Location | Pattern | Reasoning |
|----|----|----|----|
| API Request/Response | `src/models` | `Interface` + `Class` | Allows default values (`new LoginRequest()`) and validation logic. |
| Business Entity | `src/models` | `Interface` + `Class` | Allows computed properties (`user.fullName`) and constructor-based date parsing. |
| Component Props | In the `.tsx`/`.ts` file | `interface Props` | Props are specific to the component. Properties inside should reference `src/models`, not redefine the shape. |
| Shared UI Config | `src/types` | `interface` or `type` | Objects that exist only to make the UI work (layout config, event args). If used only within a single component, define in the same file. If shared, define in the shared directory. |
| Enums / Constants | `src/types` | `enum` | Shared fixed lists like `ComponentCategory` or `ButtonType`. |

UI models and API models should be named identically and be as close in definition as possible.

> **Reasoning:** Separating models from types creates a clear boundary between business data (which maps to backend contracts) and UI concerns (which exist only in the frontend). This makes it trivial to identify which types need to stay in sync with the API and which are free to evolve independently.

# 6. React Standards

**Primary References:**

- Official React Documentation, https://react.dev/
- Rules of React, https://react.dev/reference/rules
- Airbnb React/JSX Style Guide, https://github.com/airbnb/javascript/tree/master/react
- React TypeScript Cheatsheet, https://github.com/typescript-cheatsheets/react

## 6.1 State Management

Distinguish **server state** (data owned by the backend — entities, lookups, DTOs) from **client/UI state** (form inputs, toggles, selection); they use different tools.

**Server state** is managed with **TanStack Query** (`@tanstack/react-query`), the Xorbix standard for fetching, caching, refetching, and invalidating server data. Prefer it over hand-rolled `useState` + `useEffect` + `fetch`. Because it is a server-state cache and not a client-state store, it is not subject to the global-store approval guidance below.

For **client/UI state**, `useState` and `useContext` are the default tools. For the majority of our applications, React’s built-in primitives are sufficient, reach for `useContext` when multiple components need shared state, and lift state up when a parent can own it.

When an application’s complexity genuinely demands more, deeply shared cross-cutting state, complex state transitions, or performance-sensitive global stores, a client-state management library (e.g. Redux or Zustand) may be introduced following the dependency approval process outlined in [3.19 Do Not Introduce Dependencies Without Approval](#319-do-not-introduce-dependencies-without-approval). The choice of library should be defined in the project’s requirements and documented in its `AGENTS.md` or equivalent.

## 6.2 React Router

Our standard is the **current stable major version of React Router** (v7 today). React Router offers three [routing modes](https://reactrouter.com/start/modes) — declarative, data, and framework — that build on each other. Select the mode based on project requirements (framework mode when you want type-safe routes, automatic code-splitting, or server rendering; data mode when you want route loaders/actions but control your own server and bundling; declarative mode for the simplest SPA) and document the choice in the project’s configuration. Regardless of mode, route configuration should be centralized and predictable.

## 6.3 UI Component Libraries

Projects will use one of the following UI stacks based on requirements and application purpose:

- **shadcn/ui + Tailwind CSS** — Best suited for projects requiring high design flexibility or where bundle size is a concern (e.g., mobile-first or public-facing applications). Components are copied into the project as source code, giving full control over styling and behavior with minimal runtime overhead.
- **React MUI (Material UI)** — A strong choice when Material Design conventions align with the application's needs or when the breadth of MUI's pre-built component library accelerates delivery. MUI carries a larger bundle weight than shadcn/ui + Tailwind, which can impact initial load times — particularly on mobile devices over slower networks — so this trade-off should be considered during project planning.

The choice should be made at project inception and used consistently throughout the application. Do not mix component libraries within a single project.

## 6.4 User Experience, Responsive Design, and Accessibility

Design for the best possible user experience as the baseline, not as a finishing touch. This includes responsive layouts that work across screen sizes, accessible interfaces that meet the standards defined in [8.2 Accessibility](#82-accessibility), and thoughtful interaction design, appropriate loading states, transitions, animations, navigation guards, confirmation dialogs for destructive actions, and clear feedback on every user interaction.

The goal is an application that feels intentional and polished. A form that submits with no loading indicator, a delete button with no confirmation, or a layout that breaks on tablet are not acceptable as “we’ll fix it later” items, they are part of the initial implementation.

> **Reasoning:** Users form trust based on how an application *feels*, not just what it does. Responsive design, accessibility, and interaction polish are not separate workstreams, they are dimensions of quality that should be considered in every component from the start. Retrofitting animations, guards, and responsive breakpoints after the fact is significantly more expensive and error-prone than building them in.

# 7. Angular Standards

**Primary References:**

- Official Angular Style Guide, https://angular.dev/style-guide
- Angular Best Practices, https://angular.dev/best-practices
- Google TypeScript Style Guide, https://google.github.io/styleguide/tsguide.html
- John Papa Angular Style Guide, https://github.com/johnpapa/angular-styleguide

## 7.1 Component Architecture

Follow Angular’s official style guide for component structure, file naming, and module organization. Use standalone components (the Angular 17+ default) for new development. Shared types and constants belong in the `Contracts` project, not duplicated in the client.

## 7.2 Angular-Specific TypeScript

Angular is TypeScript-first. All Angular-specific TypeScript rules from [Section 5](#5-typescript--javascript-standards) apply. Additionally, follow Angular’s conventions for decorators, lifecycle hooks, and dependency injection using the `inject()` function where appropriate.

# 8. HTML / CSS Standards

**Primary References:**

- WHATWG HTML Living Standard, https://html.spec.whatwg.org/multipage/
- Google HTML/CSS Style Guide, https://google.github.io/styleguide/htmlcssguide.html
- WCAG 2.2, https://www.w3.org/TR/WCAG22/
- WAI-ARIA 1.2, https://www.w3.org/TR/wai-aria-1.2/

## 8.1 Semantic Markup

Use semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>`) over generic `<div>` and `<span>` elements whenever appropriate.

> **Reasoning:** Semantic elements communicate structure to screen readers, search engines, and other developers. A `<nav>` tells you exactly what it is; a `<div class="nav-wrapper">` requires interpretation.

## 8.2 Accessibility

All user facing applications must meet WCAG 2.2 Level AA as a minimum. This includes proper use of ARIA attributes, sufficient color contrast ratios, keyboard navigability, and meaningful alt text on images.

> **Reasoning:** Accessibility is both an ethical obligation and, for many of our clients, a legal requirement. Building it in from the start is vastly cheaper than retrofitting it later.

## 8.3 CSS Architecture

Where Tailwind CSS is the project standard, use it exclusively. Do not mix utility-first and traditional CSS approaches in the same project. For projects without Tailwind, prefer CSS Modules or a BEM naming convention to avoid selector collisions.

# 9. Python Standards

**Primary References:**

- PEP 8, https://peps.python.org/pep-0008/
- PEP 257 (Docstrings), https://peps.python.org/pep-0257/
- PEP 484 (Type Hints), https://peps.python.org/pep-0484/
- PEP 20 (The Zen of Python), https://peps.python.org/pep-0020/
- Google Python Style Guide, https://google.github.io/styleguide/pyguide.html

## 9.1 Formatting and Naming

Follow PEP 8 for all formatting decisions. Use `snake_case` for functions, methods, and variables; `PascalCase` for classes; and `UPPER_SNAKE_CASE` for module-level constants. Maximum line length is 88 characters (the Black/Ruff default), not PEP 8’s 79.

## 9.2 Type Hints

All new Python code must include type hints on function signatures. Use `from __future__ import annotations` for forward references. Enable type checking with mypy or Pyright in CI.

> **Reasoning:** Python’s dynamic typing is a double-edged sword. Type hints provide the same “self documenting” benefits we require from explicit C# types, and mypy/Pyright catch type errors before they reach production.

## 9.3 Docstrings

All public functions, classes, and modules must have docstrings conforming to PEP 257. Use Google-style docstring format for consistency with the Google Python Style Guide.

# 10. API Design Standards

**Primary References:**

- Microsoft REST API Guidelines, https://github.com/microsoft/api-guidelines
- Google API Design Guide, https://cloud.google.com/apis/design

## 10.1 RESTful Routes

Keep routes short, predictable, and resource-oriented:

```http
GET    /api/{entity}         , List
GET    /api/{entity}/{id}    , Get by ID
POST   /api/{entity}         , Create
PUT    /api/{entity}/{id}    , Full update
PATCH  /api/{entity}/{id}    , Partial update
DELETE /api/{entity}/{id}    , Delete
```

Use plural nouns for resource names (`/api/policies`, not `/api/policy`). Avoid verbs in URLs, the HTTP method *is* the verb.

> **Reasoning:** Consistent, predictable API routes reduce cognitive load for both frontend developers consuming the API and backend developers maintaining it. When every route follows the same pattern, you can guess the URL for any resource without checking documentation.

## 10.2 Controller Responsibility

Controllers handle HTTP concerns only: accept the request, validate the model state, delegate to a service, and map the `Result<T>` to an HTTP response. Business logic does not belong in controllers.

> **Reasoning:** Thin controllers are testable without HTTP infrastructure. Fat controllers become untestable monoliths that mix transport concerns with domain logic, violating [3.4 One Responsibility Per Unit](#34-one-responsibility-per-unit).

# 11. Database and Data Access Standards

## 11.1 Entity Framework Core

Use EF Core exclusively. Avoid raw SQL unless there is a demonstrable performance need that EF cannot meet, and document the justification.

All database queries must be async. Use `await _context.Users.ToListAsync()`, never `.ToList()`.

> **Reasoning:** EF Core decouples the data access layer from the underlying database architecture. Business logic, repositories, and services are written against EF’s abstractions, `DbContext`, LINQ queries, and entity configurations, not against a specific database engine’s SQL dialect or connection semantics. This means the same application code can target SQL Server on Azure today and PostgreSQL on Databricks tomorrow by changing the database provider and connection configuration, without rewriting queries or restructuring the data layer. That portability is not theoretical, it is a practical advantage when client requirements, hosting environments, or cost considerations change mid-project. Beyond portability, EF Core provides change tracking, migration management, query translation, and relationship mapping out of the box, infrastructure that would otherwise need to be hand-built and maintained. Raw SQL bypasses all of these benefits: it couples the application to a specific dialect, it can’t be validated at compile time, it doesn’t participate in change tracking, and it creates a parallel data access path that is harder to test and easier to overlook during refactoring. The requirement to document any raw SQL usage ensures that these trade-offs are made deliberately and visibly, not by default.

When raw SQL is approved and necessary, format SQL consistently:

- Use uppercase for SQL keywords, such as `SELECT`, `FROM`, `WHERE`, `JOIN`, and `ORDER BY`.
- Use project standard casing for database objects.
- Avoid inline string concatenation for SQL.
- Use parameterized queries only.
- Document why raw SQL was required instead of EF Core.

## 11.2 Repository Pattern

Services must not access the EF `DbContext` directly. Instead, they interact through repository interfaces (`IRepository<T>`, `INamedRepository`).

Each repository pair consists of `NamedRepository.cs` (implementation) and `INamedRepository.cs` (interface). Common CRUD operations should use shared `IRepository<T>` methods; domain-specific queries are added to the named repository.

> **Reasoning:** The repository abstraction decouples business logic from data access mechanics. Services can be unit-tested with mock repositories without needing a database. It also creates a natural boundary that prevents EF-specific concerns (change tracking, lazy loading) from leaking into business logic. This follows from [3.5 Depend on Abstractions, Not Implementations](#35-depend-on-abstractions-not-implementations).

## 11.3 Transaction Management

Services can employ transaction management for atomicity without directly accessing the DbContext:

```csharp
using TransactionScope transaction = new(
    asyncFlowOption: TransactionScopeAsyncFlowOption.Enabled);

// EF operations via repositories
await _repository.CreateAsync(entity);
await _otherRepository.UpdateAsync(related);

transaction.Complete();
// If Complete() is not reached, the transaction is rolled back.
```

## 11.4 Entity and Table Naming

Entities are singular (`Policy`, `User`). Database tables are plural (`Policies`, `Users`). EF configurations should explicitly map this using `.ToTable("TableName")` or the conventions established in the project’s `DbContext`.

## 11.5 Navigation Properties

Avoid cycles in EF navigation properties. Configure relationships explicitly and be deliberate about cascade delete behavior.

## 11.6 Migrations

All database schema changes must be made through EF Core migrations or an equivalent migration framework, never through direct database modifications (manual scripts run against a server, SSMS changes, ad-hoc `ALTER TABLE` statements, or GUI-based schema editors). The migration files in the repository are the single source of truth for the database schema.

This means:

- **Every schema change is a migration.** Adding a column, renaming a table, creating an index, modifying a constraint, seeding reference data, all of it goes through the migration pipeline. If the change affects the database, it must be represented in code, committed to version control, and applied through the standard deployment process.
- **No direct database modifications.** Do not make schema changes directly on any shared database, development, staging, or production. A change made through SSMS or a one-off script exists only in that environment. It won’t be present in other environments, it won’t be in source control, and the next migration may fail or silently produce a schema mismatch. Direct changes are the leading cause of “it works in dev but not in staging” deployment failures.
- **Data Seeding is a migration**: Blank migrations can be created for seeding data such as roles, lookups or initial testing data. This makes the seed data repeatable.
- **Migrations are reviewed before they are applied.** If database migrations are within scope of a task, confirm with the team lead before creating them. Never auto-generate and apply migrations without review. Auto-generated migrations can include unintended changes, dropped columns, altered data types, or cascade behaviors, that are easy to miss if the migration is applied without reading it.
- **Migrations are idempotent by design and ordered.** Each migration will only be applied once when using standard tooling. The process of applying migrations is idempotent because the system checks which migrations have already been applied and only executes those that are pending. Do not modify existing migrations that have already been applied to any shared environment, create a new migration instead. The migration history must remain a linear, append-only record.

> **Reasoning:** A database schema managed outside of version control is a database schema that drifts. When the migration files in the repository don’t match what’s actually on the server, every subsequent migration becomes a guessing game, and the failures tend to surface in production, not in development. Treating migrations as code means they get the same benefits as all other code: version history, code review, CI validation, and repeatable deployment across environments. This follows the same principle behind [3.5 Depend on Abstractions, Not Implementations](#35-depend-on-abstractions-not-implementations), the application depends on the schema defined in its migrations, not on the current state of whatever database it happens to connect to.

**Reference:** Microsoft’s EF Core Migrations documentation, https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/

# 12. Testing Standards

**Primary References:**

- *Unit Testing Principles, Practices, and Patterns*, Vladimir Khorikov (2020)
- *Test-Driven Development: By Example*, Kent Beck (2002)

## 12.1 Test Requirements

All code must be properly tested before merge. Each change must build and run successfully.

For template-based projects, the default expectation is:

- `*.Arch.Tests` verifies layering and dependency direction.
- `*.Services.Tests` covers business logic and result handling.
- `*.Server.Tests` covers controllers, HTTP behavior, and problem-details mapping.
- `*.Infrastructure.Tests` covers repository and persistence behavior when the change touches data access.

## 12.2 Test Structure

Use the **Arrange-Act-Assert** (AAA) pattern for all unit tests. Each section should be clearly delineated, with a single logical assertion per test (multiple physical assertions are acceptable when they verify a single behavior).

## 12.3 Test Naming

Use descriptive names that communicate the scenario: `MethodName_StateUnderTest_ExpectedBehavior`.

```csharp
[Fact]
public async Task GetPolicyAsync_PolicyDoesNotExist_ReturnsFailResult() { ... }
```

## 12.4 Test Properties (FIRST)

Tests should be **F**ast, **I**ndependent, **R**epeatable, **S**elf-validating, and **T**imely. A test that depends on external services, shared state, or execution order is fragile and should be redesigned.

## 12.5 Add or Update Tests When Behavior Changes

When modifying existing behavior, update the corresponding tests. When adding new behavior, add new tests. Untested behavior is unverified behavior.

## 12.6 Test Boundaries in the Template

The baseline template already separates tests by responsibility. Preserve that split when creating a new project from the template.

- Put architecture rule enforcement in `Arch.Tests`, not in service or controller tests.
- Put business rule tests in `Services.Tests`, using mocks or fakes for repositories and external dependencies.
- Put request/response mapping tests in `Server.Tests`, especially when validating HTTP status codes, authorization behavior, and `ProblemDetails` output.
- Put query, repository, and migration-related tests in `Infrastructure.Tests` when the data access code itself is the subject under test.

If a test suite starts mixing those concerns, the project becomes harder to maintain and failures become harder to diagnose.

## 12.7 Coverage Expectations

Coverage is a quality signal, not the goal by itself. A baseline threshold such as `80%` is useful for preventing obvious under-testing, but teams should focus on covering risk:

- business rules with branching logic
- controller error handling and result mapping
- infrastructure code that transforms or filters data
- regressions for bugs that have already escaped once

Do not chase coverage by writing low-value tests around trivial getters, framework plumbing, or code whose behavior is already exercised by more meaningful tests.

# 13. Version Control and Workflow

## 13.1 Branch Strategy

`develop` is the active integration branch where feature work merges. `main` is the stable, production-ready branch, it contains only validated, well-tested code that has passed through code review and QA. Developers branch exclusively off of `develop`. Pull Requests into `main` represent a release-quality gate, not a work in progress checkpoint.

## 13.2 Branch Naming

Use descriptive, prefixed branch names that communicate the type and scope of work:

```text
feature/add-policy-expiration-notifications
bugfix/fix-date-parsing-in-registration
hotfix/patch-null-reference-in-claims-lookup
chore/update-npm-dependencies
refactor/extract-validation-from-policy-controller
```

The prefix communicates intent at a glance, in branch lists, in CI logs, and in PR titles. The descriptive suffix should be specific enough to identify the work without opening the PR. Avoid generic names like `feature/updates` or `bugfix/fix`.

## 13.3 Branch Hygiene

Before every commit, pull the latest changes from `develop` into your working branch, resolve any merge conflicts, and verify that the project builds and your changes still work. Do not defer conflict resolution, merging a branch that is days behind `develop` creates large, risky merge operations that are harder to review and more likely to introduce bugs.

Delete branches after their Pull Request is merged. Stale branches clutter the repository, create confusion about what work is active, and increase the risk of someone accidentally branching from or building on abandoned work. If a branch has been inactive for more than two weeks without an open PR, it should be deleted or explicitly justified.

> **Reasoning:** Branch hygiene is a direct extension of [Section 2: Code Ownership](#2-code-ownership-and-developer-accountability). Your branch is your workspace, keeping it current, conflict-free, and properly named is part of the responsibility of owning the code on it.

## 13.4 Branch Protection

**Never push directly to** `develop` **or** `main` **branches.** All changes go through Pull Requests.

> **Reasoning:** Direct pushes bypass code review, skip CI validation, and eliminate the opportunity for a second pair of eyes. Even small, “obviously safe” changes have caused production incidents.

## 13.5 Pull Request Standards

Each PR must build and run successfully before merge and pass all unit tests. Write clear, descriptive PR descriptions that explain *what* the change does, *why* it was made, and *how* a reviewer should evaluate it. Link PRs to their associated issues. If the change has visual or behavioral impact, include screenshots or steps to reproduce.

AI-generated code must be fully reviewed and tested, the author of the PR is responsible for the code, regardless of who (or what) wrote it.

> **Reasoning:** A PR description that says “fixed stuff” forces the reviewer to reverse-engineer intent from the diff. A description that says “Fixes the date parsing bug in user registration where UTC dates were being interpreted as local time, see issue \#247 for reproduction steps” lets the reviewer focus on whether the fix is correct rather than on understanding what problem is being solved.

## 13.6 Commit Messages

Use semantic commit messages following the Conventional Commits specification (https://www.conventionalcommits.org/):

```text
feat: add policy expiration notification
fix: correct date parsing in user registration
refactor: extract validation logic from PolicyController
docs: update API documentation for /api/policies
```

> **Reasoning:** Semantic commits enable automated changelog generation, make `git log` meaningful, and help reviewers understand the *intent* of each commit before reading the diff.

## 13.7 Keep Current With the Integration Branch

Before beginning work each day, and before making a commit, pull the latest changes from `develop` into your working branch. Resolve conflicts immediately and verify that the application still builds and runs correctly.

Do not allow feature branches to drift for long periods without syncing from `develop`.

## 13.8 Inspect Changes Before Committing

Before committing, review your own diff. Confirm that the commit contains only intentional changes and does not include unrelated formatting, debug code, commented out code, temporary files, secrets, compiled binaries, or generated artifacts that should not be committed.

## 13.9 Files That Must Not Be Committed

Do not commit:

- Compiled binaries.
- Build output folders.
- Videos or large media files unless explicitly required.
- Local environment files.
- Client passwords or credentials.
- API keys, tokens, connection strings, or certificates.
- Temporary files generated by IDEs or local tooling.
- Database backups or exported production data.

Use `.gitignore`, secret management, environment variables, Azure Key Vault, or approved deployment tooling for environment specific values.

# 14. Security Standards

**Primary References:**

- OWASP Top 10, https://owasp.org/Top10/
- OWASP Secure Coding Practices Quick Reference, https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/

## 14.1 Input Validation

Validate all inputs at the boundary layer (controllers). Use ModelState validation and FluentValidation for structured request validation. Never trust client-side validation alone.

## 14.2 Authentication and Authorization

JWT authentication middleware is the standard for API authentication. Ensure tokens are validated on every request. Apply authorization policies at the controller or action level.

## 14.3 Secrets Management

Never commit secrets, connection strings, API keys, or credentials to source control. Use Azure Key Vault, environment variables, or user secrets for local development.

## 14.4 Dependency Scanning

Keep NuGet packages, npm packages, and Python dependencies up to date. Regularly review for known vulnerabilities using tools like `dotnet list package --vulnerable`, `npm audit`, and `pip-audit`.

## 14.5 Error Handling and Logging

End users must never see stack traces, database errors, exception details, internal service names, file paths, or sensitive implementation details. User facing errors should be clear, safe, and actionable.

When appropriate, return or display a unique correlation ID or error code that support teams can use to locate the detailed log entry.

Detailed exception information should be written to application logs, not shown to users. Logs should include enough context to support troubleshooting, such as the application area, operation name, correlation ID, exception message, stack trace, and relevant non sensitive variables.

Expected domain or validation failures should use the project standard result pattern. Unexpected failures should be handled through centralized exception handling, structured logging, and appropriate alerts.

## 14.6 Resource Cleanup

Resources that require explicit cleanup must be released correctly even when an exception occurs. Use language appropriate constructs such as `using`, `await using`, `try/finally`, or equivalent patterns.

Examples include:

- Streams.
- File handles.
- Database connections.
- Network connections.
- Sockets.
- Thread locks.
- Unmanaged resources.

# 15. Documentation Standards

**Primary References:**

- JSDoc, https://jsdoc.app/
- PEP 257, https://peps.python.org/pep-0257/

## 15.1 Code Documentation

- **C#:** XML doc comments on all public members (see [Section 4.8](#48-xml-documentation)).
- **TypeScript:** JSDoc comments on exported functions and complex types.
- **Python:** Google-style docstrings on all public functions, classes, and modules.

## 15.2 Architecture Decision Records (ADRs)

Significant architectural decisions (framework choices, pattern adoptions, technology changes) should be recorded as ADRs in a `docs/adr/` folder within the repository. Each record captures the context, decision, alternatives considered, and consequences.

## 15.3 Project-Level Documentation

Each project must maintain a current `README.md` and, for projects using AI agents, an `AGENTS.md` or equivalent instruction file that supplements this document with project-specific rules.

# 16. Code Review Standards

**Primary References:**

- Google Engineering Practices, Code Review, https://google.github.io/eng-practices/

## 16.1 Review Philosophy

Code reviews should be respectful, constructive, and focused on improving the codebase. Reviewers should critique the code, not the developer. Feedback should be tied to correctness, maintainability, performance, security, project requirements, or documented standards.

When possible, ask clarifying questions rather than making accusatory statements. Prefer a question such as, `What was the reasoning behind this approach?`, instead of a statement that sounds personal or confrontational.

Code reviews are not problem solving meetings. If a review uncovers a larger design issue, identify it, agree on the next step, and move the detailed design discussion outside the PR when appropriate.

Approve a change once it definitively improves overall code health, even if it isn’t perfect. Do not block a PR on stylistic preferences that are not codified in this document. If you find yourself giving the same feedback repeatedly, propose adding the rule to this document.

## 16.2 What Reviewers Should Check

- Correctness: Does the code do what it claims?
- Adherence to these standards (naming, size limits, patterns).
- Test coverage for new and changed behavior.
- Security implications (input validation, authorization, data exposure).
- Performance concerns (N+1 queries, unnecessary allocations, missing async).

## 16.3 Author Responsibilities

- Self-review your diff before requesting review.
- Keep PRs focused and reasonably sized. If a PR touches more than ~400 lines of production code, consider splitting it.
- Respond to review comments promptly.

# 17. Tooling and Enforcement

The most effective standards are enforced automatically. This section defines the tools we use to make our standards self-enforcing, separates the tools that already ship with our environments from the ones we deliberately add, and sets a baseline expectation for security and extension trust.

**Security note**. Every tool listed here either runs locally, runs in CI, or is installed as an IDE extension that executes with the same privileges as the developer. A malicious analyzer, formatter, or extension can read source code, exfiltrate secrets from the workspace, and modify files on disk. We treat IDE extensions, npm packages, and NuGet analyzers as part of our supply chain and apply the trust rules in Section 17.1 to all of them. Security is not a separate concern from tooling; it is a constraint on which tools we are willing to introduce.

## 17.1 Approach: Built-In First, Then Add-Ons

We prefer tools that ship inside the latest versions of .NET SDK, Visual Studio, or VS Code over external add-ons whenever they exist and are sufficient. Built-in tools require no separate install, are signed by the platform vendor, version-step with the SDK or IDE, and present a smaller supply-chain surface than community extensions. Where built-in coverage is incomplete (Prettier, ESLint, Tailwind IntelliSense, accessibility lints, secret scanning, SAST) we add carefully chosen NuGet packages, npm packages, or IDE extensions from vendors on our approved publisher list.

**Tool versions must match project versions.** Many of the tools below — ESLint, the React and Angular ESLint plugins, the SonarAnalyzer NuGet package, Meziantou.Analyzer, Tailwind CSS IntelliSense, and others — have major versions tied to specific Node.js, .NET, React, Angular, TypeScript, or Tailwind versions. A new project should adopt the latest stable version of each tool that is compatible with the runtimes and frameworks it uses. An older project running, for example, .NET Framework 4.8, React 17, or Angular 14 must pin tool versions that still support those runtimes; forcing the latest analyzer or plugin onto a legacy codebase usually breaks the build, the lint, or both. Each subsection below names the tool of record without pinning a specific version; teams are expected to choose the right version for their project.

## 17.2 Standards Files in the Repository

Every Xorbix repository commits a small set of configuration files that the tooling reads. New repositories inherit them from our starter templates as needed based on project.

| File | Lives at | Read by | Controls |
|----|----|----|----|
| *.editorconfig* | Repository root | Visual Studio 2026, VS Code, JetBrains, *dotnet format*, Roslyn analyzers | Indentation, line endings, charset, trailing whitespace, final newline, and the full set of C# *IDExxxx* style rules and severities (naming, *var* usage, expression-bodied members, etc.) |
| *.prettierrc* and *.prettierignore* | Repository root | Prettier CLI, *esbenp.prettier-vscode* (VS Code), pre-commit hooks | Print width, quote style, semicolons, trailing commas, end-of-line, and which paths Prettier should skip |
| *eslint.config.js* (flat config) | Repository root | ESLint CLI, *dbaeumer.vscode-eslint* (VS Code), CI | All ESLint rules, plugins (*@typescript-eslint*, *eslint-plugin-react*, *eslint-plugin-react-hooks*, *eslint-plugin-jsx-a11y*), and per-glob overrides |
| *stylelint.config.mjs* | Repository root | Stylelint CLI, *stylelint.vscode-stylelint* (VS Code), CI | CSS, SCSS, and Tailwind layer rules |
| *pyproject.toml* (with *\[tool.ruff\]*) | Repository root of any Python project | Ruff CLI, *charliermarsh.ruff* (VS Code), CI | Python lint rule set, formatter options, per-file ignores, target Python version |
| *tsconfig.json* | Repository root of any TS project | TypeScript compiler, VS Code, ESLint type-aware rules | *strict*, *noUncheckedIndexedAccess*, *noImplicitOverride*, *exactOptionalPropertyTypes*, and module resolution |
| *Directory.Build.props* | Repository root or *src/* root for any .NET solution | MSBuild, the .NET SDK, Visual Studio 2026 | Solution-wide MSBuild properties: *\<EnforceCodeStyleInBuild\>*, *\<AnalysisMode\>*, *\<TreatWarningsAsErrors\>*, *\<Nullable\>*, target framework |
| *Directory.Packages.props* | Repository root for any .NET solution | NuGet, MSBuild | Central package version management, including analyzer package versions, so all projects in the solution pin to the same version |
| *.gitleaks.toml* | Repository root | Gitleaks CLI, pre-commit hook, CI | Custom secret-detection rules and allowlists on top of the Gitleaks defaults |
| *.vscode/extensions.json* | *.vscode/* folder in the repo | VS Code | The exact list of approved extensions VS Code prompts the developer to install on first open |
| *.vscode/settings.json* | *.vscode/* folder in the repo | VS Code | Per-repository editor settings: format-on-save, default formatter per language, ESLint working directories, file associations |
| *.husky/* and *package.json* lint-staged block | Repository root | Husky, lint-staged, Git | Which commands run on which files at pre-commit and pre-push time |

The *.vscode/settings.json* file is committed; developer-personal settings stay in the user-level settings and are never committed. The *.vscode/extensions.json* file is the on-ramp that gets a new hire from *git clone* to a fully linted editor in one prompt.

## 17.3 Editor Baseline

**Visual Studio** is our primary editor for .NET solutions, SQL Server Data Tools (SSDT) projects, and any work where designer surfaces, advanced .NET debugging, or SQL schema compare is on the critical path. Roslyn analyzers, `dotnet format`, EditorConfig support, and the SQL projects experience are first-party and require no additional install.

Visual Studio 2026 does not ship a first-party Prettier integration, a first-party ESLint integration, or first-party Tailwind tooling. Teams doing significant JavaScript, TypeScript, React, or Tailwind work should use VS Code for those files. When that is impractical, we enforce Prettier and ESLint through pre-commit hooks (see Section 17.9), which guarantees consistent output regardless of the editor used to type the code.

**VS Code** is our primary editor for TypeScript, JavaScript, React, HTML, CSS, Tailwind, Python, SQL (cross-platform), Terraform, and Bicep work, and the only editor where our full lint and format stack runs in-IDE. New repositories ship a `.vscode/extensions.json` that recommends the exact extensions listed in this section; opening the repo prompts the developer to install them. Workspace Trust is left at its default (Restricted Mode for any folder not previously trusted); cloned-from-the-internet repositories stay in restricted mode until a developer has reviewed them.

## 17.4 Formatting

Formatting is non-negotiable and runs on save, on commit, and in CI. Disagreements about formatting are resolved by the tool, not the developer.

| Tool | Type | Visual Studio 2026 | VS Code | Languages | Notes |
|----|----|----|----|----|----|
| `dotnet format` | Built-in to .NET SDK | Built-in | Built-in (via C# Dev Kit) | C# (driven by `.editorconfig`) | Required |
| CSharpier | Add-on (NuGet + extension) | Extension: `csharpier.CSharpier-VS2022` | Extension: `csharpier.csharpier-vscode` | C# (opinionated, Prettier-style) | Required |
| Prettier | Add-on (npm + extension) | Pre-commit hook only (see 17.9) | Extension: `esbenp.prettier-vscode` | JS, TS, JSX, TSX, CSS, SCSS, HTML, JSON, YAML, Markdown | Required |
| `prettier-plugin-tailwindcss` | Add-on (npm plugin) | Pre-commit hook only | Loaded automatically by the Prettier extension | Tailwind class-order in any framework | Flagged for eval |
| Ruff format | Add-on (extension wraps `ruff` CLI) | Not applicable | Extension: `charliermarsh.ruff` | Python | Flagged for eval |
| SQLFluff fix | Add-on (Python CLI) | CI only | Community extension or CLI | T-SQL, PostgreSQL, MySQL | Flagged for eval |

**The Visual Studio Prettier gap.** Visual Studio 2026 does not have a maintained, first-party Prettier extension. Two practices close the gap. First, *commit-time enforcement*: a Husky pre-commit hook runs Prettier through `lint-staged` on every staged file. The developer’s editor of choice does not matter; by the time the commit lands, the file is formatted. Setup is in Section 17.9. Second, *CSharpier for C#*: for C# files specifically, CSharpier is a Roslyn-based, opinionated formatter in the same spirit as Prettier and ships a Visual Studio extension that formats on save inside VS 2026. CSharpier is recommended on new .NET projects where the team wants Prettier-style discipline; it is optional on existing projects.

`dotnet format` runs against `.editorconfig` and is required in CI (`dotnet format --verify-no-changes` fails the build on drift). CSharpier and `dotnet format` are compatible: CSharpier owns whitespace and line-wrapping, `dotnet format` owns the IDExxxx style rules.

## 17.5 Linting and Static Analysis

### 17.5.1 .NET (Roslyn analyzers)

The .NET SDK ships first-party analyzers that we enable on every project. We layer additional NuGet analyzer packages on top of them. The rules are expressible as `IDExxxx` rules in `.editorconfig`.

| Analyzer | Type | How it gets into the project | Purpose | Notes |
|----|----|----|----|----|
| `Microsoft.CodeAnalysis.NetAnalyzers` (the `CAxxxx` rules) | Built-in to .NET SDK | Enabled via `<AnalysisMode>Recommended</AnalysisMode>` in `Directory.Build.props` | Quality, performance, reliability, security | Required |
| C# code-style analyzers (the `IDExxxx` rules) | Built-in to .NET SDK | Enabled via `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>` and configured in `.editorconfig` | Style, naming, modernization (covers most of what StyleCop did) | Required |
| `SonarAnalyzer.CSharp` | Add-on (NuGet, SonarSource) | `PackageReference` (see below) | Bug detection, code smells, security hotspots; same rule set as SonarQube for IDE | Required |
| `Meziantou.Analyzer` | Add-on (NuGet, Gerald Barre) | `PackageReference` | Correctness, async hygiene, performance, security; very active rule cadence | Flagged for eval |
| `Roslynator.Analyzers` | Add-on (NuGet), optional | `PackageReference` | Approximately 500 additional refactorings and diagnostics | Flagged for eval |

**Analyzer NuGet versions track .NET versions.** Analyzer packages have major versions tied to specific .NET SDK and target framework versions. The version numbers in the examples below were current at the time of writing for projects targeting modern .NET (currently .NET 10). Projects targeting .NET Framework or older .NET versions must pin to analyzer versions that still support those targets — SonarAnalyzer.CSharp 10.x, for example, requires .NET 8+ build tooling. As with any NuGet dependency, the right version is the latest stable one compatible with the project’s target framework.

**How a NuGet analyzer actually gets into a project.** Roslyn analyzers ship as ordinary NuGet packages, but they are not runtime dependencies; they are MSBuild-time tools that read the source code during compile. The pattern below adds an analyzer to every project in the solution at the same version, ensures the analyzer is not propagated to consumers of the project, and treats its diagnostics as warnings (or errors, depending on policy).

Add the analyzer version centrally, once per solution, in `Directory.Packages.props`:

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="SonarAnalyzer.CSharp" Version="10.25.0.139117" />
    <PackageVersion Include="Meziantou.Analyzer"   Version="3.0.84" />
  </ItemGroup>
</Project>
```

Then reference the analyzers in `Directory.Build.props` so every project in the solution picks them up automatically:

```xml
<Project>
  <PropertyGroup>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <AnalysisMode>Recommended</AnalysisMode>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="SonarAnalyzer.CSharp">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="Meziantou.Analyzer">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>
```

`PrivateAssets=all` is the critical detail: it stops the analyzer from leaking into the public NuGet metadata of the project being built, so a downstream consumer of our library does not inherit our analyzer dependencies. Diagnostics from these analyzers appear in the Visual Studio 2026 Error List, in the VS Code Problems panel (when the C# Dev Kit is installed), and in CI as build warnings or errors depending on the project’s `TreatWarningsAsErrors` setting. Severity for individual rules is tuned in `.editorconfig` using `dotnet_diagnostic.<RULE_ID>.severity = error|warning|suggestion|silent|none`.

### 17.5.2 JavaScript / TypeScript / React

We use the latest stable version of ESLint, TypeScript, and the framework-specific ESLint plugins that is compatible with the project’s Node.js, framework, and ecosystem versions. On greenfield projects this typically means ESLint 10 with flat config (`eslint.config.js`) — the modern default since ESLint 9.0 in April 2024 — paired with current `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, and `angular-eslint` releases. Legacy projects running older Node.js, React 17, Angular 14 to 16, or any framework version that does not yet support the current tool generation may need to stay on ESLint 8 with the `.eslintrc.*` format and pin plugin versions accordingly; that is acceptable, and the legacy stack remains supported. The aim is not the newest tool in absolute terms — it is the newest tool that is compatible with what the project actually runs.

| Tool | Type | Visual Studio 2026 | VS Code | Notes |
|----|----|----|----|----|
| ESLint 10.X | Add-on (npm) | Pre-commit only | Extension: `dbaeumer.vscode-eslint` (Microsoft) | Flat config required on new projects |
| `typescript-eslint` | Add-on (npm) | Pre-commit only | Via ESLint extension | Type-aware lint rules |
| `eslint-plugin-react` | Add-on (npm) | Pre-commit only | Via ESLint extension | Required on React projects |
| `eslint-plugin-react-hooks` | Add-on (npm) | Pre-commit only | Via ESLint extension | Required on React projects |
| `eslint-plugin-jsx-a11y` | Add-on (npm) | Pre-commit only | Via ESLint extension | Required on React projects (see 17.7) |
| `angular-eslint` | Add-on (npm) | Pre-commit only | Via ESLint extension | Required on Angular projects |
| Biome | Add-on (npm, single Rust binary) | Pre-commit only | Extension: `biomejs.biome` | Flagged for eval |

## 17.5.3 CSS and Tailwind

Stylelint runs against every CSS-bearing repository. Tailwind class ordering is enforced by `prettier-plugin-tailwindcss` so class lists do not diverge between developers.

| Tool | Type | Visual Studio 2026 | VS Code | Notes |
|----|----|----|----|----|
| Stylelint with `stylelint-config-standard` | Add-on (npm) | Pre-commit only | Extension: `stylelint.vscode-stylelint` | CSS, SCSS, Less. **Flagged for eval** |
| Tailwind CSS IntelliSense | Add-on | Community extension: `TheronWang.TailwindCSSIntellisense` | Extension: `bradlc.vscode-tailwindcss` (publisher Tailwind Labs) | Class autocomplete, hover docs, colors. **Flagged for eval** |
| `prettier-plugin-tailwindcss` | Add-on (npm plugin) | Pre-commit only | Loaded automatically by Prettier | Canonical class-order sorting; required on Tailwind projects. **Flagged for eval** |

## 17.5.4 Python

Ruff is the single linter and formatter for Python. Type checking and security linting are layered on top.

| Tool | Type | Visual Studio 2026 | VS Code | Notes |
|----|----|----|----|----|
| Ruff (lint and format) | Add-on (`ruff` CLI plus extension) | Limited (use VS Code for Python) | Extension: `charliermarsh.ruff` (Astral) | Replaces Flake8, Black, isort, pyupgrade. **Flagged for eval** |
| Pylance | Add-on (extension) | Not applicable | Extension: `ms-python.vscode-pylance` (Microsoft) | Type checking, IntelliSense. Required |
| mypy or Pyright | Add-on (CLI) | CLI only | Run via Pylance or as a task | Required in CI on typed codebases |
| Bandit | Add-on (CLI) | CLI only | CLI or task | Recommended for security-sensitive Python code. **Flagged for eval** |

## 17.5.5 SQL

Visual Studio 2026 remains the primary editor for SQL Server projects via SSDT. VS Code is the cross-platform alternative for ad-hoc query work and Fabric scenarios.

| Tool | Type | Visual Studio 2026 | VS Code | Notes |
|----|----|----|----|----|
| SQL Server Data Tools (SSDT) | Add-on, installed via VS installer | Required for SQL projects | Not applicable | Schema compare, publish, `.sqlproj` |
| mssql for VS Code | Add-on (extension) | Not applicable | Extension: `ms-mssql.mssql` (Microsoft) | Query, format, Fabric connectivity |
| SQLFluff | Add-on (Python CLI) | CLI only | Community extension or CLI | Dialect-aware T-SQL linting; runs in CI . **Flagged for eval** |

## 17.5.6 Infrastructure as Code

Both extensions below are first-party from their respective vendors. Terraform development happens primarily in VS Code; Bicep is supported in both IDEs.

| Tool | Type | Visual Studio 2026 | VS Code | Notes |
|----|----|----|----|----|
| HashiCorp Terraform | Add-on (extension) | Not applicable | Extension: `HashiCorp.terraform` | Bundles the Terraform Language Server |
| TFLint | Add-on (CLI) | CLI only | Community extension or CLI | Provider-specific lints; runs in CI |
| Bicep | Add-on (extension) | Extension available in the VS installer (Microsoft) | Extension: `ms-azuretools.vscode-bicep` (Microsoft) | First-party from Microsoft |

## 17.6 Type Checking

Static type checking is mandatory on all new code. Languages with built-in type systems use the strictest practical settings their language version supports. The TypeScript strict flags listed below are available on TypeScript 4.4 and later; older TypeScript projects should enable the subset their version supports. Python uses Pyright via Pylance.

| Tool | Type | Visual Studio 2026 | VS Code | Notes |
|----|----|----|----|----|
| C# nullable reference types | Built-in | Built-in | Built-in | Enabled via `<Nullable>enable</Nullable>` |
| TypeScript strict mode | Built-in to TypeScript | Built-in | Built-in | `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` |
| Pylance / Pyright | Add-on | Not applicable | Extension: `ms-python.vscode-pylance` | Python type checking, basic or strict mode |

## 17.7 Accessibility

Accessibility lint runs on every React project. We do **not** install the VS Code extension named A11y Lint: its publisher is not on our approved list, the same rules are available through the official ESLint pipeline, and adding an unverified extension to enforce accessibility is the wrong trade-off given that accessibility is a delivery requirement.

| Tool | Type | Visual Studio 2026 | VS Code | Notes |
|----|----|----|----|----|
| `eslint-plugin-jsx-a11y` | Add-on (npm) | Pre-commit only | Via the standard ESLint extension | Static JSX accessibility rules; required on React projects. **Flagged for eval** |
| `@axe-core/react` | Add-on (npm) | Not applicable | Runs in the browser in dev mode | Runtime DOM accessibility checks; recommended in dev builds. **Flagged for eval** |
| axe DevTools and Lighthouse | Browser tools | Not applicable | Not applicable | Manual audit before release. **Flagged for eval** |

## 17.8 Security Tooling

We apply security analysis in four places: in the editor, in pre-commit hooks, in CI on every pull request, and on a schedule against the default branch. No single tool covers all four; the layered baseline below is the minimum for every Xorbix repository. Section 17.8.1 lists the cross-platform tools that run regardless of where the code is hosted. Section 17.8.2 lists tools built into Azure DevOps that supplement the cross-platform baseline for projects hosted there. Projects hosted on Beanstalk or other Git platforms without a native security stack rely on 17.8.1 alone.

## 17.8.1 In-IDE and CI-Runnable Tools

These tools run in the developer’s editor, as pre-commit hooks, or as CLI invocations inside any CI pipeline. They are not tied to a specific Git host or CI platform and apply to every Xorbix project regardless of where the repository lives.

| Layer | Tool | Where it runs | Required? |
|----|----|----|----|
| In-IDE SAST | SonarQube for IDE (formerly SonarLint) | Extension in Visual Studio 2026 (`SonarSource.SonarLintforVisualStudio2022`, supports VS 2026) and VS Code (`SonarSource.sonarlint-vscode`) | Yes |
| CI SAST | Semgrep (open source) | CI | Flagged for eval. (Paid?)) |
| Dependency vulnerabilities (.NET) | `dotnet list package --vulnerable --include-transitive` | CI on every PR | Yes |
| Dependency vulnerabilities (npm) | `npm audit --omit=dev` | CI on every PR | Yes |
| Dependency vulnerabilities (Python) | `pip-audit` | CI on every PR | Yes |
| Secret scanning (local) | Gitleaks | Pre-commit hook | Flagged for eval |
| Secret scanning (deep) | TruffleHog | Scheduled CI run on the default branch | Flagged for eval |
| Container scanning | Trivy | CI for any repo that produces a container image | Flagged for eval, |
| Commercial SCA | Snyk | IDE extension plus CI | Flagged for eval, Paid |

SonarQube for IDE in Connected Mode (bound to a shared SonarQube server or SonarQube Cloud project) is a paid option that is not required. It works in the free mode.

## 17.8.2 Azure DevOps Built-In Security Tools

For projects hosted in Azure DevOps, Microsoft’s first-party security tooling for the platform supplements the cross-platform baseline. These tools live inside Azure DevOps — toggled in project settings, run as pipeline tasks from the Marketplace, or aggregated in the Azure portal — and are unavailable to projects hosted on Beanstalk or other Git platforms without their own platform-native security stack. The tools below are used in addition to, not in place of, the cross-platform tools in 17.8.1.

| Tool | Purpose | How it is enabled | Required? |
|----|----|----|----|
| GHAzDO — Secret Protection | Push protection blocks commits containing detected secrets; repository scanning runs continuously against all branches; bypass events are recorded in the audit log | Project Settings, Repos, Repositories — toggle Advanced Security per repository (billed per active committer) | Flagged for Eval (Paid) |
| GHAzDO — Code Security (CodeQL) | Static analysis for C#, JavaScript/TypeScript, Python, Java, Go, C/C++, Ruby, and Swift; findings surface in the Advanced Security UI in Azure Repos | Add `AdvancedSecurity-Codeql-Init@1` and `AdvancedSecurity-Codeql-Analyze@1` tasks to the pipeline; use `buildtype: none` for buildless scanning (the older `AdvancedSecurity-Codeql-Autobuild` task is removed March 1, 2026) | Flagged for Eval (Paid) |
| GHAzDO — Dependency Scanning | Detects vulnerable direct and transitive open-source dependencies with remediation guidance | Toggle `Scan for vulnerable dependencies` on the repository to scan the default branch, or add the `AdvancedSecurity-Dependency-Scanning-Task@1` task to scan all branches in a pipeline | Flagged for Eval (Paid) |
| Microsoft Security DevOps (`MicrosoftSecurityDevOps@1`) | Single pipeline task that orchestrates open-source scanners: Bandit (Python), Checkov (IaC), Template Analyzer (ARM/Bicep), Terrascan (IaC), Trivy (containers), BinSkim (binaries), ESLint; results published as SARIF to the `CodeAnalysisLogs` artifact | Install the Microsoft Security DevOps Marketplace extension, then add the task to the pipeline YAML | Flagged for Eval |
| SARIF SAST Scans Tab (`sariftools.scans`) | Renders SARIF results in a Scans tab on the pipeline run with severities, file/line context, and per-finding triage; auto-discovers SARIF in the `CodeAnalysisLogs` artifact | Install the Marketplace extension at the organization level | Flagged for Eval |
| Microsoft Defender for Cloud — DevOps Security | Cross-organization dashboard that ingests SARIF from MSDO and GHAzDO; can annotate pull requests with findings and correlate code findings with cloud resource posture | Azure portal, Microsoft Defender for Cloud, Environment settings, Add environment, Azure DevOps — connect the organization; enable PR annotations in the DevOps Security blade | Flagged for Eval |

**MSDO and GHAzDO are complementary, not redundant.** MSDO’s older secret-scanning capability (CredScan) was deprecated in September 2023 and is not used; GHAzDO Secret Protection is the supported path for secrets. MSDO’s value is pipeline orchestration of open-source IaC, container, and binary scanners; GHAzDO’s value is first-party secret scanning, CodeQL, and dependency scanning with native Azure Repos UI integration. We run both on Azure DevOps projects where GHAzDO is licensed.

**Secret management in pipelines.** Azure DevOps pipeline variables marked secret are acceptable for low-sensitivity values but production secrets belong in **Azure Key Vault**, retrieved through the `AzureKeyVault@2` task or through variable groups linked to Key Vault. Service connections to Azure should use **workload identity federation (OIDC)** rather than long-lived service principal secrets; this is configurable on each service connection and removes a class of secret-rotation work entirely.

## 17.9 CI and Pre-Commit Hooks

A **pre-commit hook** is a script that Git runs locally before `git commit` completes. If the script exits non-zero, the commit is rejected. Pre-commit hooks let us enforce formatting, linting, and secret-scanning on every developer’s machine regardless of editor; they are how we close the Visual Studio Prettier and ESLint gap without forcing developers off Visual Studio for .NET work.

We use **Husky** to install hooks (it stores them in `.husky/` so they are committed to the repo, instead of in the per-clone `.git/hooks/` directory) and **lint-staged** to run formatters and linters only against the files actually staged for commit. The setup below goes in any repository that has a `package.json` (including a .NET solution that has a small `package.json` purely for this purpose).

**One-time setup for a new repository.** Run these commands from the repository root:

```bash
npm install --save-dev husky lint-staged prettier eslint @biomejs/biome
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

Then add a `lint-staged` block to `package.json`:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,scss,html,json,md,yml,yaml}": [
      "prettier --write"
    ],
    "*.cs": [
      "dotnet csharpier --write"
    ],
    "*.{sql,py,tf,bicep}": [
      "prettier --write --ignore-unknown"
    ]
  }
}
```

**Gitleaks pre-commit hook.** Add a second command to `.husky/pre-commit` so a secret accidentally added to a tracked file fails the commit before it is ever pushed:

```bash
# .husky/pre-commit
npx lint-staged
gitleaks protect --staged --redact --config .gitleaks.toml
```

`dotnet format` and CSharpier in CI. The pre-commit hook handles the local case; CI handles the case where someone skipped hooks (`git commit --no-verify`) or worked in an editor that did not run them. Every pull request runs these checks:

```yaml
# Excerpt from azure-pipelines.yml
- script: dotnet format --verify-no-changes
  displayName: 'Check C# formatting'
- script: dotnet csharpier --check .
  displayName: 'Check CSharpier formatting'
- script: npx eslint .
  displayName: 'Lint JS/TS'
- script: npx prettier --check .
  displayName: 'Check Prettier formatting'
- script: dotnet build --no-restore -warnaserror
  displayName: 'Build with analyzers (warnings as errors)'
- script: gitleaks detect --redact --config .gitleaks.toml
  displayName: 'Gitleaks (full repo scan)'
```

The example above is for Azure Pipelines; teams running CI on a different system for projects hosted on Beanstalk or elsewhere should adapt the YAML syntax to their CI’s conventions while keeping the same script steps. This combination of pre-commit hooks for fast local feedback and CI checks as the authoritative gate is what lets a developer use Visual Studio 2026 for .NET work and still produce commits that satisfy our Prettier, ESLint, and Stylelint rules on the JavaScript and CSS files in the same repository.

## 17.10 IDE Extension Trust Policy

IDE extensions execute with the developer’s full user privileges. The VS Code Marketplace Verified Publisher badge confirms only that the publisher controls a domain name; it does not vet the extension code. Multiple campaigns in 2025 published trojaned extensions under verified publisher accounts, including a typosquatted Prettier extension that delivered a remote access trojan and a worm that propagated across the Marketplace and Open VSX hiding payloads in invisible Unicode characters. Our policy assumes this will continue.

**Approved publishers.** Extensions from the following publishers may be installed without additional review:

- **Microsoft:** `Microsoft`, `ms-azuretools`, `ms-mssql`, `ms-python`, `ms-vscode-remote`, `ms-dotnettools`, `ms-vscode`, `dbaeumer` (Dirk Baeumer, Microsoft, maintains the ESLint extension)
- **GitHub:** `GitHub`
- **HashiCorp:** `HashiCorp`
- **SonarSource:** `SonarSource`
- **Tailwind Labs:** `bradlc` (the official Tailwind CSS IntelliSense extension)
- **Astral:** `charliermarsh` (Ruff)
- **Prettier:** `esbenp`
- **Stylelint:** `stylelint`
- **Red Hat:** `redhat`
- **Biome:** `biomejs`
- **CSharpier:** `csharpier`

**Adding a new publisher.** Any extension from a publisher not on the list above requires review by a technical lead before installation. The review confirms: the publisher displays a verified badge with a domain we can independently match to the project’s website, the extension is open source with a public repository, the repository shows recent maintenance activity, and the install count and review history are consistent with widespread legitimate use. Domain verification alone is not sufficient. Once approved, the publisher is added to this list in the next revision of this document.

**Project-pinned extensions.** Every new repository commits a `.vscode/extensions.json` that lists the exact approved extensions the project depends on. VS Code prompts a new developer to install only this set when the repo is first opened, which both speeds onboarding and reduces the pressure to grab whatever Marketplace returns first.

**Workstation hardening.** Workspace Trust stays at its default. Cloned-from-the-internet repositories open in Restricted Mode until reviewed. Auto-update of installed extensions remains on (so that vendor security fixes ship quickly), but the act of adding a new extension always goes through the approval list above. Suspected malicious extensions are reported to the security team and removed from all workstations through the standard endpoint management process.

# 18. References

## Principles Referenced in This Document

The principles in Section 3 are drawn from the following sources. This appendix provides attribution and further reading for developers who want to study them in depth.

| Principle (Section) | Origin | Key Source |
|----|----|----|
| Simplicity / KISS (3.1) | Kelly Johnson, Lockheed Skunk Works | Widely attributed; no single publication |
| Don’t Repeat Yourself (3.2) | Andrew Hunt & David Thomas | *The Pragmatic Programmer* (1999) |
| YAGNI (3.3) | Kent Beck, Extreme Programming | *Extreme Programming Explained* (1999) |
| Single Responsibility (3.4) | Robert C. Martin | *Agile Software Development* (2002) |
| Dependency Inversion (3.5) | Robert C. Martin | *Agile Software Development* (2002) |
| Composition over Inheritance (3.6) | Gamma, Helm, Johnson, Vlissides | *Design Patterns* (1994) |
| Fail Fast (3.8) | Jim Shore | “Fail Fast” (IEEE Software, 2004) |
| Law of Demeter (3.9) | Karl Lieberherr et al. | Northeastern University (1987) |
| Boy Scout Rule (3.10) | Robert C. Martin | *Clean Code* (2008) |
| Open/Closed Principle (3.11) | Bertrand Meyer | *Object-Oriented Software Construction* (1988) |
| Principle of Least Astonishment (3.13) | Geoffrey James | *The Tao of Programming* (1987) |
| [Cognitive Complexity (3.16)](https://www.sonarsource.com/docs/CognitiveComplexity.pdf) | G. Ann Campbell, SonarSource | White paper (2016, 2023); ACM TechDebt 2018 |
| Premature Optimization (3.18) | Donald Knuth | *Computer Programming as an Art* (1974) |

## Books

| Book | Author(s) | Edition/Year |
|----|----|----|
| **Clean Code** | Robert C. Martin | 2nd Ed, 2025 |
| **Code Complete** | Steve McConnell | 2nd Ed, 2004 |
| **The Pragmatic Programmer** | Thomas & Hunt | 20th Anniversary Ed, 2019 |
| **Refactoring** | Martin Fowler | 2nd Ed, 2018 |
| **Design Patterns** (GoF) | Gamma, Helm, Johnson, Vlissides | 1st Ed, 1994 |
| **Clean Architecture** | Robert C. Martin | 1st Ed, 2017 |
| **A Philosophy of Software Design** | John Ousterhout | 2nd Ed, 2021 |
| **Working Effectively with Legacy Code** | Michael Feathers | 1st Ed, 2004 |
| **Unit Testing Principles, Practices, Patterns** | Vladimir Khorikov | 1st Ed, 2020 |
| **Framework Design Guidelines** | Cwalina & Abrams | 3rd Ed |

## Online Style Guides

| Guide | URL |
|----|----|
| Google Style Guides (all languages) | https://google.github.io/styleguide/ |
| Google Engineering Practices | https://google.github.io/eng-practices/ |
| Airbnb JavaScript Style Guide | https://github.com/airbnb/javascript |
| Airbnb React/JSX Style Guide | https://github.com/airbnb/javascript/tree/master/react |
| Microsoft C# Coding Conventions | https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions |
| .NET Framework Design Guidelines | https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/ |
| PEP 8 | https://peps.python.org/pep-0008/ |
| Google Python Style Guide | https://google.github.io/styleguide/pyguide.html |
| Angular Style Guide | https://angular.dev/style-guide |
| WHATWG HTML Living Standard | https://html.spec.whatwg.org/multipage/ |
| Google HTML/CSS Style Guide | https://google.github.io/styleguide/htmlcssguide.html |

## Security and Accessibility

| Resource     | URL                                 |
|--------------|-------------------------------------|
| OWASP Top 10 | https://owasp.org/Top10/            |
| WCAG 2.2     | https://www.w3.org/TR/WCAG22/       |
| WAI-ARIA 1.2 | https://www.w3.org/TR/wai-aria-1.2/ |

## API Design and Workflow

| Resource                      | URL                                         |
|-------------------------------|---------------------------------------------|
| Microsoft REST API Guidelines | https://github.com/microsoft/api-guidelines |
| Google API Design Guide       | https://cloud.google.com/apis/design        |
| Conventional Commits          | https://www.conventionalcommits.org/        |
| Semantic Versioning           | https://semver.org/                         |
