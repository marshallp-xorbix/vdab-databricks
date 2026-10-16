using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class DropdownOptionDto
{
    public required string Value { get; set; }
}

public class DropdownProps
{
    [Required]
    public required string Label { get; set; }
    [Required]
    public required List<DropdownOptionDto> Options { get; set; }
    public string? DefaultValue { get; set; }
    public bool? Disabled { get; set; } = false;
    public string? Help { get; set; }
    public string? Placeholder { get; set; }
    [Required]
    public required bool Multiselect { get; set; } = false;
}

public class DropdownComponentDto : VdabComponentDto
{
    public required DropdownProps Props { get; set; }
}
