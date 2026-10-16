using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;

/// <summary>
/// Portable representation of an app component used for export/import.
/// Excludes all identity, ownership, and audit fields so the component can be
/// recreated under a different tenant and owner.
/// </summary>
public class AppComponentExportDto
{
    /// <summary>
    /// The user-editable code name of the component.
    /// </summary>
    public string? CodeName { get; set; }

    /// <summary>
    /// The description of the component.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// The type of the component.
    /// </summary>
    public ComponentType ComponentType { get; set; }

    /// <summary>
    /// The version of the component.
    /// </summary>
    public int ComponentVersion { get; set; }

    /// <summary>
    /// The JSON properties of the component.
    /// </summary>
    public required string Properties { get; set; }

    /// <summary>
    /// The JSON bindings of the component.
    /// </summary>
    public string? Bindings { get; set; }

    /// <summary>
    /// The JSON child structure of the component.
    /// </summary>
    public string? Children { get; set; }

    /// <summary>
    /// The JSON layout metadata of the component.
    /// </summary>
    public string? Layout { get; set; }
}
