using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class ToggleProps
{
    [Required]
    public required string Label { get; set; }
    [Required]
    public required bool DefaultValue { get; set; } = false;
    public string? Help { get; set; }
    public bool? Disabled { get; set; } = false;
}

public class ToggleComponentDto : VdabComponentDto
{
    public required ToggleProps Props { get; set; }
}
