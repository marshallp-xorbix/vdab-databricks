using FluentResults;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Escalating per-email backoff for verification-code issuance, backed by the distributed cache.
/// The read-check-write is serialized per (email, scope) by an in-process gate so a concurrent burst of
/// requests for one address cannot each pass the window check and fan out a batch of codes. That guard
/// is process-local; a multi-instance deployment needs the cache's own atomic increment/CAS — i.e. the
/// Redis migration the passwordless flow already requires to scale out (the per-instance memory cache
/// breaks code verification outright under scale-out, so this is not a new constraint).
/// </summary>
public class VerificationThrottleService : IVerificationThrottleService
{
    private readonly ILogger<VerificationThrottleService> _logger;

    // TODO: move cache out of service layer
    private readonly IDistributedCache _cache;

    private const string AnonymousKeyPrefix = "passwordless_issuance:";
    private const string PasswordVerifiedKeyPrefix = "passwordless_issuance_pw:";
    private const string TwoFactorResendKeyPrefix = "passwordless_issuance_2fa_resend:";
    private const string ThrottledMessage = "Too many verification code requests. Please wait before requesting another code.";

    /// <summary>
    /// Delay enforced before the next code may be issued, indexed by how many codes have already been
    /// issued in the current window. The first request is immediate; the last entry is the cap.
    /// </summary>
    private static readonly TimeSpan[] BackoffAfterIssuance =
    [
        TimeSpan.FromSeconds(60),
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromMinutes(30),
    ];

    /// <summary>
    /// Idle period after which the backoff resets. Sliding, so a caller who keeps probing stays
    /// throttled while a user who walks away starts clean.
    /// </summary>
    private static readonly TimeSpan IssuanceStateIdleLifetime = TimeSpan.FromHours(1);

    /// <summary>
    /// Process-local gates that serialize the issuance read-check-write per (email, scope). Striped by a
    /// fixed pool rather than one lock per address so memory stays bounded; a hash collision merely
    /// serializes two unrelated addresses briefly, which is harmless. The service is scoped, so these
    /// must be static to be shared across the per-request instances.
    /// </summary>
    private const int IssuanceGateCount = 64;

    private static readonly SemaphoreSlim[] IssuanceGates =
        Enumerable.Range(0, IssuanceGateCount).Select(_ => new SemaphoreSlim(1, 1)).ToArray();

    /// <summary>
    /// Initializes a new instance of the <see cref="VerificationThrottleService"/> class.
    /// </summary>
    /// <param name="logger">The logger instance.</param>
    /// <param name="cache">The distributed cache instance.</param>
    public VerificationThrottleService(
        ILogger<VerificationThrottleService> logger,
        IDistributedCache cache)
    {
        _logger = logger;
        _cache = cache;
    }

    /// <inheritdoc/>
    public async Task<Result<DateTime>> RegisterIssuanceAsync(string email, VerificationIssuanceScope scope, CancellationToken cancellationToken = default)
    {
        string cacheKey = BuildKey(email, scope);
        SemaphoreSlim gate = GetIssuanceGate(cacheKey);

        // Serialize the read-check-write so a concurrent burst for one address cannot all read the same
        // (or absent) state, all pass the window check, and all fan out a code — email-bombing the victim
        // and collapsing the escalation to a single step (last-writer-wins). Only the first request
        // through the gate records an issuance; the rest read it and back off.
        await gate.WaitAsync(cancellationToken);
        try
        {
            IssuanceState? state = await ReadStateAsync(cacheKey, cancellationToken);
            DateTime now = DateTime.UtcNow;

            if (state != null)
            {
                DateTime allowedAt = state.LastIssuedAtUtc.Add(DelayAfter(state.IssuanceCount));
                if (now < allowedAt)
                {
                    _logger.LogWarning(
                        "Verification code request throttled for {Email} on {Scope} bucket. Next allowed at {AllowedAt}",
                        email, scope, allowedAt);
                    return Result.Fail(new TooManyRequestsError(ThrottledMessage, allowedAt));
                }
            }

            int issuanceCount = (state?.IssuanceCount ?? 0) + 1;
            await WriteStateAsync(cacheKey, new IssuanceState(issuanceCount, now), cancellationToken);

            return Result.Ok(now.Add(DelayAfter(issuanceCount)));
        }
        finally
        {
            gate.Release();
        }
    }

    /// <inheritdoc/>
    public async Task ClearAsync(string email, CancellationToken cancellationToken = default)
    {
        // The verify path that calls this does not know which scope issued the code, and a successful
        // sign-in should leave the user throttled on neither bucket, so both are cleared. Each removal
        // takes the same per-key gate RegisterIssuanceAsync uses, so a racing issuance cannot read state,
        // have it cleared out from under it, then write an incremented count back — which would resurrect
        // the backoff for a user who just signed in.
        foreach (VerificationIssuanceScope scope in
                 new[]
                 {
                     VerificationIssuanceScope.Anonymous,
                     VerificationIssuanceScope.PasswordVerified,
                     VerificationIssuanceScope.TwoFactorResend,
                 })
        {
            string cacheKey = BuildKey(email, scope);
            SemaphoreSlim gate = GetIssuanceGate(cacheKey);

            await gate.WaitAsync(cancellationToken);
            try
            {
                await _cache.RemoveAsync(cacheKey, cancellationToken);
            }
            finally
            {
                gate.Release();
            }
        }
    }

    private static string BuildKey(string email, VerificationIssuanceScope scope)
    {
        string prefix = scope switch
        {
            VerificationIssuanceScope.PasswordVerified => PasswordVerifiedKeyPrefix,
            VerificationIssuanceScope.TwoFactorResend => TwoFactorResendKeyPrefix,
            _ => AnonymousKeyPrefix,
        };
        return $"{prefix}{VerificationEmailKey.Normalize(email)}";
    }

    /// <summary>
    /// Maps a cache key to its serializing gate. Keyed on the full cache key (which already includes the
    /// scope prefix) so the two scopes for one address use independent gates, matching their independent
    /// buckets. The cast through <c>uint</c> keeps the index non-negative for any hash, including
    /// <see cref="int.MinValue"/>.
    /// </summary>
    private static SemaphoreSlim GetIssuanceGate(string cacheKey)
    {
        int index = (int)((uint)cacheKey.GetHashCode(StringComparison.Ordinal) % IssuanceGateCount);
        return IssuanceGates[index];
    }

    private static TimeSpan DelayAfter(int issuanceCount)
    {
        int index = Math.Clamp(issuanceCount - 1, 0, BackoffAfterIssuance.Length - 1);
        return BackoffAfterIssuance[index];
    }

    private async Task<IssuanceState?> ReadStateAsync(string cacheKey, CancellationToken cancellationToken)
    {
        string? raw = await _cache.GetStringAsync(cacheKey, cancellationToken);
        if (string.IsNullOrEmpty(raw))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<IssuanceState>(raw);
        }
        catch (JsonException exception)
        {
            // Corrupt or stale-format entry: treat as no state rather than locking the user out of
            // requesting a code entirely.
            _logger.LogWarning(exception, "Discarding unreadable verification throttle state for key {CacheKey}", cacheKey);
            return null;
        }
    }

    private async Task WriteStateAsync(string cacheKey, IssuanceState state, CancellationToken cancellationToken)
    {
        await _cache.SetStringAsync(
            cacheKey,
            JsonSerializer.Serialize(state),
            new DistributedCacheEntryOptions { SlidingExpiration = IssuanceStateIdleLifetime },
            cancellationToken);
    }

    /// <summary>
    /// Backoff state persisted per email: how many codes have been issued in the current window and
    /// when the most recent one went out.
    /// </summary>
    private sealed record IssuanceState(int IssuanceCount, DateTime LastIssuedAtUtc);
}
