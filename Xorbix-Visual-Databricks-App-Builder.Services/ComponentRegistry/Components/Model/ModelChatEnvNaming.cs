using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Model;

/// <summary>
/// Builds stable environment variable names for Model Serving endpoint app resources.
/// </summary>
public static class ModelChatEnvNaming
{
    private const string Prefix = "SERVING_ENDPOINT";

    /// <summary>
    /// Environment variable injected in <c>app.yaml</c> whose value resolves to the endpoint name for the given resource key.
    /// </summary>
    public static string EnvironmentVariableName(string resourceKey)
    {
        return AppResourceEnvironmentVariableNaming.Build(Prefix, resourceKey);
    }
}
