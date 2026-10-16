using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Embedding.Helpers;

/// <summary>
/// Validates Databricks Lakeview dashboard embed URLs for the Dashboard embed component.
/// </summary>
public static class DatabricksDashboardEmbedUrlValidator
{
    private static readonly string[] AllowedWorkspaceHostSuffixes =
    [
        ".cloud.databricks.com",
        ".azuredatabricks.net",
        ".gcp.databricks.com"
    ];

    private const string EmbedPathPrefix = "/embed/dashboardsv3/";

    /// <summary>
    /// Validates <paramref name="src"/> as an HTTPS Lakeview embed URL for the given workspace base URL.
    /// </summary>
    /// <param name="src">The embed URL (trimmed by caller if needed).</param>
    /// <param name="workspaceUrl">The app's configured Databricks workspace URL (HTTPS).</param>
    /// <returns>Success if the URL is allowed; otherwise a user-safe error.</returns>
    public static Result Validate(string src, string workspaceUrl)
    {
        if (string.IsNullOrWhiteSpace(src))
        {
            return Result.Ok();
        }

        src = src.Trim();

        if (string.IsNullOrWhiteSpace(workspaceUrl))
        {
            return Result.Fail(new BadRequestError(
                "Workspace URL is missing for this app. Configure the workspace connection and try again."));
        }

        if (!Uri.TryCreate(workspaceUrl.Trim(), UriKind.Absolute, out Uri? workspaceUri)
            || workspaceUri.Scheme != Uri.UriSchemeHttps
            || string.IsNullOrEmpty(workspaceUri.Host))
        {
            return Result.Fail(new BadRequestError(
                "The app workspace URL is not valid. Update the workspace connection."));
        }

        if (!Uri.TryCreate(src.Trim(), UriKind.Absolute, out Uri? embedUri)
            || embedUri.Scheme != Uri.UriSchemeHttps)
        {
            return Result.Fail(new BadRequestError("Dashboard embed URL must use HTTPS."));
        }

        if (!string.IsNullOrEmpty(embedUri.UserInfo))
        {
            return Result.Fail(new BadRequestError("Dashboard embed URL is not valid."));
        }

        if (!string.Equals(embedUri.Host, workspaceUri.Host, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Fail(new BadRequestError(
                "Dashboard embed URL must use the same workspace host as this app."));
        }

        if (!IsLikelyDatabricksWorkspaceHost(embedUri.Host))
        {
            return Result.Fail(new BadRequestError(
                "Dashboard embed URL host is not recognized as a Databricks workspace."));
        }

        string path = embedUri.AbsolutePath.TrimEnd('/');
        if (!path.StartsWith(EmbedPathPrefix, StringComparison.Ordinal))
        {
            return Result.Fail(new BadRequestError(
                "Dashboard embed URL must use a Lakeview embed path (/embed/dashboardsv3/...)."));
        }

        string remainder = path.Substring(EmbedPathPrefix.Length);
        if (string.IsNullOrWhiteSpace(remainder) || remainder.Contains('/'))
        {
            return Result.Fail(new BadRequestError(
                "Dashboard embed URL is missing a valid dashboard id in the path."));
        }

        return Result.Ok();
    }

    private static bool IsLikelyDatabricksWorkspaceHost(string host)
    {
        foreach (string suffix in AllowedWorkspaceHostSuffixes)
        {
            if (host.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
