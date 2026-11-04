import type { WorkflowActionKind } from "./actionKinds";
import type { BuildSqlParams } from "./actions/buildSql";
import type { RunSqlParams } from "./actions/runSql";
import type { SaveToTableParams } from "./actions/saveToTable";
import type { SetBindingParams } from "./actions/setBinding";
import type { ShowModalParams } from "./actions/showModal";
import type { StartDatabricksJobParams } from "./actions/startDatabricksJob";
import type { CallCustomModuleParams } from "./actions/callCustomModule";
import type { CallPrebuiltModuleParams } from "./actions/callPrebuiltModule";
import type { TriggerToastParams } from "./actions/triggerToast";

export interface BaseActionNode<
  TActionType extends WorkflowActionKind,
  TParams,
> {
  id: string;
  actionType: TActionType;
  schemaVersion: 1;
  params: TParams;
}

export type TriggerToastNode = BaseActionNode<
  "TriggerToast",
  TriggerToastParams
>;

export type ShowModalNode = BaseActionNode<"ShowModal", ShowModalParams>;

export type SaveToTableNode = BaseActionNode<"SaveToTable", SaveToTableParams>;

export type BuildSqlNode = BaseActionNode<"BuildSql", BuildSqlParams>;

export type RunSqlNode = BaseActionNode<"RunSql", RunSqlParams>;

export type SetBindingNode = BaseActionNode<"SetBinding", SetBindingParams>;

export type StartDatabricksJobNode = BaseActionNode<
  "StartDatabricksJob",
  StartDatabricksJobParams
>;

export type CallCustomModuleNode = BaseActionNode<
  "CallCustomModule",
  CallCustomModuleParams
>;

export type CallPrebuiltModuleNode = BaseActionNode<
  "CallPrebuiltModule",
  CallPrebuiltModuleParams
>;

export type WorkflowActionNode =
  | TriggerToastNode
  | ShowModalNode
  | SaveToTableNode
  | BuildSqlNode
  | RunSqlNode
  | SetBindingNode
  | StartDatabricksJobNode
  | CallCustomModuleNode
  | CallPrebuiltModuleNode;

export type WorkflowActionNodeByType<TActionType extends WorkflowActionKind> =
  Extract<WorkflowActionNode, { actionType: TActionType }>;

export type WorkflowActionParams = WorkflowActionNode["params"];

export const isWorkflowActionNode = <TActionType extends WorkflowActionKind>(
  node: WorkflowActionNode,
  actionType: TActionType,
): node is WorkflowActionNodeByType<TActionType> =>
  node.actionType === actionType;
