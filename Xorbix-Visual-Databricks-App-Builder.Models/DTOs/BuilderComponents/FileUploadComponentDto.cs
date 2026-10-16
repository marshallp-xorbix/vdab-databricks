namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class FileUploadProps
{
    public string? Label { get; set; }
}

public class FileUploadComponentDto : VdabComponentDto
{
    public required FileUploadProps Props { get; set; }
}
