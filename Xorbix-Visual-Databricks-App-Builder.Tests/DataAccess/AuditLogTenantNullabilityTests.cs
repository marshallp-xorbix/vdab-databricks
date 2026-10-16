using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.DataAccess;

/// <summary>
/// Integration tests for durable purge-audit tombstones against live Postgres.
/// </summary>
[Trait("Category", "RequiresDatabaseSchema")]
public class AuditLogTenantNullabilityTests
{
    [RequiresDatabaseSchemaFact]
    public async Task HardDeleteTenant_SetsNullOnSurvivingAuditRows()
    {
        await using AuditLogTestScope scope = await AuditLogTestScope.CreateAsync();

        AuditLog historical = new()
        {
            TenantId = scope.TenantId,
            ActionType = "TenantSoftDelete",
            Description = "pre-purge history",
            Severity = AuditSeverities.Info,
            Timestamp = DateTime.UtcNow,
        };
        scope.Context.AuditLogs.Add(historical);
        await scope.Context.SaveChangesAsync();
        long historicalId = historical.AuditLogId;

        TenantRepository tenantRepository = new(scope.Context);
        bool deleted = await tenantRepository.HardDeleteAsync(scope.TenantId);
        Assert.True(deleted);

        // Clear change tracker so we re-read what Postgres stored after SetNull.
        scope.Context.ChangeTracker.Clear();

        AuditLog? surviving = await scope.Context.AuditLogs
            .AsNoTracking()
            .SingleOrDefaultAsync(log => log.AuditLogId == historicalId);

        Assert.NotNull(surviving);
        Assert.Null(surviving.TenantId);
        scope.TrackAuditLog(historicalId);
    }

    [RequiresDatabaseSchemaFact]
    public async Task LogAsync_AcceptsNullTenantId_Tombstone()
    {
        await using AuditLogTestScope scope = await AuditLogTestScope.CreateAsync(seedTenant: false);

        AuditLog tombstone = new()
        {
            TenantId = null,
            UserId = null,
            ActionType = "TenantPurge",
            EntityType = "Tenant",
            EntityId = Guid.NewGuid().ToString(),
            Description = "purge tombstone",
            Severity = AuditSeverities.Warning,
            Timestamp = DateTime.UtcNow,
            Metadata = "{\"cascade\":{}}",
        };
        scope.Context.AuditLogs.Add(tombstone);
        await scope.Context.SaveChangesAsync();

        scope.Context.ChangeTracker.Clear();

        AuditLog? stored = await scope.Context.AuditLogs
            .AsNoTracking()
            .SingleOrDefaultAsync(log => log.AuditLogId == tombstone.AuditLogId);

        Assert.NotNull(stored);
        Assert.Null(stored.TenantId);
        Assert.Equal("TenantPurge", stored.ActionType);
        scope.TrackAuditLog(tombstone.AuditLogId);
    }

    private sealed class AuditLogTestScope : IAsyncDisposable
    {
        private readonly ApplicationDbContext _context;
        private readonly Guid? _tenantId;
        private readonly List<long> _auditLogIds = [];

        private AuditLogTestScope(ApplicationDbContext context, Guid? tenantId)
        {
            _context = context;
            _tenantId = tenantId;
        }

        public ApplicationDbContext Context => _context;

        public Guid TenantId =>
            _tenantId ?? throw new InvalidOperationException("Test scope was created without a tenant.");

        public static async Task<AuditLogTestScope> CreateAsync(bool seedTenant = true)
        {
            string connectionString =
                Environment.GetEnvironmentVariable(RequiresDatabaseSchemaFactAttribute.ConnectionStringEnvironmentVariable)!;

            DbContextOptions<ApplicationDbContext> options =
                new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseNpgsql(connectionString)
                    .Options;

            ApplicationDbContext context = new(options);
            Guid? tenantId = null;

            if (seedTenant)
            {
                tenantId = Guid.NewGuid();
                string suffix = Guid.NewGuid().ToString("N")[..8];
                context.Tenants.Add(new Tenant
                {
                    TenantId = tenantId.Value,
                    TenantName = $"audit-null-{suffix}",
                    DisplayName = $"Audit Null {suffix}",
                });
                await context.SaveChangesAsync();
            }

            return new AuditLogTestScope(context, tenantId);
        }

        public void TrackAuditLog(long auditLogId) => _auditLogIds.Add(auditLogId);

        public async ValueTask DisposeAsync()
        {
            if (_auditLogIds.Count > 0)
            {
                List<AuditLog> logs = await _context.AuditLogs
                    .Where(log => _auditLogIds.Contains(log.AuditLogId))
                    .ToListAsync();
                _context.AuditLogs.RemoveRange(logs);
            }

            if (_tenantId is Guid tenantId)
            {
                Tenant? tenant = await _context.Tenants.FindAsync(tenantId);
                if (tenant is not null)
                {
                    _context.Tenants.Remove(tenant);
                }
            }

            await _context.SaveChangesAsync();
            await _context.DisposeAsync();
        }
    }
}
