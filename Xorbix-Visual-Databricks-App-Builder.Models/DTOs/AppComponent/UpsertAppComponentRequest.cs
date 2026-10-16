using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AppComponent;

/// <summary>
/// Request DTO for upserting a single app component
/// </summary>
public class UpsertAppComponentRequest
{
    /// <summary>
    /// App ID this component belongs to. Required for batch operations.
    /// </summary>
    public int? AppId { get; set; }
    
    /// <summary>
    /// Component ID. If provided and > 0, will update existing component. Otherwise, creates new component.
    /// </summary>
    public int? Id { get; set; }

    /// <summary>
    /// Frontend correlation token used to deterministically map request and response items.
    /// </summary>
    public string? FrontendId { get; set; }

    public string? CodeName { get; set; }
    public string? Description { get; set; }
    public ComponentType ComponentType { get; set; }
    public int ComponentVersion { get; set; }
    
    /// <summary>
    /// JSON string representation of component properties
    /// </summary>
    public required string Properties { get; set; }
    
    /// <summary>
    /// JSON string representation of component bindings
    /// </summary>
    public string? Bindings { get; set; }
    
    /// <summary>
    /// JSON string representation of component children IDs
    /// </summary>
    public string? Children { get; set; }

    /// <summary>
    /// JSON string representation of component layout metadata (e.g., {"y": 3})
    /// </summary>
    public string? Layout { get; set; }
}

