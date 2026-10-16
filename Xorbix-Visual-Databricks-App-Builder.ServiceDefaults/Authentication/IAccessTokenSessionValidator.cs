namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Authentication;

/// <summary>
/// Validates that a JWT access token is still bound to an active user session.
/// </summary>
public interface IAccessTokenSessionValidator
{
    /// <summary>
    /// Validates the security stamp and session identifier embedded in the access token.
    /// </summary>
    /// <param name="userId">The user identifier from the token.</param>
    /// <param name="securityStampClaim">The security stamp claim value.</param>
    /// <param name="sessionIdClaim">The session identifier claim value.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>True when the token is still valid; otherwise false.</returns>
    Task<bool> ValidateAsync(
        Guid userId,
        string? securityStampClaim,
        string? sessionIdClaim,
        CancellationToken cancellationToken = default);
}
