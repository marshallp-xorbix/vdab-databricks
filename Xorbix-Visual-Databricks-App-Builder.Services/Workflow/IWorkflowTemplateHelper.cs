using System.Text;
using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

public interface IWorkflowTemplateHelper
{
    Result Validate(
        List<VdabComponentDto> components,
        WorkflowDefinitionDto workflowDefinition,
        IReadOnlyList<NormalizedAppResourceDto>? normalizedAppResources = null);
    void AppendRuntime(StringBuilder sb, WorkflowDefinitionDto workflowDefinition, List<VdabComponentDto> components);
}
