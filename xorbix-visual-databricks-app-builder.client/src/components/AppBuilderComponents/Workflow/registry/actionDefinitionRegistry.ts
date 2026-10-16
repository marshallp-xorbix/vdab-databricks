import type { FC } from "react";
import type { WorkflowActionKind } from "../../../../types/workflow/actionKinds";
import type { WorkflowRoute } from "../../../../types/workflow/workflowRoutes";
import { CallCustomModuleEditor } from "../editors/actions/CallCustomModuleEditor";
import { CallPrebuiltModuleEditor } from "../editors/actions/CallPrebuiltModuleEditor";
import { BuildSqlEditor } from "../editors/actions/BuildSqlEditor";
import { RunSqlEditor } from "../editors/actions/RunSqlEditor";
import { SaveToTableEditor } from "../editors/actions/SaveToTableEditor";
import { SetBindingEditor } from "../editors/actions/SetBindingEditor";
import { ShowModalEditor } from "../editors/actions/ShowModalEditor";
import { StartDatabricksJobEditor } from "../editors/actions/StartDatabricksJobEditor";
import { TriggerToastEditor } from "../editors/actions/TriggerToastEditor";
import type { WorkflowActionEditorProps } from "../editors/actions/types";

export interface WorkflowActionDefinition {
  actionType: WorkflowActionKind;
  label: string;
  category: string;
  supportedRoutes: WorkflowRoute[];
  editor: FC<WorkflowActionEditorProps>;
}

const createDefinition = (
  actionType: WorkflowActionKind,
  label: string,
  category: string,
  supportedRoutes: WorkflowRoute[],
  editor: FC<WorkflowActionEditorProps>,
): WorkflowActionDefinition => {
  return {
    actionType,
    label,
    category,
    supportedRoutes,
    editor,
  };
};

export const WORKFLOW_ACTION_DEFINITION_REGISTRY: WorkflowActionDefinition[] = [
  createDefinition(
    "TriggerToast",
    "Trigger Toast",
    "Feedback",
    ["onSuccess", "onError", "always"],
    TriggerToastEditor,
  ),
  createDefinition(
    "BuildSql",
    "Build SQL",
    "Data",
    ["onSuccess", "onError", "always"],
    BuildSqlEditor,
  ),
  createDefinition(
    "RunSql",
    "Run SQL",
    "Data",
    ["onSuccess", "onError", "always"],
    RunSqlEditor,
  ),
  createDefinition(
    "SetBinding",
    "Set Binding",
    "UI",
    ["onSuccess", "onError", "always"],
    SetBindingEditor,
  ),
  createDefinition(
    "SaveToTable",
    "Save To Table",
    "Data",
    ["onSuccess", "onError", "always"],
    SaveToTableEditor,
  ),
  createDefinition(
    "StartDatabricksJob",
    "Start Databricks Job",
    "Jobs",
    ["onSuccess", "onError", "always"],
    StartDatabricksJobEditor,
  ),
  createDefinition(
    "ShowModal",
    "Show Modal",
    "UI",
    ["onSuccess", "onError", "always"],
    ShowModalEditor,
  ),
  createDefinition(
    "CallCustomModule",
    "Call Custom Module",
    "Code",
    ["onSuccess", "onError", "always"],
    CallCustomModuleEditor,
  ),
  createDefinition(
    "CallPrebuiltModule",
    "Call Prebuilt Module",
    "Code",
    ["onSuccess", "onError", "always"],
    CallPrebuiltModuleEditor,
  ),
];

export const getWorkflowActionDefinition = (actionType: WorkflowActionKind) =>
  WORKFLOW_ACTION_DEFINITION_REGISTRY.find(
    (action) => action.actionType === actionType,
  );
