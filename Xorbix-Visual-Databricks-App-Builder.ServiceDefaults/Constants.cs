using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

[ExcludeFromCodeCoverage]
public static class AuthSchemes
{
    /// <summary>
    /// External API Key Authentication Scheme
    /// </summary>
    public const string ApiKey = "ApiKey";
}

[ExcludeFromCodeCoverage]
public static class AuthPolicies
{
    /// <summary>
    /// Requires Global Administrator Role
    /// </summary>
    public const string RequireAdministratorRole = "RequireAdministratorRole";

    /// <summary>
    /// Requires Tenant Administrator Role, or higher
    /// </summary>
    public const string RequireTenantAdminRole = "RequireTenantAdminRole";

    /// <summary>
    /// Requires Developer Role, or higher
    /// </summary>
    public const string RequireDeveloperRole = "RequireDeveloperRole";

    /// <summary>
    /// Any authenticated access. VDAB User or API key.
    /// </summary>
    public const string ApiAccess = "ApiAccess";

    /// <summary>
    /// Requires tenant membership: a valid tenant_id claim and a tenant_role of Developer or higher.
    /// Global Administrator does NOT bypass; they must be a member of the tenant.
    /// </summary>
    public const string RequireTenantMembership = "RequireTenantMembership";

}

[ExcludeFromCodeCoverage]
public static class AuthRoles
{
    /// <summary>
    /// Global Administrator Role
    /// </summary>
    public const string Administrator = "Administrator";

    /// <summary>
    /// Tenant Administrator Role
    /// </summary>
    public const string TenantAdmin = "Admin";

    /// <summary>
    /// Tenant Developer Role. Can create and modify workflows.
    /// </summary>
    public const string Developer = "Developer";

}

/// <summary>
/// Custom JWT claim types for session binding and invalidation.
/// </summary>
[ExcludeFromCodeCoverage]
public static class AuthClaimTypes
{
    /// <summary>
    /// ASP.NET Identity security stamp embedded in the access token. Rotated on force-logout-all.
    /// </summary>
    public const string SecurityStamp = "security_stamp";

    /// <summary>
    /// Refresh-token rotation chain identifier (one login session).
    /// </summary>
    public const string SessionId = "sid";
}

/// <summary>
/// Response headers used by VDAB authentication flows.
/// </summary>
[ExcludeFromCodeCoverage]
public static class AuthResponseHeaders
{
    /// <summary>
    /// Set when the JWT expired naturally and the client may attempt refresh.
    /// </summary>
    public const string TokenExpired = "Vdab-Token-Expired";

    /// <summary>
    /// Set when the session was revoked server-side and the client must sign in again.
    /// </summary>
    public const string SessionRevoked = "Vdab-Session-Revoked";
}

/// <summary>
/// Custom JWT claim types for tenant context.
/// </summary>
[ExcludeFromCodeCoverage]
public static class TenantClaimTypes
{
    /// <summary>
    /// Claim type for the current tenant ID.
    /// </summary>
    public const string TenantId = "tenant_id";

    /// <summary>
    /// Claim type for the user's role within the current tenant.
    /// </summary>
    public const string TenantRole = "tenant_role";
}

/// <summary>
/// JSON <c>kind</c> values and resource-type property keys for Databricks Apps <c>resources[]</c> entries.
/// </summary>
/// <remarks>
/// IMPORTANT: Keep in sync with <c>AppResourceKindSlug</c> / <c>APP_RESOURCE_KINDS</c> in
/// xorbix-visual-databricks-app-builder.client/src/types/appResourceKinds.ts (same string values).
/// </remarks>
[ExcludeFromCodeCoverage]
public static class DatabricksAppResourceKinds
{
    public const string SqlWarehouse = "sql_warehouse";
    public const string Job = "job";
    public const string Database = "database";
    public const string AutoscalingDatabase = "autoscaling_database";

    /// <summary>
    /// Databricks app manifest JSON key for Lakebase Postgres resources. Wire-only; normalized <c>Kind</c> is
    /// <see cref="AutoscalingDatabase"/> or <see cref="Database"/>. Not included in <see cref="KnownKinds"/>.
    /// </summary>
    public const string Postgres = "postgres";
    public const string Secret = "secret";
    public const string Experiment = "experiment";
    public const string GenieSpace = "genie_space";
    public const string ServingEndpoint = "serving_endpoint";
    public const string UcSecurable = "uc_securable";

    public static readonly HashSet<string> KnownKinds = new(StringComparer.Ordinal)
    {
        SqlWarehouse,
        Job,
        Database,
        AutoscalingDatabase,
        Secret,
        Experiment,
        GenieSpace,
        ServingEndpoint,
        UcSecurable
    };
}

/// <summary>
/// Centralized Databricks API route fragments used by services.
/// </summary>
[ExcludeFromCodeCoverage]
public static class DatabricksApiRoutes
{
    public const string OidcTokenPath = "/oidc/v1/token";
    public const string AppsDeploymentsPathTemplate = "/api/2.0/apps/{0}/deployments";
    public const string WorkspaceMkdirsPath = "/api/2.0/workspace/mkdirs";
    public const string WorkspaceImportPath = "/api/2.0/workspace/import";
    public const string WorkspaceDeletePath = "/api/2.0/workspace/delete";
    public const string ServingEndpointsPath = "/api/2.0/serving-endpoints";
    public const string UnityCatalogCatalogsPath = "/api/2.1/unity-catalog/catalogs";
    public const string JobsListPath = "/api/2.1/jobs/list";
    public const string GenieSpacesBasePath = "/api/2.0/genie/spaces";
    public const string GenieSpacesListPath = "/api/2.0/genie/spaces/list";

    /// <summary>GET list Genie spaces with pagination (see Databricks SDK <c>GenieAPI.ListSpaces</c>).</summary>
    public static string GenieSpacesListPagePath(int pageSize = 200, string? pageToken = null)
    {
        List<string> query = [$"page_size={pageSize}"];
        if (!string.IsNullOrEmpty(pageToken))
        {
            query.Add($"page_token={Uri.EscapeDataString(pageToken)}");
        }

        return $"{GenieSpacesBasePath}?{string.Join("&", query)}";
    }
    public const string MlflowExperimentsSearchPath = "/api/2.0/mlflow/experiments/search";
    public const string MlflowExperimentsListPath = "/api/2.0/mlflow/experiments/list";
    public const string SecretsScopesListPath = "/api/2.0/secrets/scopes/list";
    public const string SecretsListPath = "/api/2.0/secrets/list";
    public const string SqlWarehousesPath = "/api/2.0/sql/warehouses?page_size=100";
    public const string DatabaseInstancesPath = "/api/2.0/database/instances";

    public static string UnityCatalogSchemasPath(string encodedCatalog) =>
        $"/api/2.1/unity-catalog/schemas?catalog_name={encodedCatalog}";

    public static string UnityCatalogTablesPath(string encodedCatalog, string encodedSchema) =>
        $"/api/2.1/unity-catalog/tables?catalog_name={encodedCatalog}&schema_name={encodedSchema}";

    public static string UnityCatalogVolumesPath(string encodedCatalog, string encodedSchema) =>
        $"/api/2.1/unity-catalog/volumes?catalog_name={encodedCatalog}&schema_name={encodedSchema}";

    public static string UnityCatalogTableByFullNamePath(string encodedFullTableName) =>
        $"/api/2.1/unity-catalog/tables/{encodedFullTableName}";

    public static string DatabaseInstanceByNamePath(string encodedInstanceName) =>
        $"/api/2.0/database/instances/{encodedInstanceName}";

    public static string DatabaseCatalogsByCatalogNamePath(string encodedCatalogName) =>
        $"/api/2.0/database/catalogs/{encodedCatalogName}";

    public static string SecretsListByScopePath(string encodedScope) =>
        $"/api/2.0/secrets/list?scope={encodedScope}";

    public static string AppByNamePath(string appName) =>
        $"/api/2.0/apps/{appName}";

    public static string AppByNameAndActionPath(string appName, string action) =>
        $"/api/2.0/apps/{appName}/{action}";

    public static string AppsListPath(int pageSize) =>
        $"/api/2.0/apps?page_size={pageSize}";

    /// <summary>Databricks Apps API create: <c>POST /api/2.0/apps</c>.</summary>
    public const string AppsCreatePath = "/api/2.0/apps";
}

/// <summary>
/// OAuth field and token constants for Databricks auth flows.
/// </summary>
[ExcludeFromCodeCoverage]
public static class DatabricksOAuthConstants
{
    public const string ClientIdField = "client_id";
    public const string ClientSecretField = "client_secret";
    public const string GrantTypeField = "grant_type";
    public const string RedirectUriField = "redirect_uri";
    public const string CodeVerifierField = "code_verifier";
    public const string CodeField = "code";
    public const string ScopeField = "scope";
    public const string RefreshTokenField = "refresh_token";

    public const string AuthorizationCodeGrantType = "authorization_code";
    public const string RefreshTokenGrantType = "refresh_token";
    public const string AllApisOfflineAccessScope = "all-apis offline_access";

    public const string AccessTokenProperty = "access_token";
    public const string InvalidGrantError = "invalid_grant";
    public const string ExpiredError = "expired";
}

/// <summary>
/// Token literals used by workflow JSON parsing.
/// </summary>
[ExcludeFromCodeCoverage]
public static class WorkflowParserTokens
{
    public static class ActionTypes
    {
        public const string TriggerToast = "triggertoast";
        public const string ShowModal = "showmodal";
        public const string SaveToTable = "savetotable";
        public const string BuildSql = "buildsql";
        public const string RunSql = "runsql";
        public const string SetBinding = "setbinding";
        public const string StartDatabricksJob = "startdatabricksjob";
        public const string CallCustomModule = "callcustommodule";
        public const string CallPrebuiltModule = "callprebuiltmodule";
    }

    public static class Duration
    {
        public const string Preset = "preset";
        public const string Seconds = "seconds";
        public const string Short = "short";
        public const string Long = "long";
        public const string Infinite = "infinite";
    }

    public static class SqlSourceKind
    {
        public const string UnityCatalogTable = "unityCatalogTable";
        public const string LakebaseProvisionedDatabase = "lakebaseProvisionedDatabase";
        public const string LakebaseAutoscaling = "lakebaseAutoscaling";
    }

    public static class BuildSql
    {
        public const string Raw = "raw";
        public const string SqlStringLiteral = "sqlStringLiteral";
        public const string SqlIdentifier = "sqlIdentifier";
        public const string DateLiteral = "dateLiteral";
        public const string String = "string";
        public const string Number = "number";
        public const string Boolean = "boolean";
        public const string Date = "date";
        public const string DateTime = "datetime";
        public const string Unknown = "unknown";
    }

    public static class SetBinding
    {
        public const string SourceActionTypeRunSql = "RunSql";
        public const string SourceOutputRows = "rows";
        public const string TargetUnityCatalogTable = "unityCatalogTable";
        public const string TargetChartData = "chartData";
    }

    public static class RunSql
    {
        public const string SourceActionTypeBuildSql = "BuildSql";
    }

    public static class SaveToTable
    {
        public const string OverrideReasonAutogenerated = "autogenerated";
        public const string OverrideReasonSystemManaged = "systemmanaged";
        public const string OverrideReasonManualSkip = "manualskip";
        public const string TargetUnityCatalogTable = "unityCatalogTable";
        public const string TargetLakebaseProvisionedDatabase = "lakebaseProvisionedDatabase";
    }
}