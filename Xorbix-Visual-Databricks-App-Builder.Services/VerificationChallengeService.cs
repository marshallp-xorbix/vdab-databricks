using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for sending, validating, and invalidating passwordless and 2FA verification challenges.
/// </summary>
public class VerificationChallengeService : IVerificationChallengeService
{
    private readonly ILogger<VerificationChallengeService> _logger;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailSenderService _emailSender;

    // TODO: move cache out of service layer
    private readonly IDistributedCache _cache;
    private readonly IAuthResponseService _authResponseService;
    private readonly IAccountAccessPolicy _accountAccessPolicy;
    private readonly IVerificationThrottleService _throttleService;
    private readonly bool _skip2Fa;

    private const int CodeExpirationMinutes = 5;

    /// <summary>
    /// Total submissions allowed against a single code. The caller may get the first
    /// <c>MaxVerificationAttempts - 1</c> wrong; the final one is their last chance before the code
    /// is invalidated and a new one must be requested.
    /// </summary>
    private const int MaxVerificationAttempts = 4;
    private const string CacheKeyPrefix = "passwordless_code:";
    private const string AttemptsKeyPrefix = "passwordless_attempts:";
    private const string UnknownPlaceholder = "unknown";

    private const string MaxAttemptsMessage = "Maximum verification attempts exceeded. Please request a new code.";

    /// <summary>
    /// Process-local gates that serialize the per-code verify budget's read-check-write per email, exactly
    /// as issuance serializes its own (see <see cref="VerificationThrottleService"/>). Without this a
    /// concurrent burst of guesses against one live code would each read the same attempt count, all pass
    /// the budget check, and each test a distinct guess for the price of a single increment — defeating the
    /// <see cref="MaxVerificationAttempts"/> limit. Striped for bounded memory; static because the service
    /// is scoped. Process-local like the issuance gate; true multi-instance atomicity needs the cache's own
    /// atomic increment/CAS (the Redis migration the throttle already flags).
    /// </summary>
    private const int VerifyGateCount = 64;

    private static readonly SemaphoreSlim[] VerifyGates =
        Enumerable.Range(0, VerifyGateCount).Select(_ => new SemaphoreSlim(1, 1)).ToArray();

    /// <summary>
    /// Initializes a new instance of the <see cref="VerificationChallengeService"/> class.
    /// </summary>
    /// <param name="logger">The logger instance.</param>
    /// <param name="userManager">The user manager instance.</param>
    /// <param name="emailSender">The email sender service.</param>
    /// <param name="cache">The distributed cache instance.</param>
    /// <param name="authResponseService">The auth response generation service.</param>
    /// <param name="accountAccessPolicy">Whether the account may authenticate.</param>
    /// <param name="throttleService">The verification-code issuance throttle.</param>
    /// <param name="debugConfiguration">The debug configuration.</param>
    public VerificationChallengeService(
        ILogger<VerificationChallengeService> logger,
        UserManager<ApplicationUser> userManager,
        IEmailSenderService emailSender,
        IDistributedCache cache,
        IAuthResponseService authResponseService,
        IAccountAccessPolicy accountAccessPolicy,
        IVerificationThrottleService throttleService,
        IOptions<DebugConfiguration> debugConfiguration)
    {
        _logger = logger;
        _userManager = userManager;
        _emailSender = emailSender;
        _cache = cache;
        _authResponseService = authResponseService;
        _accountAccessPolicy = accountAccessPolicy;
        _throttleService = throttleService;
        _skip2Fa = debugConfiguration.Value.Skip2FA;
    }

    /// <inheritdoc/>
    public async Task<Result<VerificationChallengeResponse>> SendVerificationCodeAsync(string email, VerificationIssuanceScope scope, ApplicationUser? user = null, CancellationToken cancellationToken = default)
    {
        try
        {
            // Throttle before resolving the user, keyed on the submitted address, in the caller-declared
            // scope. Each issuance surface (anonymous passwordless, password-verified 2FA, anonymous 2FA
            // resend) has its own backoff bucket, so flooding one cannot deny another — a user who knows
            // their password always gets a 2FA code, and a mid-login resend is not starved by anonymous
            // sign-in traffic. Running it first keeps unknown and known addresses indistinguishable.
            Result<DateTime> throttleResult = await _throttleService.RegisterIssuanceAsync(email, scope, cancellationToken);
            if (throttleResult.IsFailed)
            {
                return Result.Fail(throttleResult.Errors);
            }

            DateTime resendAvailableAt = throttleResult.Value;

            // Reset the per-email attempt budget on every issuance that clears the throttle — for real
            // and non-existent addresses alike. verify-code consumes this same budget for every address,
            // so resetting it here regardless of whether a code is actually cached keeps a real account's
            // "request a new code → fresh budget" recovery indistinguishable from a non-account's.
            await WriteAttemptsAsync(email, 0, cancellationToken);

            user ??= await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                _logger.LogWarning("Passwordless sign-in / 2FA attempted for non-existent email: {Email}", email);
                return Result.Ok(BuildChallengeResponse(resendAvailableAt));
            }

            // Suspended / Retired / Anonymized accounts get a fake success — no mutation, no email.
            if (!_accountAccessPolicy.CanAuthenticate(user))
            {
                _logger.LogWarning("Passwordless sign-in / 2FA attempted for inactive user: {UserId}", user.Id);
                return Result.Ok(BuildChallengeResponse(resendAvailableAt));
            }

            if (!user.EmailConfirmed)
            {
                _logger.LogWarning("Passwordless sign-in / 2FA attempted for user with unconfirmed email: {UserId}", user.Id);
                return Result.Ok(BuildChallengeResponse(resendAvailableAt));
            }

            if (!user.UsePasswordlessLogin && !user.TwoFactorEnabled)
            {
                _logger.LogWarning("Passwordless sign-in / 2FA attempted for user without permission: {UserId}", user.Id);
                return Result.Ok(BuildChallengeResponse(resendAvailableAt));
            }

            if (_skip2Fa && user.TwoFactorEnabled)
            {
                _logger.LogWarning("DEBUG Skip2FA enabled. Skipping verification email for 2FA user {UserId} ({Email}).", user.Id, email);
                return Result.Ok(BuildChallengeResponse(resendAvailableAt));
            }

            string code = GenerateVerificationCode();
            DateTime expiresAt = DateTime.UtcNow.AddMinutes(CodeExpirationMinutes);

            DistributedCacheEntryOptions cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpiration = expiresAt
            };

            // The attempt budget was already reset above, for every address; only a real, eligible
            // account reaches here and additionally gets a code cached to match against.
            await _cache.SetStringAsync(BuildCodeKey(email), code, cacheOptions, cancellationToken);

            await _emailSender.SendVerificationCodeAsync(user, email, code, expiresAt, cancellationToken);
            _logger.LogInformation("Verification code sent to user {UserId} at {Email}", user.Id, email);

            return Result.Ok(new VerificationChallengeResponse
            {
                ExpiresAt = expiresAt,
                ResendAvailableAt = resendAvailableAt
            });
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            // Unexpected fault → ExceptionalError maps to 500 (retryable), not an untyped 400.
            _logger.LogError(ex, "Error sending verification code to {Email}", email);
            return Result.Fail(new ExceptionalError("Failed to send verification code. Please try again.", ex));
        }
    }

    /// <summary>
    /// Builds the response returned when no code is actually issued, so that callers cannot tell a
    /// real, eligible account from one that was skipped.
    /// </summary>
    private static VerificationChallengeResponse BuildChallengeResponse(DateTime resendAvailableAt) =>
        new()
        {
            ExpiresAt = DateTime.UtcNow.AddMinutes(CodeExpirationMinutes),
            ResendAvailableAt = resendAvailableAt
        };

    /// <inheritdoc/>
    public async Task<Result<AuthResponse>> VerifyCodeAndAuthenticateAsync(string email, string code, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByEmailAsync(email);

            if (_skip2Fa && user is { TwoFactorEnabled: true } && _accountAccessPolicy.CanAuthenticate(user))
            {
                _logger.LogWarning("DEBUG Skip2FA enabled. Accepting any verification code for 2FA user {UserId} ({Email}).", user.Id, email);

                await InvalidateCodeAsync(email, cancellationToken);

                user.LastLoginAt = DateTime.UtcNow;
                await _userManager.UpdateAsync(user);

                return await _authResponseService.GenerateAuthResponseAsync(user, ipAddress, userAgent, cancellationToken: cancellationToken);
            }

            // Every failing branch below returns the same shape for every address. A correct code is the
            // only way to succeed, and only a real, eligible account can ever have one cached (issuance
            // gates on active + confirmed + enabled before caching), so a caller submitting guesses walks
            // the identical 401-then-400 sequence whether the address is a live account, an expired code,
            // an inactive account, or no account at all. That closes the "wrong code = 401, everything
            // else = 400" oracle: verify-code no longer confirms whether an address has an account. The
            // cost is that an honest user whose code has genuinely expired is told "invalid code" instead
            // of "expired", but the client blocks submission once its own expiry countdown reaches zero,
            // so that path is only reached on clock skew.
            // Serialize the budget's read-check-write per email so a concurrent burst of guesses against
            // one live code can't each pass the check and test a distinct guess for a single increment
            // (see VerifyGates). The matched code is also invalidated inside the gate, so a second
            // concurrent valid submission can't reuse it; only the expensive token-generation success path
            // runs after the gate is released.
            SemaphoreSlim gate = GetVerifyGate(email);
            await gate.WaitAsync(cancellationToken);
            try
            {
                int attempts = await ReadAttemptsAsync(email, cancellationToken);

                // Budget already spent (real or phantom). Sticky: the counter is left in place so repeated
                // probes keep getting the same exhausted response until it expires or a new code is issued —
                // which resets the budget for every address, real or not (see SendVerificationCodeAsync).
                if (attempts >= MaxVerificationAttempts)
                {
                    _logger.LogWarning("Max verification attempts exceeded for {Email}", email);
                    await _cache.RemoveAsync(BuildCodeKey(email), cancellationToken);
                    return Result.Fail(new VerificationCodeExhaustedError(MaxAttemptsMessage));
                }

                string? storedCode = await _cache.GetStringAsync(BuildCodeKey(email), cancellationToken);

                // Guard the success path on an eligible user as well as a matching code. Codes are only
                // cached for authenticable accounts; Suspended / Retired / Anonymized and unknown
                // addresses never authenticate.
                bool userEligibleForVerify = _accountAccessPolicy.CanAuthenticate(user);
                bool codeMatches =
                    userEligibleForVerify
                    && !string.IsNullOrEmpty(storedCode)
                    && string.Equals(storedCode, code, StringComparison.OrdinalIgnoreCase);

                if (!codeMatches)
                {
                    // Wrong code, expired/absent code, or no account at all — each consumes one attempt from
                    // the same per-email budget and returns the same 401 (or 400 once spent), indistinguishably.
                    attempts++;
                    int remainingAttempts = Math.Max(0, MaxVerificationAttempts - attempts);

                    await WriteAttemptsAsync(email, attempts, cancellationToken);

                    _logger.LogWarning("Invalid verification code for {Email}. Attempt {Attempts}/{Max}",
                        email, attempts, MaxVerificationAttempts);

                    if (remainingAttempts == 0)
                    {
                        await _cache.RemoveAsync(BuildCodeKey(email), cancellationToken);
                        return Result.Fail(new VerificationCodeExhaustedError(MaxAttemptsMessage));
                    }

                    return Result.Fail(new VerificationAttemptsError(
                        $"Invalid verification code. {remainingAttempts} attempts remaining.",
                        remainingAttempts));
                }

                // Correct code: invalidate it while still holding the gate so a racing valid submission
                // for the same code finds nothing to match and can't mint a second session.
                await InvalidateCodeAsync(email, cancellationToken);
            }
            finally
            {
                gate.Release();
            }

            // Past the gate: the code was accepted and already single-used. The remaining work is
            // per-user and does not touch the shared budget, so it need not hold the gate.

            // A successful sign-in clears the issuance backoff so the user is not left throttled.
            await _throttleService.ClearAsync(email, cancellationToken);

            user!.LastLoginAt = DateTime.UtcNow;
            await _userManager.UpdateAsync(user);

            Result<AuthResponse> authResponse = await _authResponseService.GenerateAuthResponseAsync(user, ipAddress, userAgent, cancellationToken: cancellationToken);

            if (authResponse.IsFailed)
            {
                return authResponse;
            }

            _logger.LogInformation("User {UserId} successfully authenticated via passwordless flow from IP {IpAddress}", user.Id, ipAddress ?? UnknownPlaceholder);

            return authResponse;
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            // A failure here is an unexpected infrastructure fault (e.g. a transient database error
            // from a cold connection), not a rejected code. An ExceptionalError maps to a 500 (see
            // HandleFluentResult) so the client treats it as retryable, instead of the untyped 400
            // that the UI would misreport to the user as an invalid verification code.
            _logger.LogError(ex, "Error verifying code for {Email}", email);
            return Result.Fail(new ExceptionalError("Verification failed. Please try again.", ex));
        }
    }

    /// <summary>
    /// Generates a random 6-digit verification code.
    /// </summary>
    private static string GenerateVerificationCode()
    {
        int generatedCode = RandomNumberGenerator.GetInt32(100000, 999999);
        return generatedCode.ToString();
    }

    /// <summary>
    /// Invalidates the verification code and attempt budget for an email. Used on a successful sign-in
    /// to leave a clean slate; failure paths remove only the code so the spent budget stays sticky.
    /// </summary>
    private async Task InvalidateCodeAsync(string email, CancellationToken cancellationToken = default)
    {
        await _cache.RemoveAsync(BuildCodeKey(email), cancellationToken);
        await _cache.RemoveAsync(BuildAttemptsKey(email), cancellationToken);
    }

    private static string BuildCodeKey(string email) => $"{CacheKeyPrefix}{VerificationEmailKey.Normalize(email)}";

    private static string BuildAttemptsKey(string email) => $"{AttemptsKeyPrefix}{VerificationEmailKey.Normalize(email)}";

    /// <summary>
    /// Maps an email to its serializing verify gate. Keyed on the attempts cache key so the gate matches
    /// the resource it guards. The cast through <c>uint</c> keeps the index non-negative for any hash.
    /// </summary>
    private static SemaphoreSlim GetVerifyGate(string email)
    {
        int index = (int)((uint)BuildAttemptsKey(email).GetHashCode(StringComparison.Ordinal) % VerifyGateCount);
        return VerifyGates[index];
    }

    /// <summary>
    /// Reads the current attempt count for an email, treating a missing or unparseable value as zero.
    /// </summary>
    private async Task<int> ReadAttemptsAsync(string email, CancellationToken cancellationToken)
    {
        string? raw = await _cache.GetStringAsync(BuildAttemptsKey(email), cancellationToken);
        return int.TryParse(raw, out int parsed) ? parsed : 0;
    }

    /// <summary>
    /// Persists the attempt count for an email with a lifetime matching the code window, so the budget
    /// ages out on its own if the caller walks away.
    /// </summary>
    private Task WriteAttemptsAsync(string email, int attempts, CancellationToken cancellationToken) =>
        _cache.SetStringAsync(
            BuildAttemptsKey(email),
            attempts.ToString(),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CodeExpirationMinutes) },
            cancellationToken);
}
