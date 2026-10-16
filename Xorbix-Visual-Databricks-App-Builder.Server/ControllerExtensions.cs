using FluentResults;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Server;

/// <summary>
/// Extension methods for <see cref="ControllerBase"/> to process and return <see cref="Result{T}"/> instances based on any possible meta data passed with errors.
/// </summary>
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

    /// <summary>
    /// Returns 200 OK or 202 Accepted depending on whether the result contains an
    /// <see cref="AcceptedSuccess"/> reason.
    /// </summary>
    private static ActionResult HandleSuccess(ControllerBase controller, Result result, object? value = null)
    {
        if (result.Successes.Any(s => s is AcceptedSuccess))
        {
            return controller.Accepted(value);
        }

        return controller.Ok(value);
    }

    /// <summary>
    /// Maps FluentResults error types to HTTP status codes and returns a <see cref="ProblemDetails"/> response.
    /// Error messages are aggregated into the <c>Detail</c> field. Individual error messages are listed
    /// in the <c>errors</c> extension property for frontends that need per-field detail.
    /// </summary>
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

        // Surface the remaining verification attempts so the client can gate its UI on the server's
        // limit instead of duplicating the number and drifting from it.
        IRemainingAttemptsError? attemptsError = result.Errors.OfType<IRemainingAttemptsError>().FirstOrDefault();
        if (attemptsError != null)
        {
            problemDetails.Extensions["remainingAttempts"] = attemptsError.RemainingAttempts;
        }

        TooManyRequestsError? throttledError = result.Errors.OfType<TooManyRequestsError>().FirstOrDefault();
        if (throttledError != null)
        {
            problemDetails.Extensions["retryAfter"] = throttledError.RetryAfterUtc;

            int retryAfterSeconds = Math.Max(0, (int)Math.Ceiling((throttledError.RetryAfterUtc - DateTime.UtcNow).TotalSeconds));
            controller.HttpContext.Response.Headers.RetryAfter = retryAfterSeconds.ToString(CultureInfo.InvariantCulture);
        }

        PartialDatabricksProvisionError? partialError = result.Errors.OfType<PartialDatabricksProvisionError>().FirstOrDefault();
        if (partialError != null)
        {
            problemDetails.Extensions["databricksAppName"] = partialError.DatabricksAppName;
            problemDetails.Extensions["workspaceConnectionId"] = partialError.WorkspaceConnectionId;
        }

        return new ObjectResult(problemDetails) { StatusCode = statusCode };
    }

    /// <summary>
    /// Determines the HTTP status code, RFC 9457 type URI, and title from FluentResults error types.
    /// Checks in order of specificity; falls back to 400 Bad Request for unmapped error types.
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

        if (result.HasError<TooManyRequestsError>())
            return (StatusCodes.Status429TooManyRequests,
                "https://tools.ietf.org/html/rfc6585#section-4",
                "Too Many Requests");

        if (result.HasError<PartialDatabricksProvisionError>())
            return (StatusCodes.Status500InternalServerError,
                "https://tools.ietf.org/html/rfc9110#section-15.6.1",
                "Internal Server Error");

        if (result.HasError<ValidationError>() || result.HasError<BadRequestError>())
            return (StatusCodes.Status400BadRequest,
                "https://tools.ietf.org/html/rfc9110#section-15.5.1",
                "Bad Request");

        if (result.HasError<ExceptionalError>())
            return (StatusCodes.Status500InternalServerError,
                "https://tools.ietf.org/html/rfc9110#section-15.6.1",
                "Internal Server Error");

        // Unmapped FluentResults error types default to 400
        return (StatusCodes.Status400BadRequest,
            "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            "Bad Request");
    }

    /// <summary>
    /// Extracts and validates the authenticated user ID from JWT claims.
    /// </summary>
    /// <param name="controller">The controller instance.</param>
    /// <returns>The user ID if found and valid; otherwise, null.</returns>
    public static Guid? GetAuthenticatedUserId(this ControllerBase controller)
    {
        string? userIdString = controller.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out Guid userId))
        {
            return null;
        }

        return userId;
    }

    /// <summary>
    /// Extracts and validates the authenticated user's tenant ID from JWT claims.
    /// </summary>
    /// <param name="controller">The controller instance.</param>
    /// <returns>The tenant ID if found and valid; otherwise, null.</returns>
    public static Guid? GetAuthenticatedTenantId(this ControllerBase controller)
    {
        string? tenantIdString = controller.User.FindFirst(TenantClaimTypes.TenantId)?.Value;

        if (string.IsNullOrEmpty(tenantIdString) || !Guid.TryParse(tenantIdString, out Guid tenantId))
        {
            return null;
        }

        return tenantId;
    }

    /// <summary>
    /// Extracts the authenticated user's tenant role from JWT claims.
    /// </summary>
    public static string? GetAuthenticatedTenantRole(this ControllerBase controller)
    {
        string? tenantRole = controller.User.FindFirst(TenantClaimTypes.TenantRole)?.Value;
        return string.IsNullOrWhiteSpace(tenantRole) ? null : tenantRole;
    }

    /// <summary>
    /// Extracts all authenticated user claims from the JWT token.
    /// </summary>
    /// <param name="controller">The controller instance.</param>
    /// <returns>An <see cref="AuthenticatedUserClaims"/> object if all required claims are present; otherwise, null.</returns>
    public static AuthenticatedUserClaims? GetAuthenticatedUserClaims(this ControllerBase controller)
    {
        ClaimsPrincipal user = controller.User;

        // Extract UserId
        string? userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out Guid userId))
        {
            return null;
        }

        // Extract UserName
        string? userName = user.FindFirst(ClaimTypes.Name)?.Value;
        if (string.IsNullOrEmpty(userName))
        {
            return null;
        }

        // Extract Email
        string? email = user.FindFirst(ClaimTypes.Email)?.Value;
        if (string.IsNullOrEmpty(email))
        {
            return null;
        }

        // Extract FirstName
        string? firstName = user.FindFirst(ClaimTypes.GivenName)?.Value;
        if (string.IsNullOrEmpty(firstName))
        {
            return null;
        }

        // Extract LastName
        string? lastName = user.FindFirst(ClaimTypes.Surname)?.Value;
        if (string.IsNullOrEmpty(lastName))
        {
            return null;
        }

        // Extract Roles
        IList<string> roles = user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        // Extract optional claims
        string? jti = user.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        string? iatString = user.FindFirst(JwtRegisteredClaimNames.Iat)?.Value;
        long? issuedAt = long.TryParse(iatString, out long parsedIat) ? parsedIat : null;

        Guid? tenantId = controller.GetAuthenticatedTenantId();
        string? tenantRole = controller.GetAuthenticatedTenantRole();

        return new AuthenticatedUserClaims
        {
            UserId = userId,
            UserName = userName,
            Email = email,
            FirstName = firstName,
            LastName = lastName,
            Roles = roles,
            Jti = jti,
            IssuedAt = issuedAt,
            TenantId = tenantId,
            TenantRole = tenantRole,
        };
    }

    /// <summary>
    /// Gets a specific claim value from the authenticated user's JWT token.
    /// </summary>
    /// <param name="controller">The controller instance.</param>
    /// <param name="claimType">The type of claim to retrieve.</param>
    /// <returns>The claim value if found; otherwise, null.</returns>
    public static string? GetClaimValue(this ControllerBase controller, string claimType)
    {
        return controller.User.FindFirst(claimType)?.Value;
    }

    /// <summary>
    /// Gets all claim values of a specific type from the authenticated user's JWT token.
    /// </summary>
    /// <param name="controller">The controller instance.</param>
    /// <param name="claimType">The type of claims to retrieve.</param>
    /// <returns>A list of claim values.</returns>
    public static IList<string> GetClaimValues(this ControllerBase controller, string claimType)
    {
        return controller.User.FindAll(claimType).Select(c => c.Value).ToList();
    }

    /// <summary>
    /// Checks if the authenticated user has a specific role.
    /// </summary>
    /// <param name="controller">The controller instance.</param>
    /// <param name="role">The role to check.</param>
    /// <returns>True if the user has the role; otherwise, false.</returns>
    public static bool HasRole(this ControllerBase controller, string role)
    {
        return controller.User.IsInRole(role);
    }

    /// <summary>
    /// Checks if the authenticated user has any of the specified roles.
    /// </summary>
    /// <param name="controller">The controller instance.</param>
    /// <param name="roles">The roles to check.</param>
    /// <returns>True if the user has any of the roles; otherwise, false.</returns>
    public static bool HasAnyRole(this ControllerBase controller, params string[] roles)
    {
        return roles.Any(role => controller.User.IsInRole(role));
    }

    /// <summary>
    /// Checks if the authenticated user has all of the specified roles.
    /// </summary>
    /// <param name="controller">The controller instance.</param>
    /// <param name="roles">The roles to check.</param>
    /// <returns>True if the user has all of the roles; otherwise, false.</returns>
    public static bool HasAllRoles(this ControllerBase controller, params string[] roles)
    {
        return roles.All(role => controller.User.IsInRole(role));
    }
}
