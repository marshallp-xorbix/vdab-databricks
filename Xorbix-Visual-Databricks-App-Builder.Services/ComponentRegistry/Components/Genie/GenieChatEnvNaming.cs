using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Genie;

/// <summary>
/// Builds stable environment variable names for Genie space app resources (see Databricks Apps <c>app.yaml</c> <c>valueFrom</c>).
/// </summary>
public static class GenieChatEnvNaming
{
    private const string Prefix = "GENIE_SPACE";

    /// <summary>
    /// Environment variable injected in <c>app.yaml</c> whose value resolves to the Genie space id for the given resource key.
    /// </summary>
    public static string EnvironmentVariableName(string resourceKey)
    {
        return AppResourceEnvironmentVariableNaming.Build(Prefix, resourceKey);
    }
}
