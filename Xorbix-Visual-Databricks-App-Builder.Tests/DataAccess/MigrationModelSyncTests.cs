using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.DataAccess;

/// <summary>
/// Guards against the EF Core model drifting away from the migrations that define the database schema.
/// Runs with no database connection — it compares the current model to the migrations' model snapshot.
/// </summary>
public class MigrationModelSyncTests
{
    [Fact]
    public void Model_HasNoChangesMissingFromMigrations()
    {
        // The connection string is never opened; HasPendingModelChanges builds the model and diffs it
        // against the migrations snapshot entirely in memory. The migrations assembly defaults to the
        // ApplicationDbContext assembly, which is where the migrations live.
        DbContextOptions<ApplicationDbContext> options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql("Host=localhost;Database=ef-model-check;Username=ef;Password=ef")
                .Options;

        using ApplicationDbContext context = new(options);

        bool hasPendingModelChanges = context.Database.HasPendingModelChanges();

        Assert.False(
            hasPendingModelChanges,
            "The EF Core model has changes not captured in a migration. "
            + "Run 'dotnet ef migrations add <Name>' to scaffold the missing migration.");
    }
}
