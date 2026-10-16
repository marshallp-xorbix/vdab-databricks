using FluentResults;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies the escalating per-email backoff that bounds how often verification codes can be issued.
/// This is the primary brute-force control for the passwordless / 2FA flow, since the per-code attempt
/// limit resets whenever a new code is issued.
/// </summary>
public class VerificationThrottleServiceTests
{
    private const string Email = "user@example.com";

    private static VerificationThrottleService CreateService(IDistributedCache cache) =>
        new(NullLogger<VerificationThrottleService>.Instance, cache);

    private static IDistributedCache CreateCache() =>
        new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));

    [Fact]
    public async Task RegisterIssuanceAsync_OnFirstRequest_IsAllowedImmediately()
    {
        VerificationThrottleService service = CreateService(CreateCache());

        Result<DateTime> result = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        Assert.True(result.IsSuccess);
        // The first code is free; the next one is gated 60 seconds out.
        Assert.InRange(result.Value, DateTime.UtcNow.AddSeconds(50), DateTime.UtcNow.AddSeconds(70));
    }

    [Fact]
    public async Task RegisterIssuanceAsync_WhenInsideBackoffWindow_ReturnsTooManyRequests()
    {
        VerificationThrottleService service = CreateService(CreateCache());
        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        Result<DateTime> result = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<TooManyRequestsError>());
    }

    [Fact]
    public async Task RegisterIssuanceAsync_WhenThrottled_ReportsWhenTheCallerMayRetry()
    {
        VerificationThrottleService service = CreateService(CreateCache());
        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        Result<DateTime> result = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        TooManyRequestsError error = Assert.Single(result.Errors.OfType<TooManyRequestsError>());
        Assert.InRange(error.RetryAfterUtc, DateTime.UtcNow, DateTime.UtcNow.AddSeconds(70));
    }

    [Fact]
    public async Task RegisterIssuanceAsync_ThrottlesEachEmailIndependently()
    {
        IDistributedCache cache = CreateCache();
        VerificationThrottleService service = CreateService(cache);
        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        Result<DateTime> otherEmailResult = await service.RegisterIssuanceAsync("someone.else@example.com", VerificationIssuanceScope.Anonymous);

        Assert.True(otherEmailResult.IsSuccess);
    }

    [Fact]
    public async Task RegisterIssuanceAsync_NormalizesEmailCasingAndWhitespace()
    {
        VerificationThrottleService service = CreateService(CreateCache());
        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        // Same identity, different spelling — must hit the same throttle bucket.
        Result<DateTime> result = await service.RegisterIssuanceAsync("  USER@Example.COM  ", VerificationIssuanceScope.Anonymous);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<TooManyRequestsError>());
    }

    [Fact]
    public async Task RegisterIssuanceAsync_AfterClear_IsAllowedImmediatelyAgain()
    {
        VerificationThrottleService service = CreateService(CreateCache());
        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        await service.ClearAsync(Email);
        Result<DateTime> result = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task RegisterIssuanceAsync_EscalatesTheDelayAsCodesAccumulate()
    {
        IDistributedCache cache = CreateCache();
        VerificationThrottleService service = CreateService(cache);

        // Drive the counter forward without waiting out each window by rewinding the recorded
        // issuance time, which is what the backoff is measured from.
        DateTime firstNextAllowed = (await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous)).Value;
        await RewindLastIssuedAsync(cache, TimeSpan.FromHours(1));

        DateTime secondNextAllowed = (await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous)).Value;
        await RewindLastIssuedAsync(cache, TimeSpan.FromHours(1));

        DateTime thirdNextAllowed = (await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous)).Value;

        // 60s, then 2m, then 5m — each window strictly longer than the last.
        Assert.True(SecondsUntil(secondNextAllowed) > SecondsUntil(firstNextAllowed));
        Assert.True(SecondsUntil(thirdNextAllowed) > SecondsUntil(secondNextAllowed));
    }

    [Fact]
    public async Task RegisterIssuanceAsync_ThrottlesEachScopeIndependently()
    {
        VerificationThrottleService service = CreateService(CreateCache());

        // Drive the anonymous bucket into backoff, as an attacker who only knows the address can.
        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);
        Result<DateTime> anonymousThrottled = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        // The other scopes for the same address must be untouched by that anonymous traffic.
        Result<DateTime> passwordVerified = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.PasswordVerified);
        Result<DateTime> twoFactorResend = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.TwoFactorResend);

        Assert.True(anonymousThrottled.IsFailed);
        Assert.True(anonymousThrottled.HasError<TooManyRequestsError>());
        Assert.True(passwordVerified.IsSuccess);
        Assert.True(twoFactorResend.IsSuccess);
    }

    [Fact]
    public async Task ClearAsync_ResetsEveryScope()
    {
        VerificationThrottleService service = CreateService(CreateCache());
        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);
        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.PasswordVerified);
        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.TwoFactorResend);

        await service.ClearAsync(Email);

        Result<DateTime> anonymous = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);
        Result<DateTime> passwordVerified = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.PasswordVerified);
        Result<DateTime> twoFactorResend = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.TwoFactorResend);

        Assert.True(anonymous.IsSuccess);
        Assert.True(passwordVerified.IsSuccess);
        Assert.True(twoFactorResend.IsSuccess);
    }

    [Fact]
    public async Task RegisterIssuanceAsync_UnderConcurrentBurst_AllowsOneAndThrottlesTheRest()
    {
        VerificationThrottleService service = CreateService(CreateCache());

        // Hold every request on a start gate, then release them together so their read-check-write
        // windows overlap on the thread pool. Without serialization they would each read the empty
        // state, all pass the window check, and all be issued a code — email-bombing the victim. The
        // gate must collapse the burst to a single issuance.
        const int burst = 25;
        using SemaphoreSlim start = new(0, burst);
        Task<Result<DateTime>>[] requests = Enumerable
            .Range(0, burst)
            .Select(_ => Task.Run(async () =>
            {
                await start.WaitAsync();
                return await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);
            }))
            .ToArray();

        start.Release(burst);
        Result<DateTime>[] results = await Task.WhenAll(requests);

        Assert.Equal(1, results.Count(result => result.IsSuccess));
        Assert.Equal(burst - 1, results.Count(result => result.HasError<TooManyRequestsError>()));
    }

    [Fact]
    public async Task RegisterIssuanceAsync_AfterIdleLifetimeElapses_ResetsToTheFirstStep()
    {
        // Drive the cache's own clock so the 1-hour sliding lifetime can be crossed without waiting. The
        // service reads real UtcNow for its backoff math; the fake clock only ages out the cache entry.
        MutableSystemClock clock = new(DateTimeOffset.UtcNow);
        IDistributedCache cache = new MemoryDistributedCache(
            Options.Create(new MemoryDistributedCacheOptions { Clock = clock }));
        VerificationThrottleService service = CreateService(cache);

        await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        // Walk past the idle lifetime so the sliding entry expires. A user who walked away must start
        // clean: the next request is allowed (not throttled) and back at the first step, not escalated.
        clock.Advance(TimeSpan.FromHours(1) + TimeSpan.FromMinutes(1));

        Result<DateTime> afterIdle = await service.RegisterIssuanceAsync(Email, VerificationIssuanceScope.Anonymous);

        Assert.True(afterIdle.IsSuccess);
        // First step again: next allowed ~60s out, not an escalated 2m+.
        Assert.InRange(afterIdle.Value, DateTime.UtcNow.AddSeconds(50), DateTime.UtcNow.AddSeconds(70));
    }

    private static double SecondsUntil(DateTime instant) => (instant - DateTime.UtcNow).TotalSeconds;

    /// <summary>
    /// Moves the persisted "last issued" timestamp back so the next call is outside the backoff
    /// window, letting a test advance the escalation without real waiting.
    /// </summary>
    private static async Task RewindLastIssuedAsync(IDistributedCache cache, TimeSpan amount)
    {
        string cacheKey = $"passwordless_issuance:{Email}";
        string raw = (await cache.GetStringAsync(cacheKey))!;

        using System.Text.Json.JsonDocument document = System.Text.Json.JsonDocument.Parse(raw);
        int issuanceCount = document.RootElement.GetProperty("IssuanceCount").GetInt32();
        DateTime lastIssuedAtUtc = document.RootElement.GetProperty("LastIssuedAtUtc").GetDateTime();

        string rewound = System.Text.Json.JsonSerializer.Serialize(new
        {
            IssuanceCount = issuanceCount,
            LastIssuedAtUtc = lastIssuedAtUtc.Subtract(amount),
        });

        await cache.SetStringAsync(cacheKey, rewound);
    }

    /// <summary>
    /// A hand-advanceable <see cref="Microsoft.Extensions.Internal.ISystemClock"/> so a test can drive the
    /// cache's sliding expiration forward without real waiting.
    /// </summary>
    private sealed class MutableSystemClock(DateTimeOffset start) : Microsoft.Extensions.Internal.ISystemClock
    {
        private DateTimeOffset _utcNow = start;

        public DateTimeOffset UtcNow => _utcNow;

        public void Advance(TimeSpan by) => _utcNow = _utcNow.Add(by);
    }
}
