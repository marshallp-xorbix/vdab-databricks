# DataAccess Project

This project contains the Entity Framework Core database context, migrations, and data access configurations.

## Project Structure
DataAccess/ 
├── ApplicationDbContext.cs          # Main EF Core DbContext with Identity support
├── Configurations/                  # Fluent API entity configurations
├── Migrations/                      # EF Core migrations (auto-generated)
└── README.md

## How Migrations Are Applied

The API never applies migrations itself — it only reads its connection string from the Server's
configuration (`ConnectionStrings:PostgreSql`) and, in Development, refuses to start while migrations are
pending. Migrations are applied in exactly one of three deliberate ways:

- **Local development (Aspire-managed container):** with `Database:UseExistingDatabase = false` AND
  `Database:ApplyMigrations = true` in the AppHost's `appsettings.Local.json`, the AppHost runs the one-shot
  `Xorbix-Visual-Databricks-App-Builder.MigrationService` worker against the **local container only**, applying
  all pending migrations (including seed-data migrations) before the API starts. Set `ApplyMigrations = false`
  to start an empty container and apply migrations yourself. The worker is wired exclusively to the Aspire
  container and can never target an external database.
- **Any external/shared database:** with `Database:UseExistingDatabase = true` (the committed default), no
  migration worker exists in the graph. Apply migrations deliberately with `dotnet ef database update` (see
  below). Auto-application against a shared database is structurally impossible.
- **Deployed environments:** the CI/CD pipeline builds an EF migrations bundle (`migrate.exe`) and executes it
  against the target database.

## Verifying the model matches the migrations / database

Two tests in `Xorbix-Visual-Databricks-App-Builder.Tests/DataAccess/` guard schema drift:

- `MigrationModelSyncTests` (always runs, no database): calls EF Core's `Database.HasPendingModelChanges()` to
  fail the build if the entity model has changes not captured in a migration. Fix by running
  `dotnet ef migrations add <Name>`.
- `DatabaseSchemaValidationTests` (gated, requires a live database): introspects a real Postgres database via
  `information_schema` and compares tables, columns, nullability, and primary keys to the EF model. It is
  skipped unless the `ConnectionStrings__PostgreSql` environment variable is set, and is tagged
  `[Trait("Category", "RequiresDatabaseSchema")]` so CI can exclude it with
  `dotnet test --filter "Category!=RequiresDatabaseSchema"`. Use it to confirm a deployed/migrated database
  has not drifted from the model.

## Migration Reset (2026-06)

All pre-2026-06 migrations were deleted and replaced with a fresh `InitialCreate`, a `SeedInitialData`
migration (global roles, the Xorbix and Demo tenants, the initial users, and their memberships), and a
`SeedInitialBetaCodes` migration. Databases created before the reset must have the new migration IDs inserted
manually into `__EFMigrationsHistory` (handled by the team lead for shared environments); local databases are
simplest to recreate via the Aspire-managed setup.

**Seed data is a migration.** Reference data (roles, tenants, lookups, beta codes) is seeded via
blank-scaffolded migrations (`dotnet ef migrations add <name>` with a hand-written `Up`/`Down`), never via
ad-hoc scripts. See `SeedInitialData.cs` for the pattern, including how Identity users are inserted without
`UserManager`.

## Entity Framework Core Migrations

### Prerequisites

Ensure you have the EF Core tools installed:
```bash
dotnet tool install --global dotnet-ef
```


### Migration Commands
All migration commands should be run from the **root solution directory**:

#### Create New Migration
```bash
dotnet ef migrations add <descriptive-name> --project Xorbix-Visual-Databricks-App-Builder.DataAccess --startup-project Xorbix-Visual-Databricks-App-Builder.Server --context ApplicationDbContext --output-dir Migrations

dotnet ef migrations add RemoveTenantUniqueNameConstraint --project Xorbix-Visual-Databricks-App-Builder.DataAccess --startup-project Xorbix-Visual-Databricks-App-Builder.Server --context ApplicationDbContext --output-dir Migrations
```

#### Rollback Last Applied Migration
```bash
dotnet ef migrations remove --project Xorbix-Visual-Databricks-App-Builder.DataAccess --startup-project Xorbix-Visual-Databricks-App-Builder.Server --context ApplicationDbContext
```

#### Rollback to a Specific Migration
```bash
dotnet ef database update <PreviousMigrationName> --project Xorbix-Visual-Databricks-App-Builder.DataAccess --startup-project Xorbix-Visual-Databricks-App-Builder.Server --context ApplicationDbContext
```

#### Remove a Migration (if not applied)
```bash
dotnet ef migrations remove --project Xorbix-Visual-Databricks-App-Builder.DataAccess --startup-project Xorbix-Visual-Databricks-App-Builder.Server --context ApplicationDbContext

```

#### Apply Migration
```bash
dotnet ef database update --project Xorbix-Visual-Databricks-App-Builder.DataAccess --startup-project Xorbix-Visual-Databricks-App-Builder.Server --context ApplicationDbContext

# add if needed
--verbose
```


if running from **DataAccess project directory**:
cd Xorbix-Visual-Databricks-App-Builder.DataAccess

```bash
cd Xorbix-Visual-Databricks-App-Builder.DataAccess

dotnet ef migrations add <MigrationName> --startup-project ../Xorbix-Visual-Databricks-App-Builder.Server --output-dir Migrations

dotnet ef database update --startup-project ../Xorbix-Visual-Databricks-App-Builder.Server

dotnet ef migrations list --startup-project ../Xorbix-Visual-Databricks-App-Builder.Server

```

### Database Schema

The application uses two schemas:

- **`iam`** - Identity and Access Management tables (Users, Roles, UserRoles, etc.)
- **`dbo`** - All other application tables (default schema)

### Connection String

The connection string is configured in `appsettings.json` or `appsettings.Local.json` (for local development):


For production, use environment variables or Azure App Configuration.

### Best Practices

1. **Always create a migration before modifying the database schema**
   - Add/modify entities in `Models/EF/`
   - Create entity configurations in `DataAccess/Configurations/` (if using Fluent API)
   - Generate migration
   - Review the generated migration code
   - Apply migration

2. **Use descriptive migration names**
   - ✅ `AddApplicationDeploymentsTable`
   - ✅ `UpdateUserAddAzureAdObjectId`
   - ❌ `Migration1`, `Update`, `Changes`

3. **Never modify applied migrations**
   - Create a new migration to make changes
   - Use `migrations script` to review changes before applying

4. **Review migrations before applying to production**
   - Generate SQL script and review
   - Test in a non-production environment first
   - Use idempotent scripts for production deployments

5. **Backup before major migrations**
   - Always backup production databases before applying migrations
   - Test rollback procedures

### Troubleshooting

#### Migration fails with "Build failed"
Ensure the solution builds successfully: `dotnet build`

#### "No DbContext was found"
Ensure you're specifying the correct startup project

#### Connection string not found
Check that `appsettings.Local.json` exists with a valid connection string in the Server project.


### Team Workflow

1. **Before creating migrations:**
   - Pull latest changes from `develop` branch
   - Apply any pending migrations locally
   - Make your entity changes

2. **After creating migrations:**
   - Test the migration locally
   - Commit migration files to source control
   - Include migration in your PR

3. **Merging migrations:**
   - If conflicts occur with migrations, reach out to Tim
   - Do not manually edit migration files to resolve conflicts
   - May need to recreate migration after merging

## Additional Resources

- [EF Core Migrations Overview](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/)
- [EF Core CLI Tools](https://learn.microsoft.com/en-us/ef/core/cli/dotnet)
- [Migration Best Practices](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/managing)


Current Migrations (post-reset)
```
20260612220916_InitialCreate     # Full schema (iam + dbo)
20260612220937_SeedInitialData   # Roles, tenants, initial users, memberships
```