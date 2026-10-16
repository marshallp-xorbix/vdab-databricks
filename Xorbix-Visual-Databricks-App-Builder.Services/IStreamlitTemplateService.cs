using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for generating Streamlit application artifacts.
/// </summary>
public interface IStreamlitTemplateService
{
    /// <summary>
    /// Builds Streamlit app code from VDAB components.
    /// </summary>
    /// <param name="components">VDAB component definitions.</param>
    /// <param name="appName">Display name for the app.</param>
    /// <param name="workflowDefinition">Workflow document for the app.</param>
    /// <param name="pageWidth">Max content width in pixels for the Streamlit page.</param>
    /// <returns>A result containing the generated Streamlit code.</returns>
    Result<string> GenerateStreamlitAppFromVdabComponents(
        List<VdabComponentDto> components,
        string appName,
        WorkflowDefinitionDto workflowDefinition,
        int pageWidth = PageWidthBounds.DefaultPixels);

    /// <summary>
    /// Builds requirements.txt content for a Streamlit app based on its components.
    /// </summary>
    /// <param name="components">VDAB component definitions.</param>
    /// <returns>The requirements.txt content.</returns>
    string GenerateRequirementsFile(List<VdabComponentDto>? components, WorkflowDefinitionDto workflowDefinition);

    /// <summary>
    /// Builds Streamlit theme configuration content.
    /// </summary>
    /// <param name="theme">Theme configuration values.</param>
    /// <returns>The config.toml content for Streamlit theme settings.</returns>
    string GenerateStreamlitConfig(StreamlitThemeConfig theme);

    /// <summary>
    /// Builds the app.yaml configuration for Streamlit deployment.
    /// </summary>
    /// <param name="components">VDAB components (used to annotate Lakebase prerequisites).</param>
    /// <param name="workflowDefinition">Workflow document (used to annotate Lakebase prerequisites).</param>
    /// <param name="sqlWarehouseResourceKey">
    /// Optional Databricks Apps resource key for the SQL warehouse (<c>valueFrom</c>).
    /// Defaults to <see cref="DatabricksAppsSqlWarehouseResource.DefaultResourceKey"/>.
    /// </param>
    /// <returns>The app.yaml content.</returns>
    string GenerateAppYamlFile(
        List<VdabComponentDto>? components,
        WorkflowDefinitionDto workflowDefinition,
        string? sqlWarehouseResourceKey = null);

    /// <summary>
    /// Builds <c>custom_modules.py</c> content (default scaffold when null/whitespace).
    /// </summary>
    string GenerateCustomModulesFile(string? customModulesCode);
}
