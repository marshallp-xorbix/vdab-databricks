using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Npgsql;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

public class PlatformAiQuotaServiceTests
{
    private static readonly Guid UserId = Guid.Parse("7c9e6679-7425-40de-944b-e07fc1f90ae7");
    private static readonly Guid TenantId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");

    [Fact]
    public async Task GetUsageAsync_ReturnsCurrentPeriodSnapshot()
    {
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(DateTime.UtcNow);
        Mock<IUserPlatformAiUsageRepository> repository = new();
        repository
            .Setup(repo => repo.GetTokensUsedAsync(UserId, periodKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(25_000L);

        PlatformAiQuotaService service = CreateService(repository.Object, enabled: true, limit: 100_000);

        Result<PlatformAiUsageDto> result = await service.GetUsageAsync(UserId);

        Assert.True(result.IsSuccess);
        Assert.Equal(25_000, result.Value.TokensUsed);
        Assert.Equal(100_000, result.Value.TokenLimit);
        Assert.Equal(periodKey, result.Value.PeriodKey);
        Assert.Equal(25, result.Value.PercentUsed);
        Assert.False(result.Value.IsLimitReached);
        Assert.True(result.Value.IsEnforcementEnabled);
    }

    [Fact]
    public async Task EnsureCanUsePlatformModelAsync_AllowsWhenUnderLimit()
    {
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(DateTime.UtcNow);
        Mock<IUserPlatformAiUsageRepository> repository = new();
        repository
            .Setup(repo => repo.GetTokensUsedAsync(UserId, periodKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(99_999L);

        PlatformAiQuotaService service = CreateService(repository.Object);

        Result result = await service.EnsureCanUsePlatformModelAsync(UserId);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task EnsureCanUsePlatformModelAsync_BlocksWhenAtLimit()
    {
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(DateTime.UtcNow);
        Mock<IUserPlatformAiUsageRepository> repository = new();
        repository
            .Setup(repo => repo.GetTokensUsedAsync(UserId, periodKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(100_000L);

        PlatformAiQuotaService service = CreateService(repository.Object);

        Result result = await service.EnsureCanUsePlatformModelAsync(UserId);

        Assert.True(result.IsFailed);
        Assert.IsType<PlatformAiQuotaExceededError>(result.Errors.First());
    }

    [Fact]
    public async Task EnsureCanUsePlatformModelAsync_SkipsWhenDisabled()
    {
        Mock<IUserPlatformAiUsageRepository> repository = new();
        PlatformAiQuotaService service = CreateService(repository.Object, enabled: false);

        Result result = await service.EnsureCanUsePlatformModelAsync(UserId);

        Assert.True(result.IsSuccess);
        repository.Verify(
            repo => repo.GetTokensUsedAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RecordUsageAsync_PersistsLedgerAndCounter()
    {
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(DateTime.UtcNow);
        Mock<IUserPlatformAiUsageRepository> repository = new();
        PlatformAiUsageRecordContext context = new()
        {
            TotalTokens = 1200,
            InputTokens = 800,
            OutputTokens = 400,
            TenantId = TenantId,
            AppId = 42,
        };

        PlatformAiQuotaService service = CreateService(repository.Object);

        await service.RecordUsageAsync(UserId, context);

        repository.Verify(
            repo => repo.RecordUsageAsync(UserId, periodKey, context, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task GetUsageAsync_ReturnsZeroUsageWhenUsageTableMissing()
    {
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(DateTime.UtcNow);
        Mock<IUserPlatformAiUsageRepository> repository = new();
        repository
            .Setup(repo => repo.GetTokensUsedAsync(UserId, periodKey, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new PostgresException("42P01: relation does not exist", severity: string.Empty, invariantSeverity: string.Empty, sqlState: PostgresExceptionHelper.UndefinedTableSqlState));

        PlatformAiQuotaService service = CreateService(repository.Object);

        Result<PlatformAiUsageDto> result = await service.GetUsageAsync(UserId);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value.TokensUsed);
        Assert.False(result.Value.IsLimitReached);
    }

    [Fact]
    public async Task EnsureCanUsePlatformModelAsync_AllowsWhenUsageTableMissing()
    {
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(DateTime.UtcNow);
        Mock<IUserPlatformAiUsageRepository> repository = new();
        repository
            .Setup(repo => repo.GetTokensUsedAsync(UserId, periodKey, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new PostgresException("42P01: relation does not exist", severity: string.Empty, invariantSeverity: string.Empty, sqlState: PostgresExceptionHelper.UndefinedTableSqlState));

        PlatformAiQuotaService service = CreateService(repository.Object);

        Result result = await service.EnsureCanUsePlatformModelAsync(UserId);

        Assert.True(result.IsSuccess);
    }

    private static PlatformAiQuotaService CreateService(
        IUserPlatformAiUsageRepository repository,
        bool enabled = true,
        long limit = 100_000)
    {
        IOptions<PlatformAiQuotaConfiguration> options = Options.Create(new PlatformAiQuotaConfiguration
        {
            Enabled = enabled,
            MonthlyTokenLimit = limit,
        });

        return new PlatformAiQuotaService(
            NullLogger<PlatformAiQuotaService>.Instance,
            repository,
            options);
    }
}
