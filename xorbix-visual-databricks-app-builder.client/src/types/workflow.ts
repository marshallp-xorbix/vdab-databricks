import type { WorkflowDefinition } from "./workflow/workflowDefinition";

export { WORKFLOW_ACTION_KINDS } from "./workflow/actionKinds";
export type { WorkflowActionKind } from "./workflow/actionKinds";
export { isWorkflowActionNode } from "./workflow/actionNode";
export type {
  BaseActionNode,
  BuildSqlNode,
  CallCustomModuleNode,
  CallPrebuiltModuleNode,
  RunSqlNode,
  SaveToTableNode,
  SetBindingNode,
  ShowModalNode,
  StartDatabricksJobNode,
  TriggerToastNode,
  WorkflowActionNode,
  WorkflowActionNodeByType,
} from "./workflow/actionNode";
export {
  DEFAULT_ALWAYS_ROUTE,
  DEFAULT_ERROR_ROUTE,
  DEFAULT_SUCCESS_ROUTE,
  WORKFLOW_ROUTES,
} from "./workflow/workflowRoutes";
export type {
  Workflow,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowTrigger,
} from "./workflow/workflowDefinition";
export type { WorkflowRoute } from "./workflow/workflowRoutes";
export type { WorkflowFocusRequest } from "./workflow/workflowFocus";
export type {
  BuildSqlPlaceholderReference,
  DatabricksJobResourceRef,
  LakebaseAutoscalingTableRef,
  LakebaseTableRef,
  SaveTargetTableRef,
  UnityCatalogTableRef,
  WorkflowSqlSourceKind,
} from "./workflow/sharedReferences";
export { isLakebaseAutoscalingTableRef } from "./workflow/sharedReferences";

export type { BuildSqlParams } from "./workflow/actions/buildSql";
export type {
  RunSqlParams,
  RunSqlStatementRef,
} from "./workflow/actions/runSql";
export type {
  SaveToTableColumnMapping,
  SaveToTableColumnOverride,
  SaveToTableColumnOverrideReason,
  SaveToTableParams,
} from "./workflow/actions/saveToTable";
export type {
  SetBindingParams,
  SetBindingSourceRef,
  SetBindingTargetRef,
  SetBindingTargetType,
} from "./workflow/actions/setBinding";
export type {
  CallCustomModuleParams,
  CallCustomModuleResult,
} from "./workflow/actions/callCustomModule";
export type { CallPrebuiltModuleParams } from "./workflow/actions/callPrebuiltModule";
export type { ShowModalParams } from "./workflow/actions/showModal";
export type { StartDatabricksJobParams } from "./workflow/actions/startDatabricksJob";
export type {
  ToastDuration,
  ToastPresetDuration,
  TriggerToastParams,
} from "./workflow/actions/triggerToast";

export type WorkflowNode = import("./workflow/actionNode").WorkflowActionNode;

export const EMPTY_WORKFLOW_DEFINITION: WorkflowDefinition = {
  version: 1,
  workflows: [],
};
