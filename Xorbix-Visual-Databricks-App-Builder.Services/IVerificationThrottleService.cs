using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Applies an escalating per-email backoff to verification-code issuance. This is the primary
/// brute-force control for the passwordless / 2FA flow: the per-code attempt limit resets whenever a
/// new code is issued, so bounding how often codes can be issued is what bounds the total guess rate.
/// </summary>
public interface IVerificationThrottleService
{
    /// <summary>
    /// Records a code-issuance request for the supplied email and reports when the next request will
    /// be permitted. Must be called before the user is resolved, and with the raw submitted email, so
    /// that unknown and known addresses are throttled identically and cannot be distinguished.
    /// </summary>
    /// <param name="email">The submitted email address.</param>
    /// <param name="scope">
    /// The trust boundary the request crosses. Each scope has its own backoff bucket, so anonymous
    /// traffic against an address cannot throttle a <see cref="VerificationIssuanceScope.PasswordVerified"/>
    /// send for the same address.
    /// </param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>
    /// The UTC instant at which another code may be requested, or a
    /// <see cref="TooManyRequestsError"/> when the caller is still inside the backoff window.
    /// </returns>
    Task<Result<DateTime>> RegisterIssuanceAsync(string email, VerificationIssuanceScope scope, CancellationToken cancellationToken = default);

    /// <summary>
    /// Clears the backoff state for the supplied email across every scope. Called after a successful
    /// verification so a legitimate sign-in does not leave the user throttled on either bucket.
    /// </summary>
    /// <param name="email">The email address whose backoff state should be cleared.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    Task ClearAsync(string email, CancellationToken cancellationToken = default);
}
