using Azure.Core;
using Azure.Identity;
using Microsoft.Extensions.Configuration;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

var builder = DistributedApplication.CreateBuilder(args);

// Configure Key Vault
var keyVaultUri = builder.Configuration["KeyVault:Uri"];
if (!string.IsNullOrEmpty(keyVaultUri))
{
    TokenCredential credential;
    var clientId = builder.Configuration["KeyVault:ClientId"];
    var clientSecret = builder.Configuration["KeyVault:ClientSecret"];
    var tenantId = builder.Configuration["KeyVault:TenantId"];

    if (!string.IsNullOrEmpty(clientId) && !string.IsNullOrEmpty(clientSecret) && !string.IsNullOrEmpty(tenantId))
    {
        credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    }
    else
    {
        credential = new DefaultAzureCredential();
    }

    builder.Configuration.AddAzureKeyVault(new Uri(keyVaultUri), credential);
}

// Local machine overrides (loaded last so they win over Key Vault and appsettings.Development.json).
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

var vdabApi = builder
    .AddProject<Projects.Xorbix_Visual_Databricks_App_Builder_Server>("api");

// =====================================================================================================
// DATABASE ORCHESTRATION
//
// Database:UseExistingDatabase (committed default: true) selects between two modes:
//
//   true  — EXTERNAL / MANUAL. The AppHost creates no container and adds no migration worker. The API
//           connects to whatever ConnectionStrings:PostgreSql resolves to in the Server's configuration
//           (appsettings.Local.json locally, Key Vault when deployed). Migrations are NEVER applied
//           automatically; apply them deliberately with `dotnet ef database update`. Use this to run or
//           debug against a shared dev/staging/prod database.
//
//   false — ASPIRE-MANAGED. The AppHost runs a persistent local Postgres container and injects its
//           connection string under the distinct name ConnectionStrings__AspireInjected, which the Server
//           promotes to ConnectionStrings:PostgreSql at startup — so managed mode needs no hand-written
//           connection string. Database:ApplyMigrations (default: true) controls whether the one-shot
//           MigrationService applies EF migrations + seed data before the API starts.
//
// SAFETY: the MigrationService is added to the graph ONLY in managed mode, and is wired exclusively to the
// Aspire-managed container. It can never receive a hand-supplied connection string, so automatic migration
// against a shared database is structurally impossible — that always stays a deliberate, manual step.
// =====================================================================================================
bool useExistingDatabase = builder.Configuration.GetValue("Database:UseExistingDatabase", true);
if (!useExistingDatabase)
{
    // Postgres for local orchestration — predictable AND per-developer configurable. Password, host port,
    // and data-volume name come from AppHost config (Parameters:postgres-password, Postgres:Port,
    // Postgres:DataVolumeName — overridable via appsettings.Local.json, env vars, or user-secrets).
    // WithDataVolume + persistent lifetime mean the container and its data are reused across runs; the
    // "vdab-db" database is created once and migrations are a no-op afterwards.
    var postgresPassword = builder.AddParameter("postgres-password", secret: true);
    int postgresPort = int.TryParse(builder.Configuration["Postgres:Port"], out int configuredPort) ? configuredPort : 5432;
    string dataVolumeName = builder.Configuration["Postgres:DataVolumeName"] ?? "vdab-pgdata";

    var postgres = builder.AddPostgres("postgres", password: postgresPassword, port: postgresPort)
        .WithDataVolume(dataVolumeName)
        .WithLifetime(ContainerLifetime.Persistent)
        .WithPgWeb(); // Optional web UI for browsing the database; link available on the Aspire dashboard.

    var database = postgres.AddDatabase("vdab-db");

    // Inject the container's connection string under the distinct ConnectionStrings__AspireInjected name.
    // The Server promotes it to ConnectionStrings:PostgreSql at startup; the distinct name keeps that an
    // obvious, explicit override of any value already in appsettings/Key Vault.
    vdabApi
        .WithReference(database, connectionName: ConnectionStrings.AspireInjectedConnectionName)
        .WaitFor(database);

    bool applyMigrations = builder.Configuration.GetValue("Database:ApplyMigrations", true);
    if (applyMigrations)
    {
        // One-shot worker: applies EF migrations (including the seed-data migrations) to the managed
        // container, then exits. Wired ONLY to the Aspire container, never to a hand-supplied connection
        // string. Idempotent: a no-op on an up-to-date volume, real work only on a fresh one.
        var migrations = builder.AddProject<Projects.Xorbix_Visual_Databricks_App_Builder_MigrationService>("migrations")
            .WithReference(database, connectionName: ConnectionStrings.AspireInjectedConnectionName)
            .WaitFor(database);

        vdabApi.WaitForCompletion(migrations);
    }
}

var appInsightsConnectionString = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]
                               ?? builder.Configuration.GetConnectionString("ApplicationInsights");

builder.AddJavaScriptApp("vdab-frontend", "../xorbix-visual-databricks-app-builder.client/")
    .WithReference(vdabApi)
    .WaitFor(vdabApi)
    .WithHttpEndpoint(port: 5173, env: "VITE_PORT")
    .WithEnvironment("VITE_API_BASE_URL", vdabApi.GetEndpoint("https"))
    .WithEnvironment("VITE_REDIRECT_URL", "http://localhost:5173/callback")
    .WithEnvironment("VITE_APPLICATIONINSIGHTS_CONNECTION_STRING", appInsightsConnectionString ?? "");

builder.Build().Run();
