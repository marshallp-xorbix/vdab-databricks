namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;

/// <summary>
/// A single resolved connection-import element. The administrator supplies the owner
/// and may optionally supply a client secret (never exported); the connection
/// definition itself carries no identity.
/// </summary>
public class ImportConnectionRequest
{
    /// <summary>
    /// The portable connection definition to import.
    /// </summary>
    public required DatabricksConnectionExportDto Connection { get; set; }

    /// <summary>
    /// The ID of the user (within the importing tenant) to assign as the connection owner.
    /// </summary>
    public Guid OwnerId { get; set; }

    /// <summary>
    /// Optional OAuth client secret. When omitted the connection is created without a
    /// secret and must be authorized later.
    /// </summary>
    public string? ClientSecret { get; set; }
}
