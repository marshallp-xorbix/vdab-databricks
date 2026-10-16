namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;

/// <summary>
/// A single resolved app-import element. The administrator supplies the target
/// Databricks connection and owner; the app definition itself carries no identity.
/// </summary>
public class ImportAppRequest
{
    /// <summary>
    /// The portable app definition to import.
    /// </summary>
    public required AppExportDto App { get; set; }

    /// <summary>
    /// The ID of the existing Databricks connection (within the importing tenant) to
    /// bind the imported app to.
    /// </summary>
    public int WorkspaceConnectionId { get; set; }

    /// <summary>
    /// The ID of the user (within the importing tenant) to assign as the app owner.
    /// </summary>
    public Guid OwnerId { get; set; }
}
