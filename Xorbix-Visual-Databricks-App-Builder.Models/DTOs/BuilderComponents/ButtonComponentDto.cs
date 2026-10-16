using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class ButtonProps
{
    [Required]
    public required string Label { get; set; }
    public string? Variant { get; set; }
    public bool? Disabled { get; set; }
    public string? Help { get; set; }
}

public class ButtonComponentDto : VdabComponentDto
{
    public required ButtonProps Props { get; set; }
}
