using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

/// <summary>
/// Service responsible for orchestrating Streamlit code generation
/// across all components and event handlers
/// </summary>
public interface IStreamlitGenerationService
{
    /// <summary>
    /// Generates Streamlit code for a single component
    /// </summary>
    /// <param name="component">Component to generate code for</param>
    /// <param name="indentation">Indentation level</param>
    /// <param name="allComponents">All components for context</param>
    /// <returns>Generated Streamlit code</returns>
    string GenerateComponentCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null);

    void SetWorkflowDefinition(WorkflowDefinitionDto workflowDefinition);

    string? GetTriggerHandlerName(VdabComponentDto component, string eventName);
}
