using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.DataAccess;

/// <summary>
/// Integration tests for <see cref="UserPlatformAiUsageRepository"/> against a live Postgres database.
/// </summary>
[Trait("Category", "RequiresDatabaseSchema")]
public class UserPlatformAiUsageRepositoryTests
{
    [RequiresDatabaseSchemaFact]
    public async Task RecordUsageAsync_AccumulatesTokens_AcrossSequentialCalls()
    {
        await using TestDataScope scope = await TestDataScope.CreateAsync();
        UserPlatformAiUsageRepository repository = scope.CreateRepository();
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(DateTime.UtcNow);
        PlatformAiUsageRecordContext context = new()
        {
            TotalTokens = 250,
            InputTokens = 150,
            OutputTokens = 100,
            TenantId = scope.TenantId,
            AppId = 1,
        };

        await repository.RecordUsageAsync(scope.UserId, periodKey, context);
        await repository.RecordUsageAsync(scope.UserId, periodKey, context);

        long tokensUsed = await repository.GetTokensUsedAsync(scope.UserId, periodKey);
        Assert.Equal(500, tokensUsed);
    }

    [RequiresDatabaseSchemaFact]
    public async Task RecordUsageAsync_AccumulatesTokens_UnderConcurrentCalls()
    {
        await using TestDataScope scope = await TestDataScope.CreateAsync();
        UserPlatformAiUsageRepository repository = scope.CreateRepository();
        string periodKey = PlatformAiQuotaPeriod.GetCurrentPeriodKey(DateTime.UtcNow);
        const int parallelCalls = 10;
        const int tokensPerCall = 100;

        IEnumerable<Task> tasks = Enumerable.Range(0, parallelCalls).Select(_ =>
        {
            PlatformAiUsageRecordContext context = new()
            {
                TotalTokens = tokensPerCall,
                TenantId = scope.TenantId,
                AppId = 1,
            };
            return repository.RecordUsageAsync(scope.UserId, periodKey, context);
        });

        await Task.WhenAll(tasks);

        long tokensUsed = await repository.GetTokensUsedAsync(scope.UserId, periodKey);
        Assert.Equal(parallelCalls * tokensPerCall, tokensUsed);
    }

    private sealed class TestDataScope : IAsyncDisposable
    {
        private readonly ApplicationDbContext _context;
        private readonly Guid _tenantId;
        private readonly Guid _userId;

        private TestDataScope(ApplicationDbContext context, Guid tenantId, Guid userId)
        {
            _context = context;
            _tenantId = tenantId;
            _userId = userId;
        }

        public Guid TenantId => _tenantId;

        public Guid UserId => _userId;

        public static async Task<TestDataScope> CreateAsync()
        {
            string connectionString =
                Environment.GetEnvironmentVariable(RequiresDatabaseSchemaFactAttribute.ConnectionStringEnvironmentVariable)!;

            DbContextOptions<ApplicationDbContext> options =
                new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseNpgsql(connectionString)
                    .Options;

            ApplicationDbContext context = new(options);
            Guid tenantId = Guid.NewGuid();
            Guid userId = Guid.NewGuid();
            string suffix = Guid.NewGuid().ToString("N")[..8];

            Tenant tenant = new()
            {
                TenantId = tenantId,
                TenantName = $"usage-test-{suffix}",
                DisplayName = $"Usage Test {suffix}",
            };
            context.Tenants.Add(tenant);

            ApplicationUser user = new()
            {
                Id = userId,
                UserName = $"usage-test-{suffix}@example.com",
                Email = $"usage-test-{suffix}@example.com",
                NormalizedEmail = $"USAGE-TEST-{suffix}@EXAMPLE.COM".ToUpperInvariant(),
                NormalizedUserName = $"USAGE-TEST-{suffix}@EXAMPLE.COM".ToUpperInvariant(),
                FirstName = "Usage",
                LastName = "Test",
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();

            return new TestDataScope(context, tenantId, userId);
        }

        public UserPlatformAiUsageRepository CreateRepository()
        {
            return new UserPlatformAiUsageRepository(_context);
        }

        public async ValueTask DisposeAsync()
        {
            List<UserPlatformAiUsageEvent> events = await _context.UserPlatformAiUsageEvents
                .Where(e => e.UserId == _userId)
                .ToListAsync();
            _context.UserPlatformAiUsageEvents.RemoveRange(events);

            List<UserPlatformAiUsage> usages = await _context.UserPlatformAiUsages
                .Where(u => u.UserId == _userId)
                .ToListAsync();
            _context.UserPlatformAiUsages.RemoveRange(usages);

            ApplicationUser? user = await _context.Users.FindAsync(_userId);
            if (user is not null)
            {
                _context.Users.Remove(user);
            }

            Tenant? tenant = await _context.Tenants.FindAsync(_tenantId);
            if (tenant is not null)
            {
                _context.Tenants.Remove(tenant);
            }

            await _context.SaveChangesAsync();
            await _context.DisposeAsync();
        }
    }
}
