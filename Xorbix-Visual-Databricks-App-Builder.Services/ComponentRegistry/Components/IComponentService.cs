using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;

/// <summary>
/// Base interface for all component services.
/// Each component implements this to provide its definition and generation logic.
/// </summary>
public interface IComponentService
{
    /// <summary>
    /// Gets the component type this service handles
    /// </summary>
    ComponentType ComponentType { get; }

    /// <summary>
    /// Gets the component definition (metadata, props, supported events/bindings)
    /// </summary>
    /// <returns>Component definition DTO</returns>
    VdabComponentDto GetDefinition();

    /// <summary>
    /// Generates Streamlit code for this component
    /// </summary>
    /// <param name="component">The component instance to generate code for</param>
    /// <param name="indentation">Indentation string for formatting</param>
    /// <param name="allComponents">All components in the app (for children resolution)</param>
    /// <returns>Generated Streamlit Python code</returns>
    string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null);

    /// <summary>
    /// Sets the generation service for recursive code generation (used by layout components)
    /// </summary>
    /// <param name="generationService">The generation service instance</param>
    void SetGenerationService(IStreamlitGenerationService generationService);
}