export const WORKFLOW_ACTION_KINDS = [
  "TriggerToast",
  "ShowModal",
  "SaveToTable",
  "BuildSql",
  "RunSql",
  "SetBinding",
  "StartDatabricksJob",
  "CallCustomModule",
  "CallPrebuiltModule",
] as const;

export type WorkflowActionKind = (typeof WORKFLOW_ACTION_KINDS)[number];
