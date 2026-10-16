using FluentResults;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class PlatformAiQuotaService(
    ILogger<PlatformAiQuotaService> _logger,
    IUserPlatformAiUsageRepository _usageRepository,
    IOptions<PlatformAiQuotaConfiguration> _quotaOptions) : IPlatformAiQuotaService
{
    /// <inheritdoc/>
    public async Task<Result<PlatformAiUsageDto>> GetUsageAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        PlatformAiQuotaConfiguration config = _quotaOptions.Value;
        DateTime utcNow = DateTime.UtcNow;
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(utcNow);

        long tokensUsed;
        try
        {
            tokensUsed = await _usageRepository.GetTokensUsedAsync(userId, periodKey, cancellationToken);
        }
        catch (Exception ex) when (PostgresExceptionHelper.IsUndefinedTable(ex))
        {
            _logger.LogWarning(
                ex,
                "Platform AI usage table is missing; returning zero usage for user {UserId}. Apply pending EF migrations.",
                userId);
            tokensUsed = 0;
        }

        long tokenLimit = config.MonthlyTokenLimit;

        PlatformAiUsageDto usage = BuildUsageDto(tokensUsed, tokenLimit, periodKey, utcNow, config.Enabled);
        return Result.Ok(usage);
    }

    /// <inheritdoc/>
    public async Task<Result> EnsureCanUsePlatformModelAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        PlatformAiQuotaConfiguration config = _quotaOptions.Value;
        if (!config.Enabled)
        {
            return Result.Ok();
        }

        DateTime utcNow = DateTime.UtcNow;
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(utcNow);

        long tokensUsed;
        try
        {
            tokensUsed = await _usageRepository.GetTokensUsedAsync(userId, periodKey, cancellationToken);
        }
        catch (Exception ex) when (PostgresExceptionHelper.IsUndefinedTable(ex))
        {
            _logger.LogWarning(
                ex,
                "Platform AI usage table is missing; allowing platform model use for user {UserId}. Apply pending EF migrations.",
                userId);
            return Result.Ok();
        }

        long tokenLimit = config.MonthlyTokenLimit;

        if (tokensUsed < tokenLimit)
        {
            return Result.Ok();
        }

        DateTime resetsAtUtc = PlatformAiQuotaPeriod.GetResetsAtUtc(utcNow);

        _logger.LogInformation(
            "Platform AI quota blocked for user {UserId}: {TokensUsed}/{TokenLimit} in period {PeriodKey}",
            userId,
            tokensUsed,
            tokenLimit,
            periodKey);

        return Result.Fail(new PlatformAiQuotaExceededError(
            PlatformAiQuotaFormatting.BuildExceededMessage(tokenLimit, resetsAtUtc),
            tokensUsed,
            tokenLimit,
            resetsAtUtc));
    }

    /// <inheritdoc/>
    public async Task RecordUsageAsync(
        Guid userId,
        PlatformAiUsageRecordContext context,
        CancellationToken cancellationToken = default)
    {
        PlatformAiQuotaConfiguration config = _quotaOptions.Value;
        if (!config.Enabled || context.TotalTokens <= 0)
        {
            return;
        }

        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(DateTime.UtcNow);
        try
        {
            await _usageRepository.RecordUsageAsync(userId, periodKey, context, cancellationToken);

            _logger.LogDebug(
                "Recorded {TotalTokens} platform AI tokens for user {UserId} in tenant {TenantId} for period {PeriodKey}",
                context.TotalTokens,
                userId,
                context.TenantId,
                periodKey);
        }
        catch (Exception ex) when (PostgresExceptionHelper.IsUndefinedTable(ex))
        {
            _logger.LogWarning(
                ex,
                "Platform AI usage table is missing; skipped recording {TotalTokens} tokens for user {UserId}. Apply pending EF migrations.",
                context.TotalTokens,
                userId);
        }
    }

    private static PlatformAiUsageDto BuildUsageDto(
        long tokensUsed,
        long tokenLimit,
        string periodKey,
        DateTime utcNow,
        bool isEnforcementEnabled)
    {
        return new PlatformAiUsageDto
        {
            TokensUsed = tokensUsed,
            TokenLimit = tokenLimit,
            PeriodKey = periodKey,
            ResetsAtUtc = PlatformAiQuotaPeriod.GetResetsAtUtc(utcNow),
            PercentUsed = PlatformAiQuotaPeriod.CalculatePercentUsed(tokensUsed, tokenLimit),
            IsLimitReached = isEnforcementEnabled && tokensUsed >= tokenLimit,
            IsEnforcementEnabled = isEnforcementEnabled,
        };
    }
}
