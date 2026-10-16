using System.Threading.RateLimiting;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

/// <summary>
/// Pins the framework assumption the anonymous rate-limit backstop relies on: a rejected
/// <see cref="FixedWindowRateLimiter"/> lease, configured as the identity policy configures it,
/// exposes <see cref="MetadataName.RetryAfter"/>. Program.cs's <c>OnRejected</c> reads exactly that to
/// populate the <c>Retry-After</c> header and <c>retryAfter</c> body; without the metadata the fix is
/// a silent no-op, so this guards against a runtime/behaviour change quietly disabling it.
/// </summary>
public class RateLimiterRetryAfterMetadataTests
{
    private static FixedWindowRateLimiterOptions IdentityPolicyOptions() =>
        new()
        {
            PermitLimit = Math.Max(1, RateLimitingDefaults.IdentityAnonymousPermitLimit),
            Window = TimeSpan.FromSeconds(Math.Max(1, RateLimitingDefaults.IdentityAnonymousWindowSeconds)),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0,
            AutoReplenishment = true,
        };

    [Fact]
    public async Task RejectedLease_ExposesRetryAfterMetadata_WithinTheConfiguredWindow()
    {
        using FixedWindowRateLimiter limiter = new(IdentityPolicyOptions());

        // Drain the window so the next acquisition is rejected.
        for (int i = 0; i < RateLimitingDefaults.IdentityAnonymousPermitLimit; i++)
        {
            using RateLimitLease permitted = await limiter.AcquireAsync(permitCount: 1);
            Assert.True(permitted.IsAcquired);
        }

        using RateLimitLease rejected = await limiter.AcquireAsync(permitCount: 1);

        Assert.False(rejected.IsAcquired);
        Assert.True(
            rejected.TryGetMetadata(MetadataName.RetryAfter, out TimeSpan retryAfter),
            "FixedWindowRateLimiter must expose RetryAfter metadata on a rejected lease.");
        Assert.InRange(
            retryAfter,
            TimeSpan.Zero,
            TimeSpan.FromSeconds(RateLimitingDefaults.IdentityAnonymousWindowSeconds));
    }
}
