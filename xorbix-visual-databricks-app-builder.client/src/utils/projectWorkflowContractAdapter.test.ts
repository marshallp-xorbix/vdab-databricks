import { describe, expect, it } from "vitest";
import type { IComponentDefinition } from "../models/ComponentRegistry";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import {
  toPortableWorkflowDefinition,
  toWorkflowBuilderComponents,
  toWorkflowBuilderDefinition,
} from "./projectWorkflowContractAdapter";

const projectComponents = [
  component("button", "Button", "submitButton"),
  component("dialog", "Modal", "savedDialog"),
  component("form", "Form", "orderForm", ["field"]),
  component("field", "TextInput", "orderName"),
  component("table", "DataWindow", "ordersTable"),
];

const componentDefinitions: IComponentDefinition[] = projectComponents.map((item) => ({
  id: `template-${item.type}`,
  codeName: `template${item.type}`,
  type: item.type,
  category: item.type === "DataWindow" ? "Data" : "Controls",
  icon: "Box",
  layout: null,
  schemaVersion: 1,
  bindings: null,
  supportedBindings: null,
  supportedEvents: item.type === "Button" ? ["onClick"] : null,
  children: null,
  props: {},
}));

describe("projectWorkflowContractAdapter", () => {
  it("round trips all action kinds, component keys, Lakebase refs, and strips workspace IDs", () => {
    const portable: IProjectWorkflowDefinition = {
      version: 1,
      workflows: [{
        codeName: "onContinue",
        trigger: { componentKey: "button", eventKey: "onClick" },
        nodes: [
          node("toast", "triggerToast", { body: "Saved", duration: { kind: "preset", value: "short" } }),
          node("modal", "showModal", { modalComponentKey: "dialog" }),
          node("save", "saveToTable", {
            sourceFormComponentKey: "form",
            targetTable: {
              tableType: "lakebaseAutoscaling",
              resourceKey: "orders-database",
              catalog: "",
              schema: "public",
              table: "orders",
              projectId: "lakebase-project",
              branchId: "production",
              endpointId: "primary",
              database: "app",
            },
            excludedColumns: [],
            columnMappings: [{ formChildComponentKey: "field", targetColumnName: "customer_name" }],
          }),
          node("build", "buildSql", {
            sqlSourceKind: "unityCatalogTable",
            sqlTemplate: "SELECT * FROM orders WHERE name = {{name}}",
            placeholders: [{ token: "name", componentKey: "field", valueType: "string", formatHint: "sqlStringLiteral" }],
            sqlWarehouseId: "warehouse-123",
            sqlWarehouseName: "Analytics",
          }),
          node("run", "runSql", { statement: { sourceActionType: "buildSql", nodeId: "build" } }),
          node("binding", "setBinding", {
            source: { sourceActionType: "runSql", nodeId: "run", outputKey: "rows" },
            target: { componentKey: "table", bindingType: "unityCatalogTable" },
          }),
          node("job", "startDatabricksJob", {
            job: { resourceType: "databricksJob", resourceKey: "job-123", jobName: "Refresh orders" },
          }),
          node("custom", "callCustomModule", { functionName: "normalize_order" }),
          node("prebuilt", "callPrebuiltModule", { functionName: "send_notification", namedArguments: { channel: "ops" } }),
        ],
        edges: [],
      }],
    };

    const editorModel = toWorkflowBuilderDefinition(portable, projectComponents);
    const portableAgain = toPortableWorkflowDefinition(
      editorModel,
      projectComponents,
    );
    const legacyJson = JSON.stringify(editorModel);
    const portableJson = JSON.stringify(portableAgain);

    expect(editorModel.workflows[0]?.trigger.componentCodeName).toBe("submitButton");
    expect(editorModel.workflows[0]?.nodes.map((action) => action.actionType)).toEqual([
      "TriggerToast", "ShowModal", "SaveToTable", "BuildSql", "RunSql",
      "SetBinding", "StartDatabricksJob", "CallCustomModule", "CallPrebuiltModule",
    ]);
    expect(legacyJson).toContain('"workspaceConnectionId":0');
    expect(portableAgain.workflows[0]?.trigger.componentKey).toBe("button");
    expect(portableAgain.workflows[0]?.nodes.map((action) => action.actionType)).toEqual([
      "triggerToast", "showModal", "saveToTable", "buildSql", "runSql",
      "setBinding", "startDatabricksJob", "callCustomModule", "callPrebuiltModule",
    ]);
    expect(portableAgain.workflows[0]?.nodes[2]?.params.targetTable).toMatchObject({
      tableType: "lakebaseAutoscaling",
      projectId: "lakebase-project",
      branchId: "production",
      endpointId: "primary",
      database: "app",
    });
    expect(portableJson).not.toMatch(/workspaceConnectionId|workspaceHost|accessToken/);
    expect(portableAgain.workflows[0]?.nodes[2]?.params.columnMappings).toEqual([
      { formChildComponentKey: "field", targetColumnName: "customer_name" },
    ]);
    expect(portableAgain.workflows[0]?.nodes[3]?.params).toMatchObject({
      sqlWarehouseId: "warehouse-123",
      sqlWarehouseName: "Analytics",
    });
  });

  it("maps project component keys and definition events into the retained editor shape", () => {
    const mapped = toWorkflowBuilderComponents(projectComponents, componentDefinitions);

    expect(mapped[0]).toMatchObject({
      id: "button",
      codeName: "submitButton",
      type: "Button",
      supportedEvents: ["onClick"],
    });
    expect(mapped[2]?.children).toEqual(["field"]);
  });
});

function component(
  key: string,
  type: string,
  codeName: string,
  children: string[] = [],
): IProjectComponent {
  return {
    key,
    type,
    schemaVersion: 1,
    componentVersion: 1,
    codeName,
    description: null,
    properties: {},
    bindings: null,
    children,
    layout: null,
  };
}

function node(
  id: string,
  actionType: IProjectWorkflowDefinition["workflows"][number]["nodes"][number]["actionType"],
  params: Record<string, unknown>,
): IProjectWorkflowDefinition["workflows"][number]["nodes"][number] {
  return { id, actionType, schemaVersion: 1, params };
}

