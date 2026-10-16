namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;

/// <summary>
/// Outcome of importing a single element (one app or one connection).
/// </summary>
public class ImportElementResultDto
{
    /// <summary>
    /// The name of the imported element as it appears in the created record. When the
    /// element was renamed to avoid a collision this is the final, applied name.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// The ID of the newly created record, when import succeeded.
    /// </summary>
    public int? NewId { get; set; }

    /// <summary>
    /// True when the element was renamed to avoid a name collision.
    /// </summary>
    public bool Renamed { get; set; }
}
