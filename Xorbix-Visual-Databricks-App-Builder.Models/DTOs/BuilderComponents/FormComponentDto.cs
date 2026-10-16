namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class FormProps
{
    public string? SubmitButtonText { get; set; }
    public bool ClearOnSubmit { get; set; } = false;
    public bool EnterToSubmit { get; set; } = true;
    public bool Border { get; set; } = true;
    public string Width { get; set; } = "stretch";
    public string Height { get; set; } = "content";
}

public class FormComponentDto : VdabComponentDto
{
    public required FormProps Props { get; set; }
}
