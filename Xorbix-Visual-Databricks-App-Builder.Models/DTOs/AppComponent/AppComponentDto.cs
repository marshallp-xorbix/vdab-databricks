using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AppComponent;

/// <summary>
/// Response DTO for AppComponent entity
/// </summary>
public class AppComponentDto : TrackableEntity
{
    public int Id { get; set; }
    public int AppId { get; set; }
    public string? FrontendId { get; set; }
    public string? CodeName { get; set; }
    public string? Description { get; set; }
    public ComponentType ComponentType { get; set; }
    public int ComponentVersion { get; set; }
    public required string Properties { get; set; }
    public string? Bindings { get; set; }
    public string? Children { get; set; }
    public string? Layout { get; set; }
}

