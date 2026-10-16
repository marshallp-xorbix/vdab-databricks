namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

/// <summary>
/// Standardized workflow action kinds.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/actionKinds.ts
/// </summary>
public enum WorkflowActionKind
{
    TriggerToast,
    ShowModal,
    SaveToTable,
    BuildSql,
    RunSql,
    SetBinding,
    StartDatabricksJob,
    CallCustomModule,
    CallPrebuiltModule,
}