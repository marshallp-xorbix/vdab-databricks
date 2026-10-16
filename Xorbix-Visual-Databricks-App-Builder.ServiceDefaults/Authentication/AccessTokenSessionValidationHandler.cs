using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;

/// <summary>
/// Validates JWT access-token session binding after signature validation succeeds.
/// Extracted from <c>OnTokenValidated</c> so header vs. fail-closed branches can be unit-tested.
/// </summary>
public static class AccessTokenSessionValidationHandler
{
    private const string LoggerCategoryName = "AuthenticationExtensions.OnTokenValidated";

    /// <summary>
    /// Outcome of access-token session validation for an authenticated principal.
    /// </summary>
    /// <param name="Succeeded">True when the request may proceed.</param>
    /// <param name="FailureMessage">Failure reason when <paramref name="Succeeded"/> is false.</param>
    /// <param name="SetSessionRevokedHeader">
    /// When true, the response should include <see cref="AuthResponseHeaders.SessionRevoked"/>
    /// so the client treats this as an intentional session end.
    /// </param>
    public sealed record ValidationOutcome(
        bool Succeeded,
        string? FailureMessage,
        bool SetSessionRevokedHeader);

    /// <summary>
    /// Runs session binding validation for the authenticated principal in <paramref name="context"/>.
    /// </summary>
    public static async Task HandleAsync(TokenValidatedContext context)
    {
        if (context.Principal?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        IAccessTokenSessionValidator? validator = context.HttpContext.RequestServices
            .GetService<IAccessTokenSessionValidator>();
        ILoggerFactory loggerFactory = context.HttpContext.RequestServices
            .GetRequiredService<ILoggerFactory>();

        ValidationOutcome outcome = await ValidateAsync(
            context.Principal,
            validator,
            loggerFactory,
            context.HttpContext.RequestAborted);

        if (outcome.Succeeded)
        {
            return;
        }

        context.Fail(outcome.FailureMessage ?? "Session validation failed.");
        if (outcome.SetSessionRevokedHeader)
        {
            context.Response.Headers.Append(AuthResponseHeaders.SessionRevoked, "true");
        }
    }

    /// <summary>
    /// Core session-validation logic used by <see cref="HandleAsync"/> and unit tests.
    /// </summary>
    /// <param name="principal">The authenticated principal from the access token.</param>
    /// <param name="validator">Session validator, or null when DI misconfigured.</param>
    /// <param name="loggerFactory">Logger factory; loggers are created only on error paths.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public static async Task<ValidationOutcome> ValidateAsync(
        ClaimsPrincipal principal,
        IAccessTokenSessionValidator? validator,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken = default)
    {
        string? userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out Guid userId))
        {
            return new ValidationOutcome(
                Succeeded: false,
                FailureMessage: "Invalid user identifier in access token.",
                SetSessionRevokedHeader: true);
        }

        string? securityStampClaim = principal.FindFirstValue(AuthClaimTypes.SecurityStamp);
        string? sessionIdClaim = principal.FindFirstValue(AuthClaimTypes.SessionId);

        if (validator == null)
        {
            // Fail closed on misconfiguration; omit SessionRevoked so the client
            // does not treat this as an intentional user revoke.
            loggerFactory
                .CreateLogger(LoggerCategoryName)
                .LogError("IAccessTokenSessionValidator is not registered; rejecting authenticated request");
            return new ValidationOutcome(
                Succeeded: false,
                FailureMessage: "Session validation is unavailable.",
                SetSessionRevokedHeader: false);
        }

        try
        {
            bool isValid = await validator.ValidateAsync(
                userId,
                securityStampClaim,
                sessionIdClaim,
                cancellationToken);

            if (!isValid)
            {
                return new ValidationOutcome(
                    Succeeded: false,
                    FailureMessage: "Session has been revoked or is no longer valid.",
                    SetSessionRevokedHeader: true);
            }

            return new ValidationOutcome(
                Succeeded: true,
                FailureMessage: null,
                SetSessionRevokedHeader: false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Fail closed on infrastructure errors; omit SessionRevoked so a DB blip
            // is not presented to the client as a session revoke.
            loggerFactory
                .CreateLogger(LoggerCategoryName)
                .LogError(
                    ex,
                    "Session validation failed for user {UserId} due to an infrastructure error",
                    userId);
            return new ValidationOutcome(
                Succeeded: false,
                FailureMessage: "Session validation failed due to a temporary error.",
                SetSessionRevokedHeader: false);
        }
    }
}
