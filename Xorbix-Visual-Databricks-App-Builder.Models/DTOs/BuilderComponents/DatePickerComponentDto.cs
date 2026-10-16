using System.ComponentModel.DataAnnotations;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class DatePickerProps
{
    [Required]
    public required string Label { get; set; }
    public string? DefaultValue { get; set; }
    public string? MinDate { get; set; }
    public string? MaxDate { get; set; }
    public string? Format { get; set; }
    public string? Help { get; set; }
    public bool? Disabled { get; set; }
}

public class DatePickerComponentDto : VdabComponentDto
{
    public required DatePickerProps Props { get; set; }
}
