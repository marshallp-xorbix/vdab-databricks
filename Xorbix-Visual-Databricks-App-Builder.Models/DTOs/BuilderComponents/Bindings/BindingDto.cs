namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

public class BindingDto
{
    public required string BindingType { get; set; }
    public required BindingSourceDto Source { get; set; }
}

public class BindingSourceDto
{
    public required string Kind { get; set; }
    public string? Path { get; set; }
    public string? ValueType { get; set; }
    public ResourceBindingSourceDto? Resource { get; set; }
}

public class ResourceBindingSourceDto
{
    public required string Type { get; set; }
    public string? Catalog { get; set; }
    public string? Schema { get; set; }
    public string? Table { get; set; }
    public string? Database { get; set; }
    public string? InstanceName { get; set; }
    public string? ProjectId { get; set; }
    public string? BranchId { get; set; }
    public string? EndpointId { get; set; }
    public string? Volume { get; set; }
    public string? FilePath { get; set; }
    public List<Dictionary<string, object?>>? Columns { get; set; }
    public string? PrimaryKeyColumn { get; set; }
}

