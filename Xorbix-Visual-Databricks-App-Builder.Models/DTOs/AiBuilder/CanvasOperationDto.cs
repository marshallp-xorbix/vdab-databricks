using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

/// <summary>
/// A single canvas or workflow operation emitted by the AI builder agent.
/// Op values: "add" | "delete" | "modify" | "setBindings" (components) | "addWorkflow" | "deleteWorkflow" (workflows) | "updateCustomModulesCode".
/// </summary>
public class CanvasOperationDto
{
    public string Op { get; set; } = string.Empty;
    public string? ComponentId { get; set; }
    public VdabComponentDto? Component { get; set; }
    public string? ParentId { get; set; }
    public int? ChildIndex { get; set; }
    public int? TabIndex { get; set; }
    public WorkflowDto? Workflow { get; set; }
    public Dictionary<string, BindingDto>? Bindings { get; set; }
    public string? CustomModulesCode { get; set; }
}
