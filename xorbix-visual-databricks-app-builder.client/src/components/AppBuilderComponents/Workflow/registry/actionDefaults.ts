import type { WorkflowActionKind } from "../../../../types/workflow/actionKinds";
import type { WorkflowActionNodeByType } from "../../../../types/workflow/actionNode";
import type { WorkflowActionNode } from "../../../../types/workflow/actionNode";

const createTriggerToastParams =
  (): WorkflowActionNodeByType<"TriggerToast">["params"] => ({
    body: "",
    duration: { kind: "preset", value: "short" },
  });

const createShowModalParams =
  (): WorkflowActionNodeByType<"ShowModal">["params"] => ({
    modalCodeName: "",
  });

const createSaveToTableParams =
  (): WorkflowActionNodeByType<"SaveToTable">["params"] => ({
    sourceFormComponentCodeName: "",
    targetTable: {
      tableType: "unityCatalogTable",
      workspaceConnectionId: 0,
      catalog: "",
      schema: "",
      table: "",
    },
    excludedColumns: [],
    columnMappings: [],
  });

const createBuildSqlParams =
  (): WorkflowActionNodeByType<"BuildSql">["params"] => ({
    sqlSourceKind: "unityCatalogTable",
    sqlTemplate: "",
    placeholders: [],
    lakebaseAppResourceName: undefined,
    lakebaseDatabaseName: undefined,
    lakebaseProjectId: undefined,
    lakebaseBranchId: undefined,
    lakebaseEndpointId: undefined,
    sqlWarehouseId: undefined,
    sqlWarehouseName: undefined,
  });

const createRunSqlParams =
  (): WorkflowActionNodeByType<"RunSql">["params"] => ({
    statement: {
      sourceActionType: "BuildSql",
      nodeId: "",
    },
  });

const createSetBindingParams =
  (): WorkflowActionNodeByType<"SetBinding">["params"] => ({
    source: {
      sourceActionType: "RunSql",
      nodeId: "",
      outputKey: "rows",
    },
    target: {
      componentCodeName: "",
      bindingType: "unityCatalogTable",
    },
  });

const createStartDatabricksJobParams =
  (): WorkflowActionNodeByType<"StartDatabricksJob">["params"] => ({
    job: {
      resourceType: "databricksJob",
      workspaceConnectionId: 0,
      jobId: "",
      jobName: "",
    },
  });

const createCallCustomModuleParams =
  (): WorkflowActionNodeByType<"CallCustomModule">["params"] => ({
    functionName: "",
  });

const createCallPrebuiltModuleParams =
  (): WorkflowActionNodeByType<"CallPrebuiltModule">["params"] => ({
    functionName: "",
    namedArguments: {},
  });

export const createDefaultActionParams = <
  TActionType extends WorkflowActionKind,
>(
  actionType: TActionType,
): WorkflowActionNodeByType<TActionType>["params"] => {
  switch (actionType) {
    case "TriggerToast":
      return createTriggerToastParams() as WorkflowActionNodeByType<TActionType>["params"];
    case "ShowModal":
      return createShowModalParams() as WorkflowActionNodeByType<TActionType>["params"];
    case "SaveToTable":
      return createSaveToTableParams() as WorkflowActionNodeByType<TActionType>["params"];
    case "BuildSql":
      return createBuildSqlParams() as WorkflowActionNodeByType<TActionType>["params"];
    case "RunSql":
      return createRunSqlParams() as WorkflowActionNodeByType<TActionType>["params"];
    case "SetBinding":
      return createSetBindingParams() as WorkflowActionNodeByType<TActionType>["params"];
    case "StartDatabricksJob":
      return createStartDatabricksJobParams() as WorkflowActionNodeByType<TActionType>["params"];
    case "CallCustomModule":
      return createCallCustomModuleParams() as WorkflowActionNodeByType<TActionType>["params"];
    case "CallPrebuiltModule":
      return createCallPrebuiltModuleParams() as WorkflowActionNodeByType<TActionType>["params"];
    default:
      throw new Error(
        `Unsupported workflow action type: ${actionType satisfies never}`,
      );
  }
};

export const createDefaultActionNode = <TActionType extends WorkflowActionKind>(
  actionType: TActionType,
): WorkflowActionNodeByType<TActionType> => ({
  id: crypto.randomUUID(),
  actionType,
  schemaVersion: 1,
  params: createDefaultActionParams(actionType),
});

export const cloneActionNodeWithDefaults = (
  actionType: WorkflowActionKind,
  nodeId: string,
): WorkflowActionNode => ({
  ...createDefaultActionNode(actionType),
  id: nodeId,
});
