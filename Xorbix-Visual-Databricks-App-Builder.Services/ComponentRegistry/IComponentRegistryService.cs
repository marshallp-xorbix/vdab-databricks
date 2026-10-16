using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry;

/// <summary>
/// Service for managing component registry - registration and lookup only.
/// Code generation moved to IStreamlitGenerationService.
/// </summary>
public interface IComponentRegistryService
{
    /// <summary>
    /// Gets the full component registry including all definitions and binding schemas
    /// </summary>
    Result<ComponentRegistryResponseDto> GetRegistry();

    /// <summary>
    /// Gets a specific component definition by type
    /// </summary>
    /// <param name="type">Component type to retrieve</param>
    Result<VdabComponentDto> GetDefinition(ComponentType type);

    /// <summary>
    /// Gets all registered component services
    /// </summary>
    /// <returns>Dictionary mapping ComponentType to service instance</returns>
    IReadOnlyDictionary<ComponentType, IComponentService> GetComponentServices();
}

