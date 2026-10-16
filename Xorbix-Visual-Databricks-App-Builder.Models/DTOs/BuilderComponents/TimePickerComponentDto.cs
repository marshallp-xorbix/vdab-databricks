using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class TimePickerProps
{
    [Required]
    public required string Label { get; set; }
    public string? DefaultValue { get; set; }
    public int? Step { get; set; }
    public string? Help { get; set; }
    public bool? Disabled { get; set; }
}

public class TimePickerComponentDto : VdabComponentDto
{
    public required TimePickerProps Props { get; set; }
}
