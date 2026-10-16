using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Normalizes Databricks workspace URLs for consistent storage and tenant-scoped uniqueness checks.
/// </summary>
public static class DatabricksWorkspaceUrlNormalizer
{
    /// <summary>
    /// Trims whitespace, removes trailing slashes, and validates the URL is absolute HTTPS.
    /// </summary>
    /// <param name="workspaceUrl">The raw workspace URL from a request.</param>
    /// <returns>The normalized URL on success.</returns>
    public static Result<string> Normalize(string workspaceUrl)
    {
        if (string.IsNullOrWhiteSpace(workspaceUrl))
        {
            return Result.Fail<string>(new BadRequestError("Workspace URL is required."));
        }

        string trimmed = workspaceUrl.Trim().TrimEnd('/');
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out Uri? uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || string.IsNullOrWhiteSpace(uri.Host))
        {
            return Result.Fail<string>(new BadRequestError("Workspace URL must be a valid HTTPS URL."));
        }

        string normalizedPath = uri.AbsolutePath.TrimEnd('/');
        string normalized = string.IsNullOrEmpty(normalizedPath)
            ? $"{uri.Scheme}://{uri.Host}"
            : $"{uri.Scheme}://{uri.Host}{normalizedPath}";

        return Result.Ok(normalized);
    }
}
