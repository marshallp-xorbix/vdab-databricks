namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AppComponent;

/// <summary>
/// Request DTO for batch upsert operations
/// </summary>
public class UpsertBatchRequest
{
    public int AppId { get; set; }
    public required IEnumerable<UpsertAppComponentRequest> Components { get; set; }
}
