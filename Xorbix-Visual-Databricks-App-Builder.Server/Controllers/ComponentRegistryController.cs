using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Controller for component registry operations.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class ComponentRegistryController : ControllerBase
{
    private readonly IComponentRegistryService _registryService;
    private readonly ILogger<ComponentRegistryController> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="ComponentRegistryController"/> class.
    /// </summary>
    public ComponentRegistryController(
        IComponentRegistryService registryService,
        ILogger<ComponentRegistryController> logger)
    {
        _registryService = registryService;
        _logger = logger;
    }

    /// <summary>
    /// Get all component definitions from the registry
    /// </summary>
    /// <returns>The component registry with all available components</returns>
    [HttpGet]
    public IActionResult GetRegistry()
    {
        _logger.LogInformation("Retrieving component registry");
        var result = _registryService.GetRegistry();
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Get definition for a specific component type
    /// </summary>
    /// <param name="type">The component type identifier</param>
    /// <returns>The component definition or NotFound</returns>
    [HttpGet("{type}")]
    public IActionResult GetComponentDefinition(string type)
    {
        _logger.LogInformation("Retrieving component definition for type: {Type}", type);

        if (!Enum.TryParse<Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.ComponentType>(type, out var componentType))
        {
            _logger.LogWarning("Invalid component type requested: {Type}", type);
            return BadRequest(new { error = $"Invalid component type: {type}" });
        }

        var result = _registryService.GetDefinition(componentType);
        return this.HandleFluentResult(result);
    }
}

