namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Shared helpers for Databricks Apps Lakebase Autoscaling postgres resource names.
/// </summary>
internal static class LakebaseAutoscalingPostgresWireHelper
{
    /// <summary>
    /// Builds the Databricks Apps postgres branch resource name.
    /// </summary>
    public static string BuildBranchResource(string projectId, string branchUid) =>
        $"projects/{projectId.Trim()}/branches/{branchUid.Trim()}";

    /// <summary>
    /// Builds the Databricks Apps postgres database resource name.
    /// </summary>
    public static string BuildDatabaseResource(string projectId, string branchUid, string databaseId) =>
        $"projects/{projectId.Trim()}/branches/{branchUid.Trim()}/databases/{databaseId.Trim()}";

    /// <summary>
    /// Parses <c>projectId/branchUid</c> from the normalized UI <c>instance_name</c>.
    /// </summary>
    public static bool TryParseProjectAndBranchFromInstanceName(
        string? instanceName,
        out string projectId,
        out string branchUid)
    {
        projectId = string.Empty;
        branchUid = string.Empty;

        string trimmed = (instanceName ?? string.Empty).Trim();
        int slash = trimmed.IndexOf('/');
        if (slash <= 0 || slash >= trimmed.Length - 1)
        {
            return false;
        }

        projectId = trimmed[..slash].Trim();
        branchUid = trimmed[(slash + 1)..].Trim();
        return !string.IsNullOrWhiteSpace(projectId) && !string.IsNullOrWhiteSpace(branchUid);
    }

    /// <summary>
    /// Parses <c>projects/{projectId}/branches/{branchUid}</c> from the Databricks Apps postgres branch field.
    /// </summary>
    public static bool TryParseProjectAndBranchFromBranchResource(
        string? branchResource,
        out string projectId,
        out string branchUid)
    {
        projectId = string.Empty;
        branchUid = string.Empty;

        string trimmed = (branchResource ?? string.Empty).Trim();
        const string prefix = "projects/";
        const string middle = "/branches/";
        if (!trimmed.StartsWith(prefix, StringComparison.Ordinal))
        {
            return false;
        }

        int middleIndex = trimmed.IndexOf(middle, StringComparison.Ordinal);
        if (middleIndex < 0)
        {
            return false;
        }

        projectId = trimmed.Substring(prefix.Length, middleIndex - prefix.Length).Trim();
        branchUid = trimmed[(middleIndex + middle.Length)..].Trim();
        return !string.IsNullOrWhiteSpace(projectId) && !string.IsNullOrWhiteSpace(branchUid);
    }

    /// <summary>
    /// Reduces UI/API values to the bare <c>database_id</c> segment for Databricks Apps postgres resources.
    /// </summary>
    public static string NormalizeDatabaseIdSegment(string? raw)
    {
        string trimmed = (raw ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return string.Empty;
        }

        const string catalogsMarker = "/catalogs/";
        int catalogsIndex = trimmed.LastIndexOf(catalogsMarker, StringComparison.Ordinal);
        if (catalogsIndex >= 0 && catalogsIndex + catalogsMarker.Length <= trimmed.Length)
        {
            return trimmed[(catalogsIndex + catalogsMarker.Length)..].Trim();
        }

        const string databasesMarker = "/databases/";
        int databasesIndex = trimmed.LastIndexOf(databasesMarker, StringComparison.Ordinal);
        if (databasesIndex >= 0 && databasesIndex + databasesMarker.Length <= trimmed.Length)
        {
            return trimmed[(databasesIndex + databasesMarker.Length)..].Trim();
        }

        return trimmed;
    }

    /// <summary>
    /// Normalizes Databricks Apps postgres <c>database</c> values to the short logical name or bare database id.
    /// </summary>
    public static string NormalizeDatabaseWireToShortName(string? databaseField) =>
        NormalizeDatabaseIdSegment(databaseField);
}
