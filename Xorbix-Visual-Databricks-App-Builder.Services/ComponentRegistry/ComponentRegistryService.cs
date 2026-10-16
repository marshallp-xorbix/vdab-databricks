using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.BindingDefinition;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry;

/// <summary>
/// Service for managing component registry - registration and lookup
/// </summary>
public class ComponentRegistryService : IComponentRegistryService
{
    private readonly Dictionary<ComponentType, IComponentService> _componentServices;
    private readonly IBindingDefinitionService _bindingDefinitionService;

    public ComponentRegistryService(
        IBindingDefinitionService bindingDefinitionService,
        IEnumerable<IComponentService> componentServices)
    {
        _bindingDefinitionService = bindingDefinitionService;
        _componentServices = componentServices.ToDictionary(s => s.ComponentType);
    }

    /// <inheritdoc/>
    public Result<ComponentRegistryResponseDto> GetRegistry()
    {
        try
        {
            var components = _componentServices.Values
                .Select(service => service.GetDefinition())
                .ToList();

            var response = new ComponentRegistryResponseDto
            {
                Components = components,
                BindingSchemas = _bindingDefinitionService.GetAllBindingSchemas(),
                Version = 1
            };
            return Result.Ok(response);
        }
        catch (Exception ex)
        {
            return Result.Fail<ComponentRegistryResponseDto>(
                $"Failed to retrieve component registry: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public Result<VdabComponentDto> GetDefinition(ComponentType type)
    {
        try
        {
            if (_componentServices.TryGetValue(type, out var service))
            {
                return Result.Ok(service.GetDefinition());
            }
            return Result.Fail<VdabComponentDto>(
                $"Component type {type} not found in registry");
        }
        catch (Exception ex)
        {
            return Result.Fail<VdabComponentDto>(
                $"Failed to retrieve component definition: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public IReadOnlyDictionary<ComponentType, IComponentService> GetComponentServices()
    {
        return _componentServices;
    }
}