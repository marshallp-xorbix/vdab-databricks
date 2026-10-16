using Microsoft.EntityFrameworkCore;
using System.Reflection;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.MigrationService;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

// One-shot worker: applies pending EF Core migrations (schema + seed-data migrations) and exits.
// Lives ONLY in the Aspire AppHost graph — the Server never migrates (it only refuses to start in
// Development while migrations are pending), so applying migrations stays a deliberate step in every
// other environment (CI/CD uses the EF migrations bundle). Honors ASPNETCORE_ENVIRONMENT (set by
// Aspire) or DOTNET_ENVIRONMENT so environment checks work under the generic host.
HostApplicationBuilder builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
{
    Args = args,
    EnvironmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                      ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
                      ?? Environments.Production,
});

builder.AddServiceDefaults();

// Only the connection string is needed here — repositories, Identity, and encryption services are not
// required to run Database.MigrateAsync, so the rest of the DataAccess registrations are intentionally
// not added. When launched by the AppHost the connection string arrives under the distinct name
// ConnectionStrings:AspireInjected; a standalone run (rare, e.g. applying to a database by hand) can
// instead supply ConnectionStrings:PostgreSql.
string? postgresConnectionString =
    builder.Configuration.GetConnectionString(ConnectionStrings.AspireInjectedConnectionName)
    ?? builder.Configuration.GetConnectionString(nameof(ConnectionStrings.PostgreSql));
if (string.IsNullOrWhiteSpace(postgresConnectionString))
{
    throw new InvalidOperationException(
        $"No connection string found ('{ConnectionStrings.AspireInjectedConnectionName}' or "
        + $"'{nameof(ConnectionStrings.PostgreSql)}').");
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseNpgsql(postgresConnectionString,
        npgsqlOptions => npgsqlOptions.MigrationsAssembly(Assembly.GetAssembly(typeof(ApplicationDbContext))!));
});

builder.Services.AddHostedService<MigrationWorker>();

IHost host = builder.Build();
host.Run();
