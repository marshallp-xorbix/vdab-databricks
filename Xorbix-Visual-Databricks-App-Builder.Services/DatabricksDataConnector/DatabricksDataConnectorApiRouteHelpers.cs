using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Shared helpers for interpreting Databricks (or gateway) API errors when choosing alternate routes.
/// </summary>
internal static class DatabricksDataConnectorApiRouteHelpers
{
    /// <summary>
    /// True when Databricks (or a gateway) reports the HTTP route is unknown, so a different API path may work.
    /// </summary>
    internal static bool ErrorsIndicateMissingHttpRoute(IEnumerable<IError> errors)
    {
        foreach (IError error in errors)
        {
            string message = error.Message ?? string.Empty;
            if (message.Contains("ENDPOINT_NOT_FOUND", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("Unsupported path", StringComparison.OrdinalIgnoreCase) ||
                message.Contains(" 404 ", StringComparison.Ordinal) ||
                message.Contains("Not Found", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
