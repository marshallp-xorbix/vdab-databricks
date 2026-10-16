namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Shared workflow trigger key formatting for AI Builder tools and validation.
/// </summary>
internal static class AiBuilderWorkflowKeys
{
    /// <summary>
    /// Builds a normalized trigger key from component code name and event key.
    /// </summary>
    internal static string BuildTriggerKey(string componentCodeName, string eventKey)
    {
        if (string.IsNullOrWhiteSpace(componentCodeName) || string.IsNullOrWhiteSpace(eventKey))
            return string.Empty;

        return $"{componentCodeName.Trim()}::{eventKey.Trim()}";
    }
}
