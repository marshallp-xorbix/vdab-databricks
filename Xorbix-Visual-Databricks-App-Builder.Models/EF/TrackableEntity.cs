namespace Xorbix_Visual_Databricks_App_Builder.Models.EF;

/// <summary>
/// Base class for entities that track creation and modification metadata.
/// </summary>
public abstract class TrackableEntity
{
    /// <summary>
    /// Gets or sets the date and time when the entity was created.
    /// </summary>
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Gets or sets the user ID who created the entity.
    /// </summary>
    public Guid? CreatedBy { get; set; }

    /// <summary>
    /// Gets or sets the date and time when the entity was last modified.
    /// </summary>
    public DateTime? ModifiedOn { get; set; }

    /// <summary>
    /// Gets or sets the user ID who last modified the entity.
    /// </summary>
    public Guid? ModifiedBy { get; set; }

    /// <summary>
    /// Gets or sets the date and time when the entity was deleted (for soft deletes).
    /// </summary>
    public DateTime? DeletedOn { get; set; }

    /// <summary>
    /// Gets or sets the user ID who deleted the entity (for soft deletes).
    /// </summary>
    public Guid? DeletedBy { get; set; }
}