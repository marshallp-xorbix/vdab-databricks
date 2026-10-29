# Xorbix .NET API + React — Standard Architecture
**Last Updated:** 11 June 2026  
**Applies To:** All Xorbix .NET API projects with React frontends

> **VDAB applicability:** This document is the historical .NET/Aspire/EF Core architecture reference for this repository. The active architecture is [TypeScript and Databricks Apps](node-databricks-app-architecture.md). The sections below apply only when maintaining existing .NET source. Do not add VDAB product behavior to the legacy .NET stack.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Solution Structure](#2-solution-structure)
3. [Aspire Orchestration](#3-aspire-orchestration)
4. [Presentation Layer (Api, Server)](#4-presentation-layer-api-server)
5. [Service Layer (Business Logic)](#5-service-layer-business-logic)
6. [Data Access Layer](#6-data-access-layer)
7. [Contracts Layer (Shared Types)](#7-contracts-layer-shared-types)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [React Frontend Architecture](#9-react-frontend-architecture)
10. [API–Client Communication](#10-apiclient-communication)
11. [Dependency Registration](#11-dependency-registration)
12. [Configuration and Environments](#12-configuration-and-environments)
13. [Project Dependency Rules](#13-project-dependency-rules)
14. [Real-Time Communication (SignalR)](#14-real-time-communication-signalr)
15. [Observability (OpenTelemetry and Health Checks)](#15-observability-opentelemetry-and-health-checks)

---

## 1. Overview

This document defines the standard project architecture for Xorbix .NET API applications with React frontends. It implements an **N-Layer** design with clear separation between presentation, business logic, and data access, using Entity Framework Core as the ORM and the repository pattern to abstract data access from business logic.

The architecture enforces the principles defined in the Xorbix Development Standards, particularly:

- **One Responsibility Per Unit** — each layer owns a single concern.
- **Depend on Abstractions, Not Implementations** — layers communicate through interfaces.
- **Fail Fast and Fail Explicitly** — services return `Result<T>` instead of throwing exceptions.

All code examples target **.NET 10+** and **C# 14+** (evolving with stable version/language updates).

Use this document in two ways:

- Treat `Company.Project.*` as a placeholder naming pattern for new projects. Replace it with your actual company and product namespace when creating a project from the template.
- Compare the guidance here with the executable baseline in `Xorbix.Template.Baseline/`. When there is a gap, update the template or this document so they stay aligned.

---

## 2. Solution Structure

```
Solution: Company.Project
│
├── src/
│   ├── Company.Project.AppHost/                # Aspire Orchestration
│   ├── Company.Project.Server/                 # Presentation — Controllers, middleware, DI setup (alternate: .Api)
│   ├── Company.Project.Services/               # Business logic — services and interfaces
│   ├── Company.Project.Infrastructure/         # Data access — DbContext, repositories, migrations (alternate: .Data, .DataAccess)
│   ├── Company.Project.Contracts/              # Shared types — entities, DTOs, enums, constants, mapping extensions
│   ├── Company.Project.ServiceDefaults/        # Shared telemetry, health checks, and service discovery helpers
│   └── Company.Project.Client/                 # React frontend application
│
├── tests/
|   ├── Company.Project.Arch.Tests/             # ArchUnitNet tests that enforce architecture constraints
│   ├── Company.Project.Server.Tests/           # Controller/integration tests
│   ├── Company.Project.Services.Tests/         # Service unit tests
│   └── Company.Project.Infrastructure.Tests/   # Repository/query tests (if needed)
│
├── .documentation/                             # Project level documentation
│   └── adr/                                    # Architecture Decision Records
│
├── infra/                                      # IaC: Bicep, Terraform, or both
│   ├── bicep/                                  # Bicep templates and modules
│   └── terraform/                              # Terraform configurations and modules
│
├── .pipelines/                                 # YAML pipeline files, with file separation per stage (Validate, Build, Infrastructure, Deploy)
│
├── .azuredevops/                               # Azure DevOps files to aid in process: pull_request_template.md
│
├── README.md                                   # General Project Introduction, details top level development details, links to project documentation
├── AGENTS.md                                   # AI agent project-specific instructions
└── Company.Project.slnx
```

Each project in `src/` maps to a single architectural layer. No project should contain responsibilities that belong to another layer. If you find business logic creeping into a controller or a DbContext leaking into a service, that is a structural violation — refactor it.

The project is built using Visual Studio Template.

---

## 3. Aspire Orchestration

**Project:** `Company.Project.AppHost`

**Responsibility:** Define the local development topology — which projects run, which backing resources (databases, caches, message brokers) they depend on, and how they discover each other. The AppHost is a **development-time orchestrator only**; it is never deployed. Production resource provisioning and deployment are handled by the CI/CD pipeline and Bicep/Terraform templates (see `infra/` and `.pipelines/` in the solution structure).

**References:** All `src/` projects (as project resources), Minimally `client` and `server`
**Must NOT contain:** Business logic, middleware, controllers, or any production runtime code

### 3.1 What Aspire Provides

.NET Aspire adds three capabilities to the development inner loop:

| Capability | Description |
|---|---|
| **Orchestration** | Starts all projects and containers with a single `F5` / `dotnet run` from the AppHost. |
| **Service Discovery** | Projects reference each other by name; Aspire injects connection strings and endpoint URLs at startup. |
| **Dashboard** | A local web UI showing real-time logs, traces, and metrics from all running services via OpenTelemetry. |

### 3.2 AppHost.cs

The AppHost `AppHost.cs` declares the application model — resources and their relationships.

The current baseline repository does **not** include an AppHost project yet. That is intentional for now: the baseline must remain usable for teams that want a simple API + React solution without Aspire.

When a project benefits from local orchestration, add `Company.Project.AppHost` with the following responsibilities only:

- Start the `server` and `client` projects together for local development.
- Declare only development-time backing resources that improve the inner loop, such as SQL Server, PostgreSQL, Redis, or a message broker.
- Pass client build-time environment variables needed by Vite.
- Keep the resource names stable and lowercase so service discovery keys remain predictable.

Do not use AppHost as a substitute for infrastructure templates. Azure resources for shared or deployed environments still belong in `infra/` and the CI/CD pipeline.

> **Naming convention:** Resource names passed to `Add*` methods (e.g. `"sql"`, `"appdb"`, `"server"`) become the keys used for service discovery and connection string injection. Keep them short, lowercase, and stable — changing a name is a breaking change for all referencing projects.

### 3.3 Client Environment Variables

Aspire must pass any required environment variables so they are available at build time. For production builds, environment variables are passed in the build pipeline.

### 3.4 Server Environment Variable

Aspire can pass secrets and environment variables to the server, but our architecture does not depend on it. The Server project must still be able to run outside Aspire so it can be built, tested, and deployed independently.

### 3.5 ServiceDefaults Integration

Every project in the AppHost should call `builder.AddServiceDefaults()` (see Section 15) so that OpenTelemetry telemetry flows into the Aspire Dashboard during local development and into Application Insights / an OTLP collector in production.

### 3.6 Guidelines

- **Do not use the AppHost for resource provisioning.** Aspire can generate Bicep, but Xorbix projects manage infrastructure through the `infra/` directory and the CI/CD pipeline. The AppHost is strictly a dev-time convenience.
- **Do not add business logic or middleware to the AppHost.** It is a composition root for orchestration, not a host for runtime code.
- **Keep resource definitions in sync with infrastructure templates.** If the AppHost declares a Redis cache, the Bicep templates should provision the equivalent Azure Cache for Redis. Drift between local and deployed topology causes environment-specific bugs.
- **Use `WithLifetime(ContainerLifetime.Persistent)` for stateful resources** (databases, message brokers) to avoid data loss on AppHost restarts during development.

---

## 4. Presentation Layer (Api, Server)

**Project:** `Company.Project.Server`

**Responsibility:** Accept HTTP requests, validate input, delegate to services, and return HTTP responses. This layer owns the HTTP contract — status codes, content negotiation, authentication middleware, and route definitions.

**References:** `Services`, `Contracts`, `ServiceDefaults`
**Composition root exception:** The executable host may reference `Infrastructure` for dependency registration at startup.
**Must NOT do:** Controllers, filters, middleware, and other HTTP-facing code must not directly use `DbContext`, repositories, or infrastructure implementation types.

### 4.1 Controller Structure

Controllers are thin. They handle HTTP concerns only and delegate all business logic to service interfaces.

```csharp
namespace Company.Project.Server.Controllers;

//Authenticated Controllers
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PoliciesController(IPolicyService policyService) : AuthenticatedControllerBase
{
    /// <summary>
    /// Retrieves a policy by its unique identifier.
    /// </summary>
    /// <param name="id">The policy identifier.</param>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        Result<PolicyDto> result = await policyService.GetPolicyAsync(id);

        if (result.IsFailed)
            return NotFound(result.Errors.Select(e => e.Message));

        return Ok(result.Value);
    }

    /// <summary>
    /// Creates a new policy.
    /// </summary>
    /// <param name="request">The policy creation request.</param>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePolicyRequest request)
    {
        Result<PolicyDto> result = await policyService.CreatePolicyAsync(request);

        if (result.IsFailed)
            return BadRequest(result.Errors.Select(e => e.Message));

        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }
}

// Unauthenticated Controller
[ApiController]
[Route("api/[controller]")]
public class PoliciesController(IPolicyService policyService) : ControllerBase
{
    /// <summary>
    /// Retrieves a policy by its unique identifier.
    /// </summary>
    /// <param name="id">The policy identifier.</param>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        Result<PolicyDto> result = await policyService.GetPolicyAsync(id);

        if (result.IsFailed)
            return NotFound(result.Errors.Select(e => e.Message));

        return Ok(result.Value);
    }
}

```

### 4.2 Result-to-HTTP Mapping

Controllers map `Result<T>` outcomes to appropriate HTTP status codes using **typed error classes** rather than string matching. Define custom error types in the Contracts layer (see Section 7.6) and use a shared extension method to map them to RFC 9457 ProblemDetails responses.

| Error Type | HTTP Status | When |
|---|---|---|
| (success) | `200 OK` / `202 Accepted` | Successful operation |
| `NotFoundError` | `404 Not Found` | Entity lookup returned nothing |
| `UnauthorizedError` | `401 Unauthorized` | Authentication required or missing |
| `ForbiddenError` | `403 Forbidden` | Authorization check failed |
| `ConflictError` | `409 Conflict` | Duplicate or concurrent edit |
| `GoneError` | `410 Gone` | Resource permanently removed |
| `NotImplementedError` | `501 Not Implemented` | Operation not yet implemented |
| `UpstreamDependencyError` | `502 Bad Gateway` | External service call failed |
| `ValidationError` / `BadRequestError` | `400 Bad Request` | Business rule or validation failure |
| (unmatched error) | `400 Bad Request` | Fallback for unmapped error types |

```csharp
namespace Company.Project.Server.Extensions;

public static class ControllerExtensions
{
    /// <summary>
    /// Maps a FluentResults Result&lt;T&gt; to an ActionResult with RFC 9457 ProblemDetails.
    /// </summary>
    public static ActionResult HandleFluentResult<T>(this ControllerBase controller, Result<T> result)
    {
        return result.IsSuccess
            ? HandleSuccess(controller, result.ToResult(), result.ValueOrDefault)
            : HandleErrors(controller, result.ToResult());
    }

    /// <summary>
    /// Maps a FluentResults Result (no value) to an ActionResult with RFC 9457 ProblemDetails.
    /// </summary>
    public static ActionResult HandleFluentResult(this ControllerBase controller, Result result)
    {
        return result.IsSuccess
            ? HandleSuccess(controller, result)
            : HandleErrors(controller, result);
    }

    private static ActionResult HandleSuccess(ControllerBase controller, Result result, object? value = null)
    {
        if (result.Successes.Any(s => s is AcceptedSuccess))
            return controller.Accepted(value);

        return controller.Ok(value);
    }

    private static ActionResult HandleErrors(ControllerBase controller, Result result)
    {
        (int statusCode, string type, string title) = MapErrorToStatus(result);

        List<string> errorMessages = result.Errors
            .Select(e => e.Message)
            .ToList();

        ProblemDetails problem = new()
        {
            Status = statusCode,
            Type = type,
            Title = title,
            Detail = string.Join(" ", errorMessages),
            Instance = $"{controller.HttpContext.Request.Method} {controller.HttpContext.Request.Path}",
        };

        problem.Extensions["traceId"] = controller.HttpContext.TraceIdentifier;
        problem.Extensions["errors"] = errorMessages;

        return new ObjectResult(problem) { StatusCode = statusCode };
    }

    /// <summary>
    /// Maps FluentResults typed errors to HTTP status codes and RFC 9110 type URIs.
    /// Uses <c>result.HasError&lt;T&gt;()</c> to check by type rather than pattern matching
    /// a single error — this correctly handles results that contain multiple errors.
    /// </summary>
    private static (int StatusCode, string Type, string Title) MapErrorToStatus(Result result)
    {
        if (result.HasError<NotFoundError>())
            return (StatusCodes.Status404NotFound,
                "https://tools.ietf.org/html/rfc9110#section-15.5.5",
                "Not Found");

        if (result.HasError<UnauthorizedError>())
            return (StatusCodes.Status401Unauthorized,
                "https://tools.ietf.org/html/rfc9110#section-15.5.2",
                "Unauthorized");

        if (result.HasError<ForbiddenError>())
            return (StatusCodes.Status403Forbidden,
                "https://tools.ietf.org/html/rfc9110#section-15.5.4",
                "Forbidden");

        if (result.HasError<ConflictError>())
            return (StatusCodes.Status409Conflict,
                "https://tools.ietf.org/html/rfc9110#section-15.5.10",
                "Conflict");

        if (result.HasError<GoneError>())
            return (StatusCodes.Status410Gone,
                "https://tools.ietf.org/html/rfc9110#section-15.5.11",
                "Gone");

        if (result.HasError<NotImplementedError>())
            return (StatusCodes.Status501NotImplemented,
                "https://tools.ietf.org/html/rfc9110#section-15.6.2",
                "Not Implemented");

        if (result.HasError<UpstreamDependencyError>())
            return (StatusCodes.Status502BadGateway,
                "https://tools.ietf.org/html/rfc9110#section-15.6.3",
                "Bad Gateway");

        if (result.HasError<ValidationError>() || result.HasError<BadRequestError>())
            return (StatusCodes.Status400BadRequest,
                "https://tools.ietf.org/html/rfc9110#section-15.5.1",
                "Bad Request");

        // Unmapped error types default to 400 Bad Request
        return (StatusCodes.Status400BadRequest,
            "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            "Bad Request");
    }
}
```

Controller usage:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<PolicyDto>> Get(int id)
{
    Result<PolicyDto> result = await policyService.GetPolicyAsync(id);
    return this.HandleFluentResult(result);
}
```

`HandleFluentResult` returns the non-generic `ActionResult`, yet the action declares `Task<ActionResult<PolicyDto>>`. The implicit `ActionResult` → `ActionResult<T>` conversion makes this compile, and ApiExplorer reads the 200 body type from the declared `T` — not from the returned object. So declare `Task<ActionResult<T>>` whenever the action returns a body and `Task<ActionResult>` when it does not. Keep `HandleFluentResult` returning the non-generic `ActionResult`: its error paths emit a `ProblemDetails` `ObjectResult` that would not fit an `ActionResult<T>` of the success DTO. Non-200 outcomes are documented with `[ProducesResponseType(StatusCodes.Status404NotFound)]` (etc.), since the signature cannot express them.

### 4.3 Middleware Pipeline

The standard middleware order in `Program.cs`. Note: `LogContextMiddleware` runs after authentication so that user identity is available for log enrichment (see Section 8.1).

```csharp
WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Per-layer service registration (see Section 11)
builder.Services.AddDataServices(builder.Configuration);
builder.Services.AddBusinessServices();
builder.Services.AddApiServices(builder.Configuration);

WebApplication app = builder.Build();

// Middleware pipeline — order matters
app.UseExceptionHandler();           // IExceptionHandler (see Section 4.4)
app.UseHttpsRedirection();
app.UseCors("DefaultPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<LogContextMiddleware>();  // Enriches logs with UserId/Jti
app.MapControllers();

app.Run();
```

### 4.4 Global Error Handling

Unhandled exceptions (the truly unexpected kind — not business failures) are caught by `IExceptionHandler` (.NET 8+) and returned as RFC 9457 ProblemDetails. Services should never throw for expected failures; those use `Result<T>`.

Register the handler and enable ProblemDetails in DI:

```csharp
// Program.cs — service registration
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
```

```csharp
namespace Company.Project.Server.Middleware;

public class GlobalExceptionHandler(
    IHostEnvironment env,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    /// <summary>
    /// Maps known exception types to HTTP status codes, RFC 9110 type URIs, and titles.
    /// Add project-specific exceptions (e.g., custom DbConcurrencyException) as needed.
    /// </summary>
    private static readonly Dictionary<Type, (int StatusCode, string Type, string Title)> ExceptionMap = new()
    {
        [typeof(UnauthorizedAccessException)] = (
            StatusCodes.Status401Unauthorized,
            "https://tools.ietf.org/html/rfc9110#section-15.5.2",
            "Unauthorized"),

        [typeof(KeyNotFoundException)] = (
            StatusCodes.Status404NotFound,
            "https://tools.ietf.org/html/rfc9110#section-15.5.5",
            "Not Found"),

        [typeof(NotImplementedException)] = (
            StatusCodes.Status501NotImplemented,
            "https://tools.ietf.org/html/rfc9110#section-15.6.2",
            "Not Implemented"),

        [typeof(InvalidOperationException)] = (
            StatusCodes.Status409Conflict,
            "https://tools.ietf.org/html/rfc9110#section-15.5.10",
            "Conflict"),

        [typeof(ArgumentException)] = (
            StatusCodes.Status400BadRequest,
            "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            "Bad Request"),

        [typeof(ArgumentNullException)] = (
            StatusCodes.Status400BadRequest,
            "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            "Bad Request"),

        [typeof(OperationCanceledException)] = (
            StatusCodes.Status499ClientClosedRequest,
            "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            "Client Closed Request"),

        [typeof(TaskCanceledException)] = (
            StatusCodes.Status499ClientClosedRequest,
            "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            "Client Closed Request"),
    };

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        (int statusCode, string type, string title) = ExceptionMap.TryGetValue(
            exception.GetType(), out var mapped)
            ? mapped
            : (StatusCodes.Status500InternalServerError,
               "https://tools.ietf.org/html/rfc9110#section-15.6.1",
               "Internal Server Error");

        // Client cancellations are informational, not errors
        if (statusCode == StatusCodes.Status499ClientClosedRequest)
        {
            logger.LogInformation("Request cancelled by client: {Path}", httpContext.Request.Path);
        }
        else
        {
            logger.LogError(exception, "Unhandled exception on {Method} {Path}",
                httpContext.Request.Method, httpContext.Request.Path);
        }

        // Record on the current OpenTelemetry Activity for distributed tracing
        Activity.Current?.AddException(exception);
        Activity.Current?.SetStatus(ActivityStatusCode.Error, exception.Message);

        ProblemDetails problem = new()
        {
            Status = statusCode,
            Type = type,
            Title = title,
            Detail = exception.Message,
            Instance = $"{httpContext.Request.Method} {httpContext.Request.Path}",
        };

        problem.Extensions["traceId"] = httpContext.TraceIdentifier;

        if (exception.InnerException is not null)
        {
            problem.Extensions["innerException"] = exception.InnerException.Message;
        }

        // Stack traces only in non-production environments
        if (env.IsDevelopment() || env.IsStaging())
        {
            problem.Extensions["stackTrace"] = exception.StackTrace;
        }

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
```

### 4.5 Validation

Validation is layered. Use the cheapest tool that expresses each rule, and never write the same rule twice.

| Layer | Tool | Use for |
|---|---|---|
| Request shape | Data Annotations on the request model | Basic, self-contained checks: `[Required]`, `[MaxLength]`, `[Range]`, `[EmailAddress]`, `[RegularExpression]`. Enforced automatically by `[ApiController]` at model binding. |
| Complex request rules | FluentValidation validator in the API project | Anything Data Annotations cannot express: cross-field rules, conditional rules, collection rules, or checks that need formatting/computation. |
| Business rules | Service layer, typed errors | Rules needing the database or domain state (uniqueness, existence, state transitions). Returned as `Result<T>` typed errors (see Section 5). |

Add Data Annotations to request models first — they cover the common null/length/range/format cases declaratively and require no extra wiring. Reach for **FluentValidation only when a request rule is too complex for a Data Annotation**. Validators live in the API project since they validate HTTP request shapes, not domain rules. Do not mirror a Data Annotation rule inside a validator.

```
Api/
└── Validators/
    ├── CreatePolicyRequestValidator.cs
    └── UpdatePolicyRequestValidator.cs
```

```csharp
namespace Company.Project.Server.Validators;

// Only complex, cross-field/conditional rules live here. Basic null/length/format
// checks stay as Data Annotations on the request model (see Section 7.3).
public class CreatePolicyRequestValidator : AbstractValidator<CreatePolicyRequest>
{
    public CreatePolicyRequestValidator()
    {
        RuleFor(x => x.EffectiveDate)
            .GreaterThan(DateTime.UtcNow)
            .WithMessage("Effective date must be in the future.");
    }
}
```

#### Option: Automatic FluentValidation via Action Filter

Instead of injecting validators manually in each action, register a global `IAsyncActionFilter` that resolves and executes FluentValidation validators for every action parameter automatically. This runs alongside the built-in Data Annotation validation from `[ApiController]`.

```csharp
// Program.cs — registration
builder.Services.AddControllers(options =>
{
    options.Filters.Add<FluentValidationFilter>();
});
```

```csharp
namespace Company.Project.Server.Filters;

/// <summary>
/// Action filter that automatically runs FluentValidation validators for action parameters.
/// If a validator is registered in DI for a parameter type, it is executed before the action runs.
/// On failure, returns a 400 ValidationProblemDetails response consistent with the built-in format.
/// </summary>
public sealed class FluentValidationFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        IServiceProvider serviceProvider = context.HttpContext.RequestServices;

        foreach ((string _, object? value) in context.ActionArguments)
        {
            if (value is null)
                continue;

            Type valueType = value.GetType();
            Type validatorType = typeof(IValidator<>).MakeGenericType(valueType);

            if (serviceProvider.GetService(validatorType) is not IValidator validator)
                continue;

            ValidationContext<object> validationContext = new(value);
            ValidationResult result = await validator.ValidateAsync(
                validationContext, context.HttpContext.RequestAborted);

            if (result.IsValid)
                continue;

            foreach (ValidationFailure error in result.Errors)
            {
                context.ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            }

            context.Result = new BadRequestObjectResult(
                new ValidationProblemDetails(context.ModelState)
                {
                    Status = StatusCodes.Status400BadRequest,
                });
            return;
        }

        await next();
    }
}
```

When using this filter, validators registered via `AddValidatorsFromAssemblyContaining<T>()` are resolved automatically — no manual `IValidator<T>` injection in controllers is needed.


### 4.6 Authenticated Controller Base Class

Controllers that require an authenticated user extend a base class that provides lazy-cached access to common JWT claims. This avoids repetitive `User.FindFirst(...)` calls and keeps controllers clean.

```csharp
namespace Company.Project.Server.Controllers;

[Authorize]
[ApiController]
public abstract class AuthenticatedControllerBase : ControllerBase
{
    private Guid? _userId;
    private bool _userIdResolved;

    private Guid? _tenantId;
    private bool _tenantIdResolved;

    /// <summary>
    /// The authenticated user's ID extracted from the JWT 'sub' or 'nameidentifier' claim.
    /// Returns null if the claim is missing or malformed.
    /// </summary>
    protected Guid? AuthenticatedUserId
    {
        get
        {
            if (!_userIdResolved)
            {
                string? sub = User.FindFirstValue(ClaimTypes.NameIdentifier);
                _userId = Guid.TryParse(sub, out Guid parsed) ? parsed : null;
                _userIdResolved = true;
            }
            return _userId;
        }
    }

    /// <summary>
    /// The tenant ID from the JWT 'tenant_id' claim (for multi-tenant apps).
    /// </summary>
    protected Guid? AuthenticatedTenantId
    {
        get
        {
            if (!_tenantIdResolved)
            {
                string? tid = User.FindFirstValue("tenant_id");
                _tenantId = Guid.TryParse(tid, out Guid parsed) ? parsed : null;
                _tenantIdResolved = true;
            }
            return _tenantId;
        }
    }
}
```

Controller usage:

```csharp
[Route("api/[controller]")]
public class PolicyController(IPolicyService policyService)
    : AuthenticatedControllerBase
{
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PolicyDto>> Get(int id)
    {
        // AuthenticatedUserId is available without manual claim extraction
        Result<PolicyDto> result = await policyService.GetPolicyAsync(id, AuthenticatedUserId!.Value);
        return this.HandleFluentResult(result);
    }
}
```

---

## 5. Service Layer (Business Logic)

**Project:** `Company.Project.Services`

**Responsibility:** All business logic, domain rules, orchestration, and workflow. Services are the core of the application — everything meaningful happens here.

**References:** `Data` (via repository interfaces), `Contracts`  
**Must NOT reference:** `Api`

### 5.1 Service Structure

Every service consists of an interface and an implementation. Interfaces are defined in the Services project (not in Contracts) because they represent business operations, not shared data shapes. Whether they sit in an `Interfaces/` subfolder or directly alongside their implementations can vary with project size — use subfolders only when the flat layout becomes hard to navigate.

```
Services/
├── Interfaces/              # Optional — flat layout (interfaces beside implementations) is fine for smaller projects
│   ├── IPolicyService.cs
│   └── IUserService.cs
├── PolicyService.cs
└── UserService.cs
```

### 5.2 Service Implementation Pattern

Services return **typed errors** (see Section 7.6) rather than plain failure strings. This gives the controller extension (Section 4.2) the information it needs to select the correct HTTP status code automatically. A plain `Result.Fail("...")` string still works, but an untyped error falls through to the default `400 Bad Request` mapping — reach for a typed error whenever you need to control the status code returned to the user or let the caller fork business logic on the failure type.

```csharp
namespace Company.Project.Services;

/// <inheritdoc/>
public class PolicyService(
    IPolicyRepository policyRepository,
    ILogger<PolicyService> logger) : IPolicyService
{
    /// <inheritdoc/>
    public async Task<Result<PolicyDto>> GetPolicyAsync(int id)
    {
        Policy? policy = await policyRepository.GetByIdAsync(id);

        if (policy is null)
        {
            logger.LogWarning("Policy {PolicyId} not found", id);
            return Result.Fail(new NotFoundError($"Policy {id} not found"));
        }

        PolicyDto dto = policy.ToDto();
        return Result.Ok(dto);
    }

    /// <inheritdoc/>
    public async Task<Result<PolicyDto>> CreatePolicyAsync(CreatePolicyRequest request)
    {
        // Business rule validation — typed error drives 409 Conflict response
        bool nameExists = await policyRepository.ExistsByNameAsync(request.Name);
        if (nameExists)
            return Result.Fail(new ConflictError($"A policy named '{request.Name}' already exists"));

        Policy entity = request.ToEntity();
        await policyRepository.CreateAsync(entity);

        PolicyDto dto = entity.ToDto();
        return Result.Ok(dto);
    }
}
```

### 5.3 Service Interface Pattern

Full XML documentation goes on the interface. Implementations use `<inheritdoc/>`.

```csharp
namespace Company.Project.Services.Interfaces;

/// <summary>
/// Manages policy lifecycle operations.
/// </summary>
public interface IPolicyService
{
    /// <summary>
    /// Retrieves a policy by its unique identifier.
    /// </summary>
    /// <param name="id">The policy identifier.</param>
    /// <returns>
    /// A result containing the policy DTO if found,
    /// or a failure result if the policy does not exist.
    /// </returns>
    Task<Result<PolicyDto>> GetPolicyAsync(int id);

    /// <summary>
    /// Creates a new policy.
    /// </summary>
    /// <param name="request">The policy creation request.</param>
    /// <returns>
    /// A result containing the created policy DTO,
    /// or a failure result if a business rule was violated.
    /// </returns>
    Task<Result<PolicyDto>> CreatePolicyAsync(CreatePolicyRequest request);
}
```

### 5.4 Mapping

Use extension methods in a `Mapping/` folder in the **Contracts** project for entity-to-DTO and request-to-entity conversions. Mapping lives in Contracts — alongside the entities, DTOs, and requests it converts between — so both sides of every mapping sit in one project and any layer that can see a DTO can also map to it. This is the one deliberate exception to the "Contracts holds no logic" rule (Section 7); mapping extensions are the only logic Contracts carries. Keep mappings simple and explicit — avoid AutoMapper unless the project has a large number of straightforward mappings that justify the dependency.

```csharp
namespace Company.Project.Contracts.Mapping;

public static class PolicyMappingExtensions
{
    public static PolicyDto ToDto(this Policy entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        EffectiveDate = entity.EffectiveDate,
        Status = entity.Status
    };

    public static Policy ToEntity(this CreatePolicyRequest request) => new()
    {
        Name = request.Name,
        EffectiveDate = request.EffectiveDate,
        Status = PolicyStatus.Draft
    };
}
```

### 5.5 Transaction Scope

When a service operation needs to span multiple repository calls atomically, use `TransactionScope` — this avoids requiring direct `DbContext` access in the service layer.

```csharp
public async Task<Result> TransferPolicyAsync(int policyId, int newOwnerId)
{
    using TransactionScope transaction = new(
        asyncFlowOption: TransactionScopeAsyncFlowOption.Enabled);

    Policy? policy = await _policyRepository.GetByIdAsync(policyId);
    if (policy is null)
        return Result.Fail($"Policy {policyId} not found");

    policy.OwnerId = newOwnerId;
    await _policyRepository.UpdateAsync(policy);
    await _auditRepository.LogTransferAsync(policyId, newOwnerId);

    transaction.Complete();
    return Result.Ok();
}
```

### 5.6 Current User Service

Extract authenticated-user access into a dedicated service interface so that business logic never touches `HttpContext` or `ClaimsPrincipal` directly. This keeps the Service layer testable and decoupled from ASP.NET Core.

**Interface** — lives in the Services (or Application) layer alongside other service contracts:

```csharp
namespace Company.Project.Services.Interfaces;

/// <summary>
/// Provides access to the authenticated user's identity without coupling to HttpContext.
/// </summary>
public interface ICurrentUserService
{
    /// <summary>
    /// Gets the identity-provider object ID of the current user (e.g. Entra oid claim).
    /// </summary>
    /// <exception cref="InvalidOperationException">User is not authenticated or claim is missing.</exception>
    string GetIdentityProviderId();

    /// <summary>
    /// Gets the application-specific user ID by querying the database for the identity-provider ID.
    /// </summary>
    Task<int> GetUserIdAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the email address of the current user, if available in claims.
    /// </summary>
    string? GetUserEmail();
}
```

**Implementation** — lives in the API project (or Services layer if `IHttpContextAccessor` is referenced):

```csharp
namespace Company.Project.Server.Services;

public sealed class CurrentUserService(
    IHttpContextAccessor httpContextAccessor,
    IUserRepository userRepository) : ICurrentUserService
{
    /// <inheritdoc/>
    public string GetIdentityProviderId()
    {
        ClaimsPrincipal? user = httpContextAccessor.HttpContext?.User;

        if (user is null || user.Identity?.IsAuthenticated != true)
            throw new InvalidOperationException("User is not authenticated.");

        string? objectId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrWhiteSpace(objectId))
            throw new InvalidOperationException("Identity provider ID claim is missing.");

        return objectId;
    }

    /// <inheritdoc/>
    public async Task<int> GetUserIdAsync(CancellationToken cancellationToken = default)
    {
        string identityId = GetIdentityProviderId();

        User? user = await userRepository.FindByIdentityIdAsync(identityId, cancellationToken);

        if (user is null)
            throw new InvalidOperationException(
                $"User with identity ID '{identityId}' not found in database.");

        return user.Id;
    }

    /// <inheritdoc/>
    public string? GetUserEmail()
    {
        ClaimsPrincipal? user = httpContextAccessor.HttpContext?.User;
        return user?.FindFirst(ClaimTypes.Email)?.Value
            ?? user?.FindFirst("preferred_username")?.Value;
    }
}
```

**Registration** — scoped to match the per-request HTTP context lifetime:

```csharp
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
```

Services that need the calling user inject `ICurrentUserService` rather than `IHttpContextAccessor`:

```csharp
public class AuditService(ICurrentUserService currentUser, IAuditRepository auditRepository)
{
    public async Task LogActionAsync(string action, CancellationToken ct)
    {
        int userId = await currentUser.GetUserIdAsync(ct);
        await auditRepository.CreateAsync(new AuditLog { UserId = userId, Action = action }, ct);
    }
}
```

---

## 6. Data Access Layer

**Project:** `Company.Project.Infrastructure`

**Responsibility:** EF Core DbContext, repository implementations, entity configurations, and database migrations. This layer is the only layer that knows about the database. Entities themselves live in the Contracts project (see Section 7) — Infrastructure owns their *configuration* and persistence, not their definition.

**References:** `Contracts` (for shared types used in entities, if any)  
**Must NOT reference:** `Api`, `Services`

### 6.1 Project Structure

```
Infrastructure/
├── Context/
│   └── ApplicationDbContext.cs
├── Configurations/                   # Entities live in Contracts; only their EF configuration lives here
│   ├── PolicyConfiguration.cs
│   ├── UserConfiguration.cs
│   └── AuditLogConfiguration.cs
├── Repositories/
│   ├── Interfaces/                   # Optional subfolder — flat layout is fine for smaller projects
│   │   ├── IRepository.cs            # Generic base
│   │   ├── IPolicyRepository.cs
│   │   └── IUserRepository.cs
│   ├── Repository.cs                 # Generic base implementation
│   ├── PolicyRepository.cs
│   └── UserRepository.cs
└── Migrations/
    └── (EF Core generated migrations)
```

### 6.2 Entity Definitions

Entities live in the **Contracts** project (so DTOs and mapping extensions share one project with them), are singular, represent a single database table, and use explicit property types. Apply Data Annotations for the basic shape (`[Key]`, `[Required]`, `[MaxLength]`, `[Column]`) so the entity is self-documenting and tooling can read the contract. The Fluent `IEntityTypeConfiguration<T>` (Section 6.3), which lives in Infrastructure, remains the source of truth for anything annotations cannot express — relationships, delete behavior, query filters, value conversions — and must not duplicate a rule already declared by an annotation. Navigation properties are configured deliberately.

```csharp
namespace Company.Project.Contracts.Entities;

public class Policy
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public required string Name { get; set; }

    public DateTime EffectiveDate { get; set; }
    public PolicyStatus Status { get; set; }
    public int OwnerId { get; set; }

    // Navigation properties
    public User Owner { get; set; } = null!;
    public ICollection<PolicyDocument> Documents { get; set; } = [];
}
```

### 6.3 Entity Configuration

Use `IEntityTypeConfiguration<T>` for all entity configurations. Keep configurations separate from the DbContext to maintain single responsibility per file. Use constants from the Contracts layer for table names and schema names (see Section 7.5) to avoid magic strings.

```csharp
namespace Company.Project.Infrastructure.Configurations;

public class PolicyConfiguration : IEntityTypeConfiguration<Policy>
{
    public void Configure(EntityTypeBuilder<Policy> builder)
    {
        // Table name from a constant — no magic strings. Pass a SchemaNames
        // value as the second argument only for non-default schemas
        // (e.g. builder.ToTable(TableNames.Users, SchemaNames.Iam)); omit it
        // for the provider's default schema.
        builder.ToTable(TableNames.Policies);

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(p => p.Status)
            .HasConversion<string>();

        builder.HasOne(p => p.Owner)
            .WithMany(u => u.Policies)
            .HasForeignKey(p => p.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
```

### 6.4 DbContext

The DbContext registers entity configurations, defines DbSets, and applies global conventions. It does not contain business logic or query methods — those belong in repositories.

```csharp
namespace Company.Project.Infrastructure.Context;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : DbContext(options)
{
    public DbSet<Policy> Policies => Set<Policy>();
    public DbSet<User> Users => Set<User>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ApplicationDbContext).Assembly);
    }

    /// <summary>
    /// Applies global conventions to all entities — decimal precision and UTC normalization.
    /// </summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Standardize decimal precision across all entities
        configurationBuilder.Properties<decimal>()
            .HavePrecision(18, 2);

        // Ensure all DateTime values are stored and read as UTC
        configurationBuilder.Properties<DateTime>()
            .HaveConversion<DateTimeUtcConverter>();

        configurationBuilder.Properties<DateTime?>()
            .HaveConversion<DateTimeUtcConverter>();
    }
}
```

#### DateTime UTC Converter

EF Core does not enforce `DateTimeKind` on values read from the database. This converter ensures every `DateTime` is tagged as UTC on read and normalized to UTC on write, preventing subtle timezone bugs.

```csharp
public class DateTimeUtcConverter()
    : ValueConverter<DateTime, DateTime>(
        v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
```

### 6.5 Generic Repository

A generic base repository provides standard CRUD and query operations. Named repositories extend it with domain-specific queries.

**Design conventions:**

- Read operations (`FindManyAsync`, `GetAllAsync`) use `AsNoTracking()` for better performance.
- All async methods accept `CancellationToken` so callers can propagate request cancellation.
- Batch methods (`AddManyAsync`, `UpdateManyAsync`, `DeleteManyAsync`) avoid multiple `SaveChangesAsync` round-trips.
- Queries use `Expression<Func<T, bool>>` predicates instead of exposing `IQueryable<T>`.
- List returns use `IReadOnlyList<T>` to signal that results are materialized and immutable.

```csharp
namespace Company.Project.Infrastructure.Repositories.Interfaces;

/// <summary>
/// Generic repository contract for common entity operations.
/// All mutating methods persist changes immediately.
/// </summary>
/// <typeparam name="T">The entity type.</typeparam>
public interface IRepository<T> where T : class
{
    Task<T?> FindOneAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<T>> FindManyAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<T>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default);

    Task<int> CountAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default);

    Task AddAsync(T entity, CancellationToken cancellationToken = default);
    Task AddManyAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);
    Task UpdateAsync(T entity, CancellationToken cancellationToken = default);
    Task UpdateManyAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);
    Task DeleteAsync(T entity, CancellationToken cancellationToken = default);
    Task DeleteManyAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);
}
```

```csharp
namespace Company.Project.Infrastructure.Repositories;

/// <inheritdoc/>
public class Repository<T>(ApplicationDbContext context)
    : IRepository<T> where T : class
{
    protected readonly ApplicationDbContext Context = context;
    protected readonly DbSet<T> DbSet = context.Set<T>();

    /// <inheritdoc/>
    public async Task<T?> FindOneAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default)
    {
        return await DbSet.FirstOrDefaultAsync(predicate, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<T>> FindManyAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default)
    {
        return await DbSet
            .AsNoTracking()
            .Where(predicate)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<T>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await DbSet
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> ExistsAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default)
    {
        return await DbSet.AnyAsync(predicate, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> CountAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default)
    {
        return await DbSet.CountAsync(predicate, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task AddAsync(T entity, CancellationToken cancellationToken = default)
    {
        await DbSet.AddAsync(entity, cancellationToken);
        await Context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task AddManyAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
    {
        await DbSet.AddRangeAsync(entities, cancellationToken);
        await Context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task UpdateAsync(T entity, CancellationToken cancellationToken = default)
    {
        DbSet.Update(entity);
        await Context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task UpdateManyAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
    {
        DbSet.UpdateRange(entities);
        await Context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task DeleteAsync(T entity, CancellationToken cancellationToken = default)
    {
        DbSet.Remove(entity);
        await Context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task DeleteManyAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
    {
        DbSet.RemoveRange(entities);
        await Context.SaveChangesAsync(cancellationToken);
    }
}
```

### 6.6 Named Repository

```csharp
namespace Company.Project.Infrastructure.Repositories.Interfaces;

/// <summary>
/// Repository for policy-specific data access operations.
/// </summary>
public interface IPolicyRepository : IRepository<Policy>
{
    /// <summary>
    /// Checks whether a policy with the given name already exists.
    /// </summary>
    Task<bool> ExistsByNameAsync(string name);

    /// <summary>
    /// Retrieves all policies owned by a specific user, including documents.
    /// </summary>
    Task<List<Policy>> GetByOwnerAsync(int ownerId);
}
```

```csharp
namespace Company.Project.Infrastructure.Repositories;

/// <inheritdoc/>
public class PolicyRepository(ApplicationDbContext context)
    : Repository<Policy>(context), IPolicyRepository
{
    /// <inheritdoc/>
    public async Task<bool> ExistsByNameAsync(string name)
    {
        return await DbSet.AnyAsync(p => p.Name == name);
    }

    /// <inheritdoc/>
    public async Task<List<Policy>> GetByOwnerAsync(int ownerId)
    {
        return await DbSet
            .Where(p => p.OwnerId == ownerId)
            .Include(p => p.Documents)
            .ToListAsync();
    }
}
```

### 6.7 Migrations

All schema changes go through EF Core migrations. Never modify a shared database directly. Review generated migrations before applying them, and confirm with the team lead before creating migrations that affect shared environments.

```bash
# Generate a new migration
dotnet ef migrations add AddPolicyExpirationDate --project src/Company.Project.Infrastructure

# Apply to local database
dotnet ef database update --project src/Company.Project.Infrastructure
```

### 6.8 Soft Delete Pattern

Entities that should be logically deleted (not physically removed) use a nullable `DeletedOn` timestamp. A null value means the record is active. Soft-deleted records are filtered out by default.

There are two ways to apply that filter, and the choice is flexible per entity:

- **Inline in the repository** (shown below) — each read query adds `.Where(p => p.DeletedOn == null)`. Explicit and easy to bypass when you genuinely need deleted rows. This is the default choice.
- **Global query filter** — `builder.HasQueryFilter(p => p.DeletedOn == null)` in the entity configuration. Convenient, but use it sparingly: EF Core allows only **one** query filter per entity (so it competes with multi-tenancy or other filters), and reading soft-deleted rows then requires an explicit `IgnoreQueryFilters()` on the query. Prefer it only when nearly every query should exclude deleted rows and no other global filter is needed on the entity.

```csharp
// Entity property
public DateTime? DeletedOn { get; set; }

// Repository query — always exclude deleted records
public async Task<List<Policy>> GetAllActiveAsync()
{
    return await DbSet
        .Where(p => p.DeletedOn == null)
        .ToListAsync();
}

// Soft-delete operation (in service layer)
public async Task<Result> SoftDeletePolicyAsync(int id)
{
    Policy? policy = await policyRepository.GetByIdAsync(id);
    if (policy is null)
        return Result.Fail(new NotFoundError($"Policy {id} not found"));

    policy.DeletedOn = DateTime.UtcNow;
    await policyRepository.UpdateAsync(policy);
    return Result.Ok();
}
```

---

## 7. Contracts Layer (Shared Types)

**Project:** `Company.Project.Contracts`

**Responsibility:** entities, DTOs, request/response models, enumerations, constants, mapping extensions, and any types shared across layers. With the single exception of mapping extensions (Section 5.4), this project holds no business logic — only type definitions and the conversions between them. Entities live here (rather than in Infrastructure) so that entities, DTOs, and the mapping extensions between them all sit in one project.

**References:** None (this is a leaf dependency)  
**Referenced by:** All other projects

### 7.1 Project Structure

```
Contracts/
├── Entities/
│   ├── Policy.cs
│   ├── User.cs
│   └── AuditLog.cs
├── DTOs/
│   ├── PolicyDto.cs
│   └── UserDto.cs
├── Mapping/
│   └── PolicyMappingExtensions.cs
├── Requests/
│   ├── CreatePolicyRequest.cs
│   └── UpdatePolicyRequest.cs
├── Responses/
│   └── PagedResponse.cs
├── Enums/
│   └── PolicyStatus.cs
├── Constants/
│   └── AppConstants.cs
└── FluentErrors/
    └── FluentErrors.cs
```

### 7.2 DTO Pattern

DTOs are simple data carriers. They use explicit types, no logic, and property names that match the API contract the React frontend will consume. Response DTOs flow outward and need no validation attributes; Data Annotations belong on the *request* models that accept inbound data (Section 7.3).

```csharp
namespace Company.Project.Contracts.DTOs;

public class PolicyDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime EffectiveDate { get; set; }
    public PolicyStatus Status { get; set; }
    public int OwnerId { get; set; }
    public string OwnerName { get; set; } = string.Empty;
}
```

### 7.3 Request Models

Request models carry Data Annotations for the basic, declarative checks — null/required, length, range, and format — so `[ApiController]` rejects malformed input at model binding before the action runs. Complex or cross-field rules belong in a FluentValidation validator (Section 4.5), not here.

```csharp
namespace Company.Project.Contracts.Requests;

public class CreatePolicyRequest
{
    [Required]
    [MaxLength(200)]
    public required string Name { get; set; }

    [Required]
    public DateTime EffectiveDate { get; set; }
}
```

### 7.4 Paged Response

A standard wrapper for paginated list endpoints, shared across all entities that support paging.

```csharp
namespace Company.Project.Contracts.Responses;

public class PagedResponse<T>
{
    public List<T> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;
}
```

### 7.5 Enums and Constants

```csharp
namespace Company.Project.Contracts.Enums;

public enum PolicyStatus
{
    Draft,
    Active,
    Expired,
    Cancelled
}
```

```csharp
namespace Company.Project.Contracts.Constants;

public static class AppConstants
{
    public const int DefaultPageSize = 25;
    public const int MaxPageSize = 100;
    public const string AdministratorRole = "Administrator";
}
```

#### Table and Schema Name Constants

Centralize table and schema names as constants to avoid magic strings in entity configurations and migrations. Entity configurations reference these constants (see Section 6.3).

```csharp
namespace Company.Project.Contracts.Constants;

/// <summary>
/// Database table names. Entities are singular; tables are plural.
/// </summary>
public static class TableNames
{
    public const string Policies = "Policies";
    public const string Users = "Users";
    public const string AuditLogs = "AuditLogs";
}

/// <summary>
/// Database schema names for logical grouping of tables.
/// </summary>
public static class SchemaNames
{
    public const string Dbo = "dbo";
    public const string Iam = "iam";
}
```

### 7.6 Typed FluentResults Errors

Define typed error classes (extending FluentResults `Error`) in the Contracts layer. These types drive the `HandleFluentResult` mapping in Section 4.2 — each error class maps to a specific HTTP status code without string matching.

```csharp
namespace Company.Project.Contracts.FluentErrors;

public class NotFoundError(string message)     : Error(message);
public class BadRequestError(string message)   : Error(message);
public class ForbiddenError(string message)    : Error(message);
public class ConflictError(string message)     : Error(message);
public class GoneError(string message)         : Error(message);
public class ValidationError(string message)   : Error(message);
public class UnauthorizedError(string message) : Error(message);
public class NotImplementedError(string message) : Error(message);
public class UpstreamDependencyError(string message) : Error(message);

/// <summary>
/// Returned as a Success (not Error) to signal the controller should return 202 Accepted.
/// </summary>
public class AcceptedSuccess() : Success("Accepted");
```

Service usage:

```csharp
// In a service method — typed errors instead of plain strings
public async Task<Result<PolicyDto>> GetPolicyAsync(int id)
{
    Policy? policy = await policyRepository.GetByIdAsync(id);
    if (policy is null)
        return Result.Fail(new NotFoundError($"Policy {id} not found"));

    PolicyDto dto = policy.ToDto();
    return Result.Ok(dto);
}
```

---

## 8. Cross-Cutting Concerns

Cross-cutting concerns — logging, authentication, error handling, and CORS — live in the API project as middleware, filters, or extension methods. They do not belong in the Service or Data layers.

### 8.1 Logging

Inject `ILogger<T>` via constructor injection in every class that needs logging. Use structured logging with message templates, not string interpolation.

```csharp
// Correct — structured logging
logger.LogWarning("Policy {PolicyId} not found for user {UserId}", id, userId);

// Incorrect — string interpolation (defeats structured logging)
logger.LogWarning($"Policy {id} not found for user {userId}");
```

#### Log Context Enrichment Middleware

To automatically include the authenticated user’s identity in every log entry, add a middleware that runs **after** authentication and enriches the log scope with JWT claims.

```csharp
namespace Company.Project.Server.Middleware;

public class LogContextMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ILogger<LogContextMiddleware> logger)
    {
        Dictionary<string, object> logContext = [];

        if (context.User.Identity?.IsAuthenticated == true)
        {
            string? userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            string? jti = context.User.FindFirstValue(JwtRegisteredClaimNames.Jti);

            if (userId is not null) logContext["UserId"] = userId;
            if (jti is not null) logContext["Jti"] = jti;
        }

        using (logger.BeginScope(logContext))
        {
            await next(context);
        }
    }
}
```

Every log message emitted downstream will include `UserId` and `Jti` without explicit passing. Register in the middleware pipeline after `UseAuthorization()` (see Section 4.3).

### 8.2 Authentication and Authorization

JWT authentication is configured in the API project's middleware pipeline. Authorization policies are applied at the controller or action level using `[Authorize]` attributes and policy-based authorization.

```csharp
// Program.cs — registration
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Auth:Authority"];
        options.Audience = builder.Configuration["Auth:Audience"];
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole(AppConstants.AdministratorRole));
});
```

```csharp
// Controller usage
[Authorize(Policy = "AdminOnly")]
[HttpDelete("{id:int}")]
public async Task<IActionResult> Delete(int id) { ... }
```

### 8.3 CORS

CORS policy is defined in the API project and configured per environment. Development may allow broader origins; production is locked down.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultPolicy", policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()!)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});
```

---

## 9. React Frontend Architecture

**Project:** `Company.Project.Client`

The React frontend uses a **flat, role-based** folder structure — files are grouped by *what they are* (api, components, hooks, models, …), not by feature. This keeps the layout predictable and matches common React conventions. Reorganize into feature folders only if a project grows large enough to justify it.

### 9.1 Folder Structure

The role folders below are the same regardless of router mode (Section 9.6). Only the top-level directory and the routing entry files change: Declarative/Data mode use `src/` with your own router file; **framework mode** roots the app at `app/` with `root.tsx` and `routes.ts`.

```
Client/
├── public/
├── src/                             # `app/` in React Router framework mode
│   ├── api/                         # HTTP client + one fetcher module per resource (the queryFns)
│   │   ├── http.ts                  # fetch/axios wrapper
│   │   ├── policies.ts
│   │   └── users.ts
│   ├── assets/                      # Static images, fonts, icons
│   ├── components/                  # Shared, reusable UI components
│   │   ├── ui/                      # shadcn/ui primitives
│   │   ├── DataTable.tsx
│   │   └── ConfirmDialog.tsx
│   ├── context/                     # React Context units — context + provider + hook, one unit per file
│   │   └── CurrentUserContext.tsx
│   ├── hooks/                       # Custom hooks — TanStack Query server-state hooks + UI hooks
│   │   ├── usePolicies.ts           #   server-state (useQuery/useMutation + policyKeys)
│   │   └── usePagination.ts         #   UI-only
│   ├── layouts/                     # Page shells
│   │   ├── MainLayout.tsx
│   │   └── AuthLayout.tsx
│   ├── lib/                         # Third-party client setup
│   │   └── queryClient.ts           # configured TanStack Query QueryClient
│   ├── models/                      # Business data models (mirror API DTOs)
│   │   ├── Policy.ts
│   │   └── User.ts
│   ├── pages/                       # Route-level components (framework mode: `routes/` + `routes.ts`)
│   │   ├── PoliciesPage.tsx
│   │   └── UsersPage.tsx
│   ├── types/                       # UI-only types, enums, config shapes
│   │   └── pagination.ts
│   ├── utils/                       # Purpose-grouped pure utilities
│   │   ├── dateFormatting.ts
│   │   └── csvExport.ts
│   ├── App.tsx                      # framework mode: `root.tsx`
│   └── main.tsx                     # framework mode: `entry.client.tsx` (optional)
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

**Folder responsibilities**

- `api/` — the only place HTTP calls live: the shared client plus one fetcher module per resource. These fetchers are the `queryFn`s the TanStack Query hooks wrap. Never call `fetch`/`axios` from a component.
- `hooks/` — custom hooks, one per file. **Server-state hooks** (TanStack Query `useQuery`/`useMutation` per entity, each owning its query-key factory) and **UI hooks** both live here. A hook used by a single page may sit beside that page instead.
- `lib/` — third-party client setup, e.g. the configured TanStack Query `QueryClient`.
- `context/` — React Context, one file per context holding the context object, its provider, and its consumer hook together. Add a `providers/AppProviders.tsx` only when several providers need composing at the app root; don't split a single context across `context/` and `providers/`.
- `pages/` (or `routes/` in framework mode) — one component per route.
- `models/` vs `types/` — data lives in `models/` (interface + class); UI-only types, enums, and config shapes live in `types/`.
- Not used: `store/`/`state/` (server state is TanStack Query; client/UI state is `useState`/`useContext`) and a frontend `services/` folder (HTTP belongs in `api/`, logic in `hooks/`/`utils/`).

### 9.2 Models Mirror API Contracts

Frontend models mirror backend DTOs as closely as possible. The **interface** declares the contract; the **class** provides defaults, parses dates into `Date` objects in the constructor, and exposes computed properties. Shared enums live in `src/types` — not in the model file — per the Models vs. Types rule in the Xorbix Development Standards §5.3.

```typescript
// src/types/policy.ts

export enum PolicyStatus {
  Draft = "Draft",
  Active = "Active",
  Expired = "Expired",
  Cancelled = "Cancelled",
}
```

```typescript
// src/models/Policy.ts

import { PolicyStatus } from "@/types/policy";

export interface IPolicy {
  id: number;
  name: string;
  effectiveDate: Date;
  status: PolicyStatus;
  ownerId: number;
  ownerName: string;
  readonly formattedEffectiveDate: string;
}

export class Policy implements IPolicy {
  id: number;
  name: string;
  effectiveDate: Date;
  status: PolicyStatus;
  ownerId: number;
  ownerName: string;

  constructor(source: Partial<IPolicy> = {}) {
    this.id = source.id ?? 0;
    this.name = source.name ?? "";
    // The API sends ISO-8601 strings; parse them into a Date here.
    this.effectiveDate =
      source.effectiveDate instanceof Date
        ? source.effectiveDate
        : new Date(source.effectiveDate ?? Date.now());
    this.status = source.status ?? PolicyStatus.Draft;
    this.ownerId = source.ownerId ?? 0;
    this.ownerName = source.ownerName ?? "";
  }

  get formattedEffectiveDate(): string {
    return this.effectiveDate.toLocaleDateString();
  }
}
```

```typescript
// src/models/CreatePolicyRequest.ts

export interface ICreatePolicyRequest {
  name: string;
  effectiveDate: Date;
}

export class CreatePolicyRequest implements ICreatePolicyRequest {
  name: string;
  effectiveDate: Date;

  constructor(source: Partial<ICreatePolicyRequest> = {}) {
    this.name = source.name ?? "";
    this.effectiveDate = source.effectiveDate ?? new Date();
  }
}
```

### 9.3 API Client Layer

Centralize all HTTP in the `api/` folder: one shared client plus one module of **named functions per backend resource**. Components never call `fetch`/`axios` directly. These functions are the pure HTTP calls that the TanStack Query hooks (Section 9.4) wrap as their `queryFn`/`mutationFn` — the `api/` layer holds no caching or React state, only requests.

The shared client wraps `fetch` (or `axios` — pick one per project and use it consistently) and surfaces failures as a toast before re-throwing, so no error is silently swallowed:

```typescript
// src/api/http.ts

import { toast } from "@/components/ui/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include", // auth transport is project-specific — see note below
  });

  if (!response.ok) {
    // Parse the RFC 9457 ProblemDetails the API returns (Section 10.2).
    const problem = await response.json().catch(() => ({ title: response.statusText }));
    toast({
      title: "Request failed",
      description: problem.detail ?? problem.title,
      variant: "destructive",
    });
    throw new Error(problem.detail ?? problem.title ?? "Request failed");
  }

  return (await response.json()) as T;
}

export const http = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),
};
```

```typescript
// src/api/policies.ts

import { http } from "./http";
import type { IPolicy } from "@/models/Policy";
import type { ICreatePolicyRequest } from "@/models/CreatePolicyRequest";
import type { PagedResponse } from "@/types/pagination";

export const listPolicies = (page: number, pageSize: number) =>
  http.get<PagedResponse<IPolicy>>(`/policies?page=${page}&pageSize=${pageSize}`);
export const getPolicy = (id: number) => http.get<IPolicy>(`/policies/${id}`);
export const createPolicy = (request: ICreatePolicyRequest) =>
  http.post<IPolicy>("/policies", request);
export const updatePolicy = (id: number, request: ICreatePolicyRequest) =>
  http.put<IPolicy>(`/policies/${id}`, request);
export const deletePolicy = (id: number) => http.delete<void>(`/policies/${id}`);
```

**Authentication transport is project-specific.** Pick one and document it in the project's `AGENTS.md`:

- **httpOnly cookie session** (`credentials: "include"`, shown above) — the more XSS-resistant default; pair it with CSRF protection.
- **Bearer token** — attach `Authorization: Bearer <token>` from the auth library (e.g. MSAL/Entra) in the client; simpler for a pure SPA + API, but the token is exposed to any XSS on the page.

Most callers rely on the toast plus TanStack Query's `isError`. If you need status-based branching, throw a small typed `ApiError` that carries `response.status` instead of a plain `Error`.

### 9.4 State Management

Separate the two kinds of state:

- **Server state** — entities, lookups, DTOs, anything fetched from the API — is managed by **TanStack Query** (`@tanstack/react-query`, v5), the approved standard. It owns fetching, caching, refetching, and invalidation. Do **not** hand-roll `useState` + `useEffect` + `fetch` for server data.
- **Client/UI state** — form inputs, toggles, the selected tab — uses `useState`/`useContext`.

Create one `QueryClient` and mount the provider at the app root:

```typescript
// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});
```

```tsx
// src/main.tsx  (framework mode: app/root.tsx)
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>;
```

Per-entity query/mutation hooks live in `src/hooks/`, each owning a query-key factory; the raw fetchers stay in `src/api/` (Section 10) and serve as the `queryFn`:

```typescript
// src/hooks/usePolicies.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPolicies, createPolicy } from "@/api/policies";
import type { ICreatePolicyRequest } from "@/models/CreatePolicyRequest";

// Query-key factory — most generic → most specific.
export const policyKeys = {
  all: ["policies"] as const,
  lists: () => [...policyKeys.all, "list"] as const,
  list: (page: number, pageSize: number) =>
    [...policyKeys.lists(), { page, pageSize }] as const,
  detail: (id: number) => [...policyKeys.all, "detail", id] as const,
};

export function usePolicies(page: number, pageSize: number) {
  return useQuery({
    queryKey: policyKeys.list(page, pageSize),
    queryFn: () => listPolicies(page, pageSize),
    placeholderData: (previous) => previous,   // keep the prior page while the next loads
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ICreatePolicyRequest) => createPolicy(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: policyKeys.lists() }),
  });
}
```

Components read `data`/`isPending`/`isError` from the hook; mutations invalidate the affected keys in `onSuccess` rather than refetching by hand. In React Router framework mode with SSR, prefetch on the server and hydrate via `dehydrate` + `<HydrationBoundary>`.

### 9.5 Component Standards

Components are functional, use TypeScript, and follow the conventions from the Xorbix Development Standards. Every user interaction should have clear feedback — loading states, error messages, confirmation dialogs for destructive actions, and disabled states while operations are in progress.

```typescript
// src/pages/PoliciesPage.tsx

import { useState } from "react";
import { usePolicies } from "@/hooks/usePolicies";
import { DataTable } from "@/components/DataTable";
import { DEFAULT_PAGE_SIZE } from "@/types/pagination";

export default function PoliciesPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = usePolicies(page, DEFAULT_PAGE_SIZE);

  if (isError) {
    return <div role="alert" className="text-red-600">Failed to load policies.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Policies</h1>
      <DataTable
        data={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        page={page}
        onPageChange={setPage}
        isLoading={isPending}
      />
    </div>
  );
}
```

### 9.6 Routing and React Router Modes

Use the current stable major version of **React Router** (v7 today). React Router ships three [routing modes](https://reactrouter.com/start/modes) that build on each other; choose the one that fits the project rather than mandating one, and document the choice:

| Mode | What it adds | Choose when |
|---|---|---|
| **Declarative** | Component routing — `<BrowserRouter>`, `<Link>`, `useNavigate`, `useLocation` | Simplest needs; an SPA that owns its own data layer; migrating from CRA or v6 |
| **Data** | Route `loader`/`action`, pending states via `createBrowserRouter` + `RouterProvider`, `useFetcher`/`useNavigation` | You want data features but keep control of bundling and any server abstraction |
| **Framework** | Wraps Data mode with the Vite plugin: type-safe routes and `href`, automatic code-splitting, SPA/SSR/static rendering | New apps with no strong opinion, or apps that may need server rendering |

Whatever the mode, keep route configuration centralized. The mode also sets the project layout (Section 9.1): Declarative/Data mode use `src/` with your own router file; framework mode roots the app at `app/` with `root.tsx` and `routes.ts`.

---

## 10. API–Client Communication

### 10.1 JSON Serialization

Configure the API JSON serializer once in `Program.cs` so that every controller response is consistent. These options cover the common requirements for a .NET API consumed by a JavaScript frontend:

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Property names match JavaScript conventions
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;

        // Dictionary keys also use camelCase (e.g. for lookup/grouping endpoints)
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;

        // Null properties are omitted — reduces payload size
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;

        // Breaks reference cycles instead of throwing (common with EF navigation properties)
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;

        // Enums serialize as camelCase strings, not integers
        options.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    });
```

| Option | Why |
|---|---|
| `CamelCase` (properties) | Matches JavaScript conventions — no client-side mapping needed |
| `DictionaryKeyPolicy` | Ensures dictionary/map keys are also camelCase for consistency |
| `WhenWritingNull` | Smaller payloads; frontend checks for absence with `undefined` |
| `IgnoreCycles` | Prevents `JsonException` from EF Core navigation property cycles |
| `JsonStringEnumConverter` | Enums serialize as readable strings, not opaque integers |

### 10.2 Error Response Shape

All error responses from the API follow the **RFC 9457 ProblemDetails** standard. This gives every error a machine-readable `status`, a human-readable `title` and `detail`, and a `traceId` for correlation.

```json
{
  "status": 404,
  "title": "Not Found",
  "detail": "Policy 42 not found",
  "traceId": "00-abc123..."
}
```

Both the `HandleFluentResult` extension (Section 4.2) and `GlobalExceptionHandler` (Section 4.4) produce this shape. The frontend can parse `status` for control flow and display `detail` to the user.

### 10.3 Date Handling

All dates are transmitted as **ISO 8601 UTC strings** (`"2026-04-06T00:00:00Z"`). The API serializes `DateTime` values in UTC; the frontend parses and formats them for the user's locale.

---

## 11. Dependency Registration

Each layer owns its own DI registrations via a `ServiceCollectionExtensions` class. `Program.cs` calls them in dependency order, keeping the composition root clean.

```csharp
// Program.cs
WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Each layer registers its own services — order matches dependency flow
builder.Services.AddDataServices(builder.Configuration);     // DbContext, repos
builder.Services.AddBusinessServices();                       // Services
builder.Services.AddApiServices(builder.Configuration);       // Controllers, auth, middleware
```

```csharp
// Data/ServiceCollectionExtensions.cs
namespace Company.Project.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddDataServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Pick the provider the project targets — both are supported across Xorbix projects:
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("Default")));
            // PostgreSQL projects use: options.UseNpgsql(configuration.GetConnectionString("Default"));

        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IPolicyRepository, PolicyRepository>();
        services.AddScoped<IUserRepository, UserRepository>();

        return services;
    }
}
```

```csharp
// Services/ServiceCollectionExtensions.cs
namespace Company.Project.Services;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddBusinessServices(
        this IServiceCollection services)
    {
        services.AddScoped<IPolicyService, PolicyService>();
        services.AddScoped<IUserService, UserService>();

        return services;
    }
}
```

```csharp
// Api/ServiceCollectionExtensions.cs
namespace Company.Project.Server;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApiServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddProblemDetails();
        services.AddValidatorsFromAssemblyContaining<Program>();
        services.AddControllers();

        return services;
    }
}
```

---

## 12. Configuration and Environments

### 12.1 Configuration Files

```
Api/
├── appsettings.json                # Shared, non-sensitive defaults
├── appsettings.Development.json    # Local development overrides
├── appsettings.Staging.json        # Staging overrides (no secrets)
└── appsettings.Production.json     # Production overrides (no secrets)
```

### 12.2 Secrets

Never commit secrets to source control. Use the following hierarchy:

| Environment | Secret Source |
|---|---|
| Local development | .NET User Secrets (`dotnet user-secrets`) |
| Staging / Production | Azure Key Vault or environment variables |

### 12.3 Options Pattern

Bind configuration sections to strongly-typed classes using `IOptions<T>`. By convention, include a `SectionName` constant that matches the `appsettings.json` section key — this keeps the registration and the class co-located without magic strings.

**Add `ValidateDataAnnotations()`** to every options registration so that invalid configuration is caught at startup, not at first use. For critical settings (database, auth), also add `ValidateOnStart()` to fail the application immediately during host build rather than on first resolution.

```csharp
// Contracts/Configuration/AuthSettings.cs
public class AuthSettings
{
    public const string SectionName = "Auth";

    [Required]
    public required string Authority { get; set; }

    [Required]
    public required string Audience { get; set; }
}
```

```csharp
// Registration — uses the constant from the class itself
builder.Services.AddOptions<AuthSettings>()
    .Bind(builder.Configuration.GetSection(AuthSettings.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();                          // fail fast for critical settings

// Usage via constructor injection
public class TokenService(IOptions<AuthSettings> authOptions)
{
    private readonly AuthSettings _auth = authOptions.Value;
}
```

#### Centralized Options Registration

When a project has many options classes, create a single extension method that registers them all. This keeps `Program.cs` clean and makes it easy to audit which sections are bound and validated.

```csharp
namespace Company.Project.Server.Extensions;

public static class OptionsServiceExtensions
{
    public static IServiceCollection AddProjectOptions(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<AuthSettings>()
            .Bind(configuration.GetSection(AuthSettings.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<DatabaseSettings>()
            .Bind(configuration.GetSection(DatabaseSettings.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<BlobStorageSettings>()
            .Bind(configuration.GetSection(BlobStorageSettings.SectionName))
            .ValidateDataAnnotations();

        return services;
    }
}
```

```csharp
// Program.cs — one call replaces N individual registrations
builder.Services.AddProjectOptions(builder.Configuration);
```

---

## 13. Project Dependency Rules

The dependency graph flows in one direction. Violations of these rules indicate a structural problem that must be resolved before merge.

```
┌─────────────────────────────────────────────────┐
│                  Contracts                       │
│   (Entities, DTOs, Enums, Constants, Mapping)    │
│             No dependencies                      │
└───────────────────┬─────────────────────────────┘
                    │ referenced by all
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐   ┌─────────▼──────────┐
│     Data       │   │     Services        │
│ (DbContext,    │   │ (Business logic,    │
│  Repos,        │   │  interfaces)        │
│  Migrations)   │   │                     │
│                │   │ References:         │
│ References:    │   │  - Data (repos)     │
│  - Contracts   │   │  - Contracts        │
│                │   │                     │
└───────┬────────┘   └────────┬────────────┘
        │                     │
        └──────────┬──────────┘
                   │
          ┌────────▼─────────┐
          │       Api        │
          │ (Controllers,    │
          │  Middleware,      │
          │  DI setup)       │
          │                  │
          │ References:      │
          │  - Services      │
          │  - Contracts     │
          │  - Data (DI only)│
          └──────────────────┘
```

### Forbidden Dependencies

| From | To | Why |
|---|---|---|
| Data | Services | Data layer must not know about business logic |
| Data | Api | Data layer must not know about HTTP concerns |
| Services | Api | Services must not know about controllers or HTTP |
| Contracts | Anything | Contracts is the leaf — it depends on nothing |

The Api project references Data **only** for DI registration (registering the DbContext and repositories in the container). Controllers and middleware never use `ApplicationDbContext` or repository types directly — they depend on service interfaces.

### 13.1 Automated Enforcement with ArchUnitNET

Use [ArchUnitNET](https://github.com/TNG/ArchUnitNET) to enforce layer boundaries as unit tests. These tests run in CI alongside other unit tests and fail the build if any dependency violation is introduced — catching structural drift before it reaches code review.

**Package:** `TngTech.ArchUnitNET.xUnit` (or `TngTech.ArchUnitNET.NUnit`)

```csharp
using ArchUnitNET.Domain;
using ArchUnitNET.Fluent;
using ArchUnitNET.Loader;
using ArchUnitNET.xUnit;
using static ArchUnitNET.Fluent.ArchRuleDefinition;

namespace Company.Project.Arch.Tests;

public class ArchitectureRulesTests
{
    private const string InfrastructureNamespace = "Company.Project.Infrastructure";
    private const string ServicesNamespace = "Company.Project.Services";
    private const string ServerNamespace = "Company.Project.Server";

    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(
            typeof(Contracts.Constants.AppConstants).Assembly,   // Contracts
            typeof(Services.ServiceCollectionExtensions).Assembly,
            typeof(Infrastructure.ServiceCollectionExtensions).Assembly,
            typeof(Program).Assembly)
        .Build();

    [Fact]
    public void Contracts_Should_Not_Reference_Other_Layers()
    {
        IArchRule rule = Types()
            .That().ResideInNamespace("^Company\\.Project\\.Contracts(\\..*)?$", true)
            .Should().NotDependOnAny(ServicesNamespace)
            .AndShould().NotDependOnAny(InfrastructureNamespace)
            .AndShould().NotDependOnAny(ServerNamespace);

        rule.Check(Architecture);
    }

    [Fact]
    public void Infrastructure_Should_Not_Reference_Services_Or_Server()
    {
        IArchRule rule = Types()
            .That().ResideInNamespace("^Company\\.Project\\.Infrastructure(\\..*)?$", true)
            .Should().NotDependOnAny(ServicesNamespace)
            .AndShould().NotDependOnAny(ServerNamespace);

        rule.Check(Architecture);
    }

    [Fact]
    public void Services_Should_Not_Reference_Server()
    {
        IArchRule rule = Types()
            .That().ResideInNamespace("^Company\\.Project\\.Services(\\..*)?$", true)
            .Should().NotDependOnAny(ServerNamespace);

        rule.Check(Architecture);
    }

    [Fact]
    public void Server_Should_Not_Reference_Infrastructure_Directly()
    {
        IArchRule rule = Types()
            .That().ResideInNamespace("^Company\\.Project\\.Server(\\..*)?$", true)
            .Should().NotDependOnAny(InfrastructureNamespace);

        rule.Check(Architecture);
    }

    [Fact]
    public void Types_Outside_Infrastructure_Should_Not_Depend_On_DbContext()
    {
        IArchRule rule = Types()
            .That().DoNotResideInNamespace("^Company\\.Project\\.Infrastructure(\\..*)?$", true)
            .Should().NotDependOnAny(Types().That().AreAssignableTo(typeof(DbContext)));

        rule.Check(Architecture);
    }

    [Fact]
    public void Controllers_Should_Not_Depend_On_Repositories_Directly()
    {
        IArchRule rule = Classes()
            .That().ResideInNamespace("^Company\\.Project\\.Server\\.Controllers(\\..*)?$", true)
            .Should().NotDependOnAny("Company.Project.Infrastructure.Repositories");

        rule.Check(Architecture);
    }
}
```

---

## 14. Real-Time Communication (SignalR)

For features that require server-to-client push notifications (live updates, collaborative editing indicators, progress tracking), use **ASP.NET Core SignalR** with the **MessagePack** binary protocol.

### 14.1 Hub Design

Hubs handle connection lifecycle and group management only. CRUD operations stay in REST controllers — the hub is a notification channel, not a data endpoint.

```csharp
namespace Company.Project.Server.Hubs;

/// <summary>
/// Real-time notification hub. REST controllers handle data operations;
/// this hub provides server-to-client push notifications and presence tracking.
/// </summary>
public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation(
            "Client connected: {ConnectionId} (User: {UserId})",
            Context.ConnectionId,
            Context.UserIdentifier ?? "anonymous");

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation(
            "Client disconnected: {ConnectionId} (Reason: {Reason})",
            Context.ConnectionId,
            exception?.Message ?? "clean");

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Subscribe to notifications for an entity type or scope (e.g. "Policies", "Users:42").
    /// </summary>
    public async Task JoinGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }

    /// <summary>
    /// Unsubscribe from a notification group.
    /// </summary>
    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }
}
```

### 14.2 Sending Notifications from Services

Services push notifications via `IHubContext<T>` — they never call hub methods directly.

```csharp
public class PolicyService(
    IPolicyRepository policyRepository,
    IHubContext<NotificationHub> hubContext)
{
    public async Task<Result<PolicyDto>> CreatePolicyAsync(CreatePolicyRequest request)
    {
        // ... create policy ...

        await hubContext.Clients.Group("Policies").SendAsync("RecordCreated", new
        {
            EntityType = "Policy",
            RecordId = policy.Id,
            CreatedBy = request.CreatedBy
        });

        return Result.Ok(policy.ToDto());
    }
}
```

### 14.3 Registration

```csharp
// Program.cs

var signalRBuilder = builder.Services.AddSignalR()
    .AddMessagePackProtocol();         // binary protocol — smaller payloads, faster serialization

// Optional: Azure SignalR Service as backplane for multi-instance deployments
string? signalRConnectionString = builder.Configuration["SignalR:ConnectionString"];
if (!string.IsNullOrEmpty(signalRConnectionString))
{
    signalRBuilder.AddAzureSignalR(options =>
    {
        options.ConnectionString = signalRConnectionString;
    });
}
```

```csharp
// Endpoint mapping — after UseAuthorization()
app.MapHub<NotificationHub>("/signalr").RequireAuthorization();
```

**CORS note:** SignalR with credentials requires `.AllowCredentials()` in the CORS policy (see Section 8.3).

---

## 15. Observability (OpenTelemetry and Health Checks)

Instrument all services with **OpenTelemetry** for distributed tracing, metrics, and structured logging. Use a shared **ServiceDefaults** project (or extension method) so every service in the solution gets consistent telemetry configuration.

### 15.1 ServiceDefaults Pattern

Create a shared library (e.g. `Company.Project.ServiceDefaults`) that configures OpenTelemetry and health checks. Each service calls `builder.AddServiceDefaults()` — one line for full observability.

```csharp
namespace Microsoft.Extensions.Hosting;

public static class Extensions
{
    public static TBuilder AddServiceDefaults<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        builder.ConfigureOpenTelemetry();
        builder.AddDefaultHealthChecks();

        return builder;
    }

    public static TBuilder ConfigureOpenTelemetry<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .WithMetrics(metrics =>
            {
                metrics.AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();
            })
            .WithTracing(tracing =>
            {
                tracing.AddSource(builder.Environment.ApplicationName)
                    .AddAspNetCoreInstrumentation(options =>
                        options.Filter = context =>
                            !context.Request.Path.StartsWithSegments("/health")
                            && !context.Request.Path.StartsWithSegments("/alive"))
                    .AddHttpClientInstrumentation()
                    .AddSqlClientInstrumentation(options =>
                    {
                        options.RecordException = true;
                    });
            });

        // Export to OTLP collector (Aspire dashboard, Jaeger, etc.)
        bool useOtlp = !string.IsNullOrWhiteSpace(
            builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]);
        if (useOtlp)
        {
            builder.Services.AddOpenTelemetry().UseOtlpExporter();
        }

        // Export to Azure Monitor / Application Insights
        string? appInsightsConnectionString =
            builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];
        if (!string.IsNullOrWhiteSpace(appInsightsConnectionString))
        {
            builder.Services.AddOpenTelemetry().UseAzureMonitor(options =>
            {
                options.ConnectionString = appInsightsConnectionString;
            });
        }

        return builder;
    }

    public static TBuilder AddDefaultHealthChecks<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        builder.Services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy(), ["live"]);

        return builder;
    }
}
```

### 15.2 Health Check Endpoints

Map three health endpoints with different scopes:

| Endpoint | Purpose | Probe Type |
|---|---|---|
| `/health` | Aggregate status of all registered health checks | General |
| `/health/ready` | Per-dependency status for readiness probes (DB, cache, external APIs) | Kubernetes readiness |
| `/alive` | Liveness only — app process is responsive, ignores dependencies | Kubernetes liveness |

```csharp
// Endpoint mapping
app.MapHealthChecks("/health");

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready")
});

app.MapHealthChecks("/alive", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("live")
});
```

Register dependency-specific health checks with appropriate tags:

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), ["live"])
    .AddSqlServer(connectionString, tags: ["ready"])
    .AddAzureBlobStorage(blobServiceClient, tags: ["ready"]);
```

### 15.3 Usage in Program.cs

```csharp
// One call registers OpenTelemetry + health checks
builder.AddServiceDefaults();

var app = builder.Build();

// Map health endpoints (early in pipeline)
app.MapDefaultEndpoints();
```

---

*This is a living document. Propose changes via Pull Request. It supplements the Xorbix Development Standards and inherits all principles and rules defined there.*
