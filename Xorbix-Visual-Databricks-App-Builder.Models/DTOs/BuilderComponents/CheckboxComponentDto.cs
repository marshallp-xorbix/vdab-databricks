using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class CheckboxProps
{
    [Required]
    public required string Label { get; set; }
    [Required]
    public required bool DefaultChecked { get; set; }
    public string? Help { get; set; }
    public bool? Disabled { get; set; }
}

public class CheckboxComponentDto : VdabComponentDto
{
    public required CheckboxProps Props { get; set; }
}
