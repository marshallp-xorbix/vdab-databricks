using System.ComponentModel.DataAnnotations;
namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class SliderProps
{
    [Required]
    public required string Label { get; set; }
    public double? MinValue { get; set; }
    public double? MaxValue { get; set; }
    public double? DefaultValue { get; set; }
    public double? UpperValue { get; set; }
    public double? Step { get; set; }
    public bool? Disabled { get; set; }
    public string? Help { get; set; }
    public string? Format { get; set; }
    [Required]
    public required bool Ranged { get; set; }

}

public class SliderComponentDto : VdabComponentDto
{
    public required SliderProps Props { get; set; }
}