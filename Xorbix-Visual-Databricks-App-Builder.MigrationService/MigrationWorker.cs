using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;

namespace Xorbix_Visual_Databricks_App_Builder.MigrationService;

/// <summary>
/// Applies pending EF Core migrations (schema and seed-data migrations) and then stops the host so the
/// one-shot worker exits. <c>MigrateAsync</c> is idempotent: against an up-to-date database this is a
/// no-op, so the persistent Aspire-managed Postgres container only does real work on a fresh volume.
/// </summary>
public sealed class MigrationWorker(
    IServiceProvider serviceProvider,
    IHostApplicationLifetime lifetime,
    ILogger<MigrationWorker> logger) : BackgroundService
{
    /// <inheritdoc/>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            using IServiceScope scope = serviceProvider.CreateScope();
            ApplicationDbContext dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            string[] pendingMigrations = [.. await dbContext.Database.GetPendingMigrationsAsync(stoppingToken)];
            if (pendingMigrations.Length == 0)
            {
                logger.LogInformation("Database is up to date — no pending migrations.");
                return;
            }

            logger.LogInformation("Applying {MigrationCount} pending migration(s): {Migrations}",
                pendingMigrations.Length, string.Join(", ", pendingMigrations));
            await dbContext.Database.MigrateAsync(stoppingToken);
            logger.LogInformation("Database migrations applied.");
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Migration worker failed.");
            throw;
        }
        finally
        {
            lifetime.StopApplication();
        }
    }
}
