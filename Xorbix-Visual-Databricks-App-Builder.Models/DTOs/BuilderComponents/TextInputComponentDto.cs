using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class TextInputProps
{
    [Required]
    public required string Label { get; set; }
    public string? Placeholder { get; set; }
    public string? DefaultValue { get; set; }
    public string? Help { get; set; }
    public bool? Disabled { get; set; }
    public string? Type { get; set; }
    [Required]
    public required bool Multiline { get; set; }
    public string? Height { get; set; }
}

public class TextInputComponentDto : VdabComponentDto
{
    public required TextInputProps Props { get; set; }
}
