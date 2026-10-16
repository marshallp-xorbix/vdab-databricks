# Xorbix Visual Databricks App Builder (VDAB)

A full-stack application for visually building and deploying Databricks workflows with a modern web interface.

## Tech Stack

- **Backend**: .NET 10 with Azure Aspire orchestration
- **Frontend**: React 19 + React Router v7 (Framework Mode) + shadcn/ui + Tailwind CSS
- **Database**: PostgreSQL via Entity Framework Core (local PostgreSQL for dev machines; Databricks Lakebase autoscaling managed PostgreSQL for dev/stg/prd)
- **Architecture**: Clean Architecture with strict layer separation
- **Infrastructure**: Azure (App Service, Key Vault, Application Insights, Communication Services)

## Project Structure

```
Xorbix-Visual-Databricks-App-Builder.AppHost/      # Azure Aspire orchestration entrypoint
Xorbix-Visual-Databricks-App-Builder.Server/       # ASP.NET Core API controllers & middleware
Xorbix-Visual-Databricks-App-Builder.Services/     # Business logic layer
Xorbix-Visual-Databricks-App-Builder.DataAccess/   # EF Core repositories & DbContext
Xorbix-Visual-Databricks-App-Builder.Models/       # Data entities and configuration POCOs
Xorbix-Visual-Databricks-App-Builder.ServiceDefaults/ # Shared service configuration
xorbix-visual-databricks-app-builder.client/       # React frontend (Vite + React Router v7)
.infrastructure/                                    # Bicep templates and deployment docs
.pipelines/                                         # Azure DevOps CI/CD pipeline
```

## Quick Start

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js 24.x](https://nodejs.org/)
- [Visual Studio 2026](https://visualstudio.microsoft.com/) or [VS Code](https://code.visualstudio.com/)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (for infrastructure deployment)

### Azure Identity Setup

To access Azure Key Vault secrets locally, you must be signed in with your **xorbix.com** account in your development environment. This identity is used by `DefaultAzureCredential` to authenticate against Azure resources.

**Visual Studio 2026:**
1. Go to **Tools** > **Options**.
2. Navigate to **Azure Service Authentication** > **Account Selection**.
3. Select your **xorbix.com** account from the dropdown.
   - If not listed, sign in via the top-right corner of Visual Studio first.

**Visual Studio Code:**
1. Install the **Azure Account** extension.
2. Press `F1` (or `Ctrl+Shift+P`) to open the command palette.
3. Type `Azure: Sign In` and press Enter.
4. Follow the browser prompt to sign in with your **xorbix.com** account.
5. **Important:** Ensure you are also logged in via Azure CLI in the terminal:
   ```bash
   az login --tenant xorbix.com
   ```

**Troubleshooting:**
- If you encounter `CredentialUnavailableException`, ensure your account has the **Key Vault Secrets User** role on the Key Vault resource in the Azure Portal.
- You may need to restart your IDE after signing in for the credentials to refresh.

### Alternative: Service Principal Authentication (Fallback)

If you cannot use your personal Azure identity (e.g., for external contributors or CI/CD), you can configure a Service Principal explicitly in `appsettings.Local.json`. This acts as a fallback authentication method.

1. Create a Service Principal in Azure AD and grant it `Key Vault Secrets User` access to the Key Vault.
2. Add the credentials to `Xorbix-Visual-Databricks-App-Builder.Server/appsettings.Local.json`:

```json
{
  "KeyVault": {
    "Uri": "https://xorbixvdabdevkv.vault.azure.net/",
    "ClientId": "<your-client-id>",
    "ClientSecret": "<your-client-secret>",
    "TenantId": "<your-tenant-id>"
  }
}
```

### Running Locally

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd XorbixVisualDatabricksAppBuilder
   ```

2. **Configure Secrets (Key Vault)**
   - Ensure your Azure user account has `Key Vault Secrets User` permissions on the development Key Vault.
   - Create or update `Xorbix-Visual-Databricks-App-Builder.Server/appsettings.Local.json`:
     ```json
     {
       "KeyVault": {
         "Uri": "https://xorbixvdabdevkv.vault.azure.net/"
       }
     }
     ```
   - The application will automatically fetch connection strings and secrets (PostgreSQL, Storage, Databricks) from Key Vault.

3. **Local Database** — two modes, selected by `Database:UseExistingDatabase` in the AppHost's `appsettings.Local.json`:

   **a) Aspire-managed local container (recommended).** Requires Docker Desktop.
   - Copy `Xorbix-Visual-Databricks-App-Builder.AppHost/appsettings.Local.example.json` to `appsettings.Local.json` (same folder) and set `Database:UseExistingDatabase` to `false`.
   - The AppHost starts a persistent Postgres container and **injects its connection string into the API automatically** — you do not configure a connection string for this mode.
   - When `Database:ApplyMigrations` is `true` (default), the `MigrationService` applies EF migrations + seed data (roles, tenants, initial users, beta codes) before the API starts.

   **b) Existing / shared database (dev, staging, prod) for debugging.**
   - Leave `Database:UseExistingDatabase` as `true` (the committed default) in the AppHost.
   - Set `ConnectionStrings:PostgreSql` in the Server's `appsettings.Local.json` to that database's connection string (see `Xorbix-Visual-Databricks-App-Builder.Server/appsettings.Local.example.json`).
   - No container is created and **migrations are never applied automatically** — apply them deliberately with `dotnet ef database update` if needed.

4. **Open in Visual Studio**
   - Open `Xorbix-Visual-Databricks-App-Builder.slnx`
   - Set `Xorbix-Visual-Databricks-App-Builder.AppHost` as the startup project
   - Press F5 to run

   The AppHost will automatically:
   - Start the Postgres container and apply migrations + seed data (when `Database:UseExistingDatabase` is `false` and `Database:ApplyMigrations` is `true`)
   - Start the .NET API server
   - Start the Vite dev server for the frontend
   - Open the Aspire Dashboard for monitoring

5. **Access the application**
   - Frontend: `http://localhost:5173` (Vite dev server)
   - API: `http://localhost:7023` (API server)
   - Aspire Dashboard: `http://localhost:15XXX` (shown in console)

## Documentation

### Project Documentation
- [Authentication & Identity](.documentation/identity_readme.md) - Authentication flows, JWT, passwordless login, API endpoints
- [EF Core and Database](./.documentation/data-access-ef-instructions.md) - EF Core migrations and database setup
- [Frontend Documentation](./xorbix-visual-databricks-app-builder.client/README.md) - React app structure and conventions
- [Deployment Guide](.documentation/deployment/README.md) - Deploy to dev/stg/prd: pipeline, Bicep, environments, Lakebase
- [Infrastructure Documentation](./.infrastructure/readme.md) - Bicep templates and Azure resources
- [Communication Service Setup](./.infrastructure/communication-service-setup.md) - Email service configuration

### Development Guidelines
- [AGENTS.md](./AGENTS.md) - Standardized AGENTS.md 

## Environments

| Environment | URL | App Service | Lakebase branch |
|-------------|-----|-------------|-----------------|
| Local | `http://localhost:5173` | — | local PostgreSQL |
| Dev | [xorbix-vdab-dev.azurewebsites.net](https://xorbix-vdab-dev.azurewebsites.net) | `xorbix-vdab-dev` | `dev` |
| Staging | [xorbix-vdab-stg.azurewebsites.net](https://xorbix-vdab-stg.azurewebsites.net) | `xorbix-vdab-stg` | `stg` |
| Production | [app.vdab.ai](https://app.vdab.ai) | `xorbix-vdab-prd` | `prd` |

All three Azure environments share the resource group **vdab**. See the [Deployment Guide](.documentation/deployment/README.md) for the full topology, CI/CD flow, and setup steps.

## Databricks Workspace
- Access to Databricks workspace: https://adb-7405618966071933.13.azuredatabricks.net/

## Development Workflow

### Git Workflow
- **NEVER** push directly to `develop` branch
- All changes via Pull Request only
- Branch naming: `feature/<description>` or `fix/<description>`
- Commit messages: Use semantic commit format
- Each PR must build and pass tests before merge
- Link PRs to issues when applicable

### Code Review Requirements
- AI-generated code must be fully reviewed and tested
- All backend changes must follow Clean Architecture principles
- Frontend changes must follow React/TypeScript best practices
- Database changes require EF Core migrations

### Running Tests
```bash
# Run all tests
dotnet test

# Run specific test project
dotnet test <TestProject>/<TestProject>.csproj
```

## Database Migrations

See [Data Access Instructions](.documentation/data-access-ef-instructions.md) for detailed migration commands.

**Quick reference** (run from solution root):
```bash
# Create new migration
dotnet ef migrations add <MigrationName> --project Xorbix-Visual-Databricks-App-Builder.DataAccess --startup-project Xorbix-Visual-Databricks-App-Builder.Server --context ApplicationDbContext

# Apply migrations
dotnet ef database update --project Xorbix-Visual-Databricks-App-Builder.DataAccess --startup-project Xorbix-Visual-Databricks-App-Builder.Server --context ApplicationDbContext
```

## Deployment

VDAB deploys to three environments — **dev**, **stg**, **prd** — using **build-once, promote-many**: each
merge to `develop` builds one artifact, auto-deploys **dev**, then promotes the same artifact to **staging**
and **production** through Azure DevOps Environment approval gates. Pull requests build and validate only. The
full process — pipeline, Bicep, secrets, Lakebase branches, and adding new environments — is documented in the
**[Deployment Guide](.documentation/deployment/README.md)**.

- CI/CD pipeline: [`.pipelines/azure-pipelines.yml`](.pipelines/azure-pipelines.yml)
- Infrastructure templates: [`.infrastructure/`](.infrastructure/readme.md)
- First-time / manual Bicep deploy: [Deployment Guide → Manual Bicep deployment](.documentation/deployment/4-deploy-bicep.md)

## Troubleshooting

### Local Development Issues

**AppHost fails to start:**
- Ensure .NET 10 SDK is installed
- Check that ports 5173 and 7023 are available
- Verify `appsettings.Local.json` exists in Server project

**Frontend not loading:**
- Ensure Node.js 24.x is installed
- Run `npm ci` in the `xorbix-visual-databricks-app-builder.client` directory
- Check Vite dev server logs in Aspire Dashboard

**Database connection errors:**
- Verify the `ConnectionStrings:PostgreSql` value in `appsettings.Local.json`
- Ensure your local PostgreSQL (Aspire container) is running, or your existing-database connection string is valid
- Apply pending migrations

### Azure Deployment Issues
See [Infrastructure Troubleshooting](./.infrastructure/readme.md#troubleshooting) for Azure-specific issues.

## Architecture

VDAB follows Clean Architecture principles:

```
┌─────────────────────────────────────────┐
│  Presentation Layer (Server/Client)    │  ← Controllers, React Components
├─────────────────────────────────────────┤
│  Application Layer (Services)          │  ← Business Logic, Use Cases
├─────────────────────────────────────────┤
│  Domain Layer (Models)                 │  ← Entities, DTOs, Interfaces
├─────────────────────────────────────────┤
│  Infrastructure Layer (DataAccess)     │  ← EF Core, Repositories
└─────────────────────────────────────────┘
```

**Key Principles:**
- Controllers → Services → Repositories → Database
- No circular dependencies between projects
- Services return `Result<T>` (FluentResults) instead of throwing exceptions
- Dependency injection throughout (constructor injection only)
- Async/await consistently used

## Azure DevOps Pipeline Setup

The CI/CD pipeline is defined in [`.pipelines/azure-pipelines.yml`](.pipelines/azure-pipelines.yml) as a single
multi-environment, multi-stage workflow (dev/stg/prd). Configuring it — service connections, per-environment
variable groups, and the approval-gated Environments — is documented in the Deployment Guide:

- [Service connections & access](.documentation/deployment/3-service-connections-and-access.md)
- [Pipeline setup & operation](.documentation/deployment/5-pipeline-setup.md)

## Contributing

1. Pull latest `develop` branch
2. Create feature branch: `git checkout -b feature/your-feature`
3. Follow coding standards in `.github/instructions/`
4. Create migrations for database changes
5. Test locally via AppHost
6. Push and create Pull Request
7. Address review feedback
8. Merge after approval

## Support

For questions or issues:
- Check project-specific READMEs (linked above)
- Review `.github/instructions/` for coding guidelines
- Contact DevOps team for infrastructure/deployment issues
- Consult Tim for migration conflicts or architecture questions

## License

[Add license information]

