# Backend Patterns
**Last Updated:** 11 June 2026  


Concrete reference patterns for the .NET backend. Read when implementing or modifying a controller, service, repository, EF configuration, typed error, mapping, current-user lookup, or transaction.

Rules live in [`AGENTS.md`](../../AGENTS.md). This file only shows the patterns those rules produce.

---

## Vertical Slice Checklist

For a feature `Name`, you create — in this order:

1. **Entity** in `.Contracts` (singular).
2. **Entity configuration** in `.Infrastructure/Configurations/NameConfiguration.cs` (table name from `TableNames` constant).
3. **EF migration** (after team-lead confirmation).
4. **Repository pair** in `.Infrastructure`: `INameRepository.cs` + `NameRepository.cs`.
5. **Service pair** in `.Services`: `INameService.cs` + `NameService.cs`.
6. **DTOs / requests / responses** in `.Contracts` (Data Annotations on request models for basic checks).
7. **Validators** in `.Server/Validators/` (only when a request rule is too complex for a Data Annotation).
8. **Controller** in `.Server/Controllers/NamesController.cs`.
9. **DI registration** in the relevant `ServiceCollectionExtensions`.
10. **Frontend API module + model class** — see [frontend patterns](frontend-patterns.md).

---

## Controller

```csharp
namespace Company.Project.Server.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PoliciesController(IPolicyService policyService) : AuthenticatedControllerBase
{
    /// <summary>Lists all policies the current user can see.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PolicyDto>>> GetAll(CancellationToken ct)
    {
        Result<IReadOnlyList<PolicyDto>> result = await policyService.GetAllAsync(ct);
        return this.HandleFluentResult(result);
    }

    /// <summary>Gets a single policy by id.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PolicyDto>> Get(int id, CancellationToken ct)
    {
        Result<PolicyDto> result = await policyService.GetAsync(id, ct);
        return this.HandleFluentResult(result);
    }

    /// <summary>Creates a new policy.</summary>
    [HttpPost]
    public async Task<ActionResult<PolicyDto>> Create(
        [FromBody] CreatePolicyRequest request,
        CancellationToken ct)
    {
        Result<PolicyDto> result = await policyService.CreateAsync(request, ct);
        return this.HandleFluentResult(result);
    }
}
```

Rules: thin controller, no business logic, every method returns through `HandleFluentResult`. `CancellationToken` is always the last parameter.

### Action return type

Declare `Task<ActionResult<T>>` when the action returns a body, `Task<ActionResult>` when it doesn't:

```csharp
// Returns a body — T drives OpenAPI/Scalar 200-body inference.
public async Task<ActionResult<IReadOnlyList<PolicyDto>>> GetAll(CancellationToken ct)
{
    Result<IReadOnlyList<PolicyDto>> result = await policyService.GetAllAsync(ct);
    return this.HandleFluentResult(result);
}

// No body — nothing to document.
public async Task<ActionResult> Delete(int id, CancellationToken ct)
{
    Result result = await policyService.DeleteAsync(id, ct);
    return this.HandleFluentResult(result);
}
```

`HandleFluentResult` returns the non-generic `ActionResult`; the implicit `ActionResult` → `ActionResult<T>` conversion makes `return this.HandleFluentResult(result);` compile against an `ActionResult<T>` signature. ApiExplorer infers the 200 body from the declared `T`, **not** from the runtime object, so the signature is the only thing documenting the success shape — keep it. The signature cannot express non-200 outcomes; declare those with `[ProducesResponseType(StatusCodes.Status404NotFound)]` (etc.) when a caller depends on them. Error bodies are `ProblemDetails`.

## `HandleFluentResult` extension

Maps a `Result`/`Result<T>` to the right HTTP status by inspecting the typed errors via `result.HasError<T>()`. Errors are returned as RFC 9457 `ProblemDetails`, with each error message also surfaced in the `errors` extension property for frontends that need per-field detail. Both overloads return `ActionResult` (non-generic) — this is intentional. Do not change them to return `ActionResult<T>`: the error paths produce a `ProblemDetails` `ObjectResult`, which does not fit an `ActionResult<T>` of the success DTO, and the 200 body type is already documented by each action's declared signature.

```csharp
public static class ControllerExtensions
{
    /// <summary>
    /// Handles a <see cref="Result{T}"/> and returns the appropriate <see cref="ActionResult"/>.
    /// On success, returns 200 OK (or 202 Accepted) with the value.
    /// On failure, returns a ProblemDetails response mapped from the error types.
    /// </summary>
    public static ActionResult HandleFluentResult<T>(this ControllerBase controller, Result<T> result)
    {
        return result.IsSuccess
            ? HandleSuccess(controller, result.ToResult(), result.ValueOrDefault)
            : HandleErrors(controller, result.ToResult());
    }

    /// <summary>
    /// Handles a <see cref="Result"/> (no value) and returns the appropriate <see cref="ActionResult"/>.
    /// On success, returns 200 OK (or 202 Accepted).
    /// On failure, returns a ProblemDetails response mapped from the error types.
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
        var (statusCode, type, title) = MapErrorToStatus(result);

        var errorMessages = result.Errors
            .Select(e => e.Message)
            .ToList();

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Type = type,
            Title = title,
            Detail = string.Join(" ", errorMessages),
            Instance = $"{controller.HttpContext.Request.Method} {controller.HttpContext.Request.Path}",
        };

        problemDetails.Extensions["traceId"] = controller.HttpContext.TraceIdentifier;
        problemDetails.Extensions["errors"] = errorMessages;

        return new ObjectResult(problemDetails) { StatusCode = statusCode };
    }

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

        // Unmapped FluentResults error types default to 400
        return (StatusCodes.Status400BadRequest,
            "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            "Bad Request");
    }
}
```

Use `result.HasError<T>()` to check error types — never `errors.Any(e => e is T)`. This correctly handles results that carry multiple errors. To add a new failure mode, add a typed error in the Contracts layer and a corresponding `HasError<T>()` branch in `MapErrorToStatus`.


## `AuthenticatedControllerBase`

```csharp
[Authorize]
[ApiController]
public abstract class AuthenticatedControllerBase : ControllerBase
{
    private Guid? _userId;
    private string? _email;

    protected Guid UserId => _userId ??= Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User id claim missing."));

    protected string Email => _email ??= User.FindFirstValue(ClaimTypes.Email)
        ?? User.FindFirstValue("preferred_username")
        ?? string.Empty;
}
```

---

## Service Interface

```csharp
namespace Company.Project.Services;

/// <summary>Manages policy lifecycle operations.</summary>
public interface IPolicyService
{
    /// <summary>Retrieves a policy by its identifier.</summary>
    Task<Result<PolicyDto>> GetAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Creates a new policy.</summary>
    Task<Result<PolicyDto>> CreateAsync(CreatePolicyRequest request, CancellationToken cancellationToken = default);
}
```

## Service Implementation

```csharp
namespace Company.Project.Services;

/// <inheritdoc/>
public class PolicyService(
    IPolicyRepository policyRepository,
    ILogger<PolicyService> logger) : IPolicyService
{
    /// <inheritdoc/>
    public async Task<Result<PolicyDto>> GetAsync(int id, CancellationToken ct = default)
    {
        Policy? policy = await policyRepository.FindOneAsync(p => p.Id == id, ct);

        if (policy is null)
        {
            logger.LogWarning("Policy {PolicyId} not found", id);
            return Result.Fail(new NotFoundError($"Policy {id} not found"));
        }

        return Result.Ok(policy.ToDto());
    }

    /// <inheritdoc/>
    public async Task<Result<PolicyDto>> CreateAsync(CreatePolicyRequest request, CancellationToken ct = default)
    {
        bool exists = await policyRepository.ExistsAsync(p => p.Name == request.Name, ct);
        if (exists)
            return Result.Fail(new ConflictError($"A policy named '{request.Name}' already exists"));

        Policy entity = request.ToEntity();
        await policyRepository.AddAsync(entity, ct);

        return Result.Ok(entity.ToDto());
    }
}
```

Rules: no `DbContext`, no thrown exceptions for expected failures, typed errors only, all I/O awaited with `CancellationToken`.

## Mapping Extensions

```csharp
namespace Company.Project.Contracts.Mapping;

public static class PolicyMappingExtensions
{
    public static PolicyDto ToDto(this Policy entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        EffectiveDate = entity.EffectiveDate,
        Status = entity.Status,
    };

    public static Policy ToEntity(this CreatePolicyRequest request) => new()
    {
        Name = request.Name,
        EffectiveDate = request.EffectiveDate,
        Status = PolicyStatus.Draft,
    };
}
```

Hand-written. Avoid AutoMapper.

## Transaction Across Repositories

```csharp
public async Task<Result> TransferPolicyAsync(int policyId, int newOwnerId, CancellationToken ct = default)
{
    using TransactionScope transaction = new(
        TransactionScopeOption.Required,
        TransactionScopeAsyncFlowOption.Enabled);

    Policy? policy = await policyRepository.FindOneAsync(p => p.Id == policyId, ct);
    if (policy is null)
        return Result.Fail(new NotFoundError($"Policy {policyId} not found"));

    policy.OwnerId = newOwnerId;
    await policyRepository.UpdateAsync(policy, ct);
    await auditRepository.LogTransferAsync(policyId, newOwnerId, ct);

    transaction.Complete();
    return Result.Ok();
}
```

Omit `transaction.Complete()` to roll back.

## Current-User Access

Services that need the calling user inject `ICurrentUserService`, never `IHttpContextAccessor`.

```csharp
public interface ICurrentUserService
{
    Guid GetUserId();
    string? GetEmail();
    Task<User> GetUserAsync(CancellationToken cancellationToken = default);
}
```

---

## Repository Interface

```csharp
namespace Company.Project.Infrastructure;

public interface IPolicyRepository : IRepository<Policy>
{
    Task<bool> ExistsByNameAsync(string name, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Policy>> GetByOwnerAsync(int ownerId, CancellationToken cancellationToken = default);
}
```

## Repository Implementation

```csharp
namespace Company.Project.Infrastructure;

/// <inheritdoc/>
public class PolicyRepository(ApplicationDbContext context)
    : Repository<Policy>(context), IPolicyRepository
{
    /// <inheritdoc/>
    public Task<bool> ExistsByNameAsync(string name, CancellationToken ct = default)
        => DbSet.AnyAsync(p => p.Name == name, ct);

    /// <inheritdoc/>
    public async Task<IReadOnlyList<Policy>> GetByOwnerAsync(int ownerId, CancellationToken ct = default)
        => await DbSet
            .AsNoTracking()
            .Where(p => p.OwnerId == ownerId)
            .Include(p => p.Documents)
            .ToListAsync(ct);
}
```

Rules: read queries use `AsNoTracking()`, all methods take `CancellationToken`, returns are `IReadOnlyList<T>` for collections.

## Generic Repository (shape only)

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> FindOneAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<T>> FindManyAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<T>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    Task<int> CountAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    Task AddAsync(T entity, CancellationToken cancellationToken = default);
    Task AddManyAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);
    Task UpdateAsync(T entity, CancellationToken cancellationToken = default);
    Task UpdateManyAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);
    Task DeleteAsync(T entity, CancellationToken cancellationToken = default);
    Task DeleteManyAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);
}
```

Mutating methods persist immediately via `SaveChangesAsync`. Cross-repository atomicity uses `TransactionScope` in the service.

---

## Entity

Entities carry Data Annotations for the basic shape (`[Key]`, `[Required]`, `[MaxLength]`, `[Column]`) so the contract is self-documenting and tooling can read it. The Fluent `IEntityTypeConfiguration<T>` remains the source of truth for anything the annotations cannot express (relationships, delete behavior, query filters, conversions); do not duplicate a rule in both places.

```csharp
namespace Company.Project.Contracts;

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
    public DateTime? DeletedOn { get; set; }

    public User Owner { get; set; } = null!;
    public ICollection<PolicyDocument> Documents { get; set; } = [];
}
```

## Entity Configuration

```csharp
namespace Company.Project.Infrastructure.Configurations;

public class PolicyConfiguration : IEntityTypeConfiguration<Policy>
{
    public void Configure(EntityTypeBuilder<Policy> builder)
    {
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

        builder.HasQueryFilter(p => p.DeletedOn == null);
    }
}
```

Table names come from `TableNames` constants in `.Contracts` — no magic strings. Pass a `SchemaNames` constant as the second argument to `ToTable` only for non-default schemas; omit it for the provider's default schema.

The `HasQueryFilter` above is **one** way to apply soft-delete filtering, and it's optional. Use it sparingly: EF Core allows only one query filter per entity (so it competes with multi-tenancy or other global filters), and reading soft-deleted rows then needs an explicit `IgnoreQueryFilters()`. For most entities, filtering inline in the repository (`.Where(p => p.DeletedOn == null)`) is the clearer default — reach for the global filter only when nearly every query should exclude deleted rows and the entity needs no other global filter.

## DbContext Conventions

```csharp
protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
{
    configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
    configurationBuilder.Properties<DateTime>().HaveConversion<DateTimeUtcConverter>();
    configurationBuilder.Properties<DateTime?>().HaveConversion<DateTimeUtcConverter>();
}
```

UTC normalization is enforced at the DbContext level. Do not bypass it in entity configurations.

---

## DTOs and Requests

Response DTOs are plain data carriers and need no validation attributes. Request DTOs carry Data Annotations for the basic, declarative checks — null/required, length, range, and format — so `[ApiController]` rejects malformed input at model binding before the action runs.

```csharp
public class PolicyDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime EffectiveDate { get; set; }
    public PolicyStatus Status { get; set; }
}

public class CreatePolicyRequest
{
    [Required]
    [MaxLength(200)]
    public required string Name { get; set; }

    [Required]
    public DateTime EffectiveDate { get; set; }
}
```

## Validation

Validation is layered. Use the cheapest tool that expresses the rule, and never write the same rule twice.

| Layer | Tool | Use for |
| --- | --- | --- |
| Request shape | Data Annotations on the request model | Basic, self-contained checks: `[Required]`, `[MaxLength]`, `[Range]`, `[EmailAddress]`, `[RegularExpression]`. Enforced automatically by `[ApiController]`. |
| Complex request rules | FluentValidation validator in `.Server/Validators/` | Anything Data Annotations can't express: cross-field rules, conditional rules, collection rules, or checks that need formatting/computation. |
| Business rules | Service layer, typed errors | Rules needing the database or domain state (uniqueness, existence, state transitions). Returned as `Result<T>` typed errors. |

Reach for a FluentValidation validator **only when a request rule is too complex for a Data Annotation** — for example, a cross-field or conditional rule. Do not mirror a Data Annotation rule inside a validator.

```csharp
namespace Company.Project.Server.Validators;

// Only complex, cross-field rules live here. Basic null/length/format
// checks stay as Data Annotations on CreatePolicyRequest.
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

Registered via `AddValidatorsFromAssemblyContaining<>()`.

## Paged Response

```csharp
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

---

## Adding a New Typed Error

When a new failure mode doesn't fit an existing typed error in `Contracts/FluentErrors.cs`:

- If it maps to the same HTTP status as an existing error, **subclass** it. `HandleFluentResult` keeps working without changes.
- If it maps to a new HTTP status, add a new top-level error AND add a case to `HandleFluentResult` for it.

```csharp
// Subclass existing: still maps to 400 via BadRequestError case in HandleFluentResult.
public class CodeNameValidationError : BadRequestError
{
    public CodeNameValidationError(string message, string field, string componentId)
        : base(message)
    {
        Metadata[nameof(Field)] = field;
        Metadata[nameof(ComponentId)] = componentId;
    }

    public string Field => Metadata[nameof(Field)]?.ToString() ?? string.Empty;
    public string ComponentId => Metadata[nameof(ComponentId)]?.ToString() ?? string.Empty;
}
```

Carry diagnostic context in `Metadata` rather than adding constructor parameters that leak through the message string.

---

## Structured Logging

```csharp
logger.LogWarning("Policy {PolicyId} not found for user {UserId}", id, userId);
```

Never use string interpolation in the message template. The first argument is the template; subsequent arguments fill the named placeholders. Property names match the placeholders so they index correctly in the log sink.

## Log-Context Middleware

Runs **after** authentication so user identity is in scope:

```csharp
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<LogContextMiddleware>();
app.MapControllers();
```

`LogContextMiddleware` enriches the log scope with `UserId` and `Jti` from JWT claims so every log line inside a request automatically carries them.

---

## DI Registration

Each layer exposes a `ServiceCollectionExtensions` class:

```csharp
// .Services
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddBusinessServices(this IServiceCollection services)
    {
        services.AddScoped<IPolicyService, PolicyService>();
        services.AddScoped<IUserService, UserService>();
        return services;
    }
}

// .Infrastructure
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddDataServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Pick the provider the project targets — both are supported across Xorbix projects:
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("AppDb")));
            // SQL Server projects use: options.UseSqlServer(configuration.GetConnectionString("AppDb"));

        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IPolicyRepository, PolicyRepository>();
        return services;
    }
}
```

`Program.cs` calls them in order:

```csharp
builder.Services.AddDataServices(builder.Configuration);
builder.Services.AddBusinessServices();
builder.Services.AddApiServices(builder.Configuration);
```

Never register a service directly in `Program.cs`.
