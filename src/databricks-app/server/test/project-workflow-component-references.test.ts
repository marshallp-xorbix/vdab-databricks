import assert from "node:assert/strict";
import test from "node:test";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import { validateProjectWorkflowComponentReferences } from "../src/db/project-workflow-component-references.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../src/db/project-workflow-contract.ts";

const definitions = new ComponentRegistryService().getRegistry().components;
const components: ProjectComponent[] = [
  component("submit", "Button", "submitButton"),
  component("dialog", "Modal", "confirmDialog"),
  component("form", "Form", "orderForm", ["name"]),
  component("name", "TextInput", "orderName"),
  component("table", "DataWindow", "ordersTable"),
  component("chart", "BarChart", "ordersChart"),
];

test("ProjectWorkflowComponentReferences_AcceptsSupportedTriggersAndTargets", () => {
  const workflow: ProjectWorkflowDefinition = {
    version: 1,
    workflows: [{
      codeName: "onClick",
      trigger: { componentKey: "submit", eventKey: "onClick" },
      nodes: [
        action("modal-action", "showModal", { modalComponentKey: "dialog" }),
        action("build-action", "buildSql", {
          sqlSourceKind: "unityCatalogTable",
          sqlTemplate: "SELECT {{name}}",
          placeholders: [{ token: "name", componentKey: "name", valueType: "string" }],
        }),
        action("binding-action", "setBinding", {
          source: { sourceActionType: "runSql", nodeId: "run-action", outputKey: "rows" },
          target: { componentKey: "chart", bindingType: "chartData" },
        }),
      ],
      edges: [],
    }],
  };

  assert.doesNotThrow(() =>
    validateProjectWorkflowComponentReferences(workflow, components, definitions),
  );
});

test("ProjectWorkflowComponentReferences_RequiresARegisteredEventAndModal", () => {
  const workflow: ProjectWorkflowDefinition = {
    version: 1,
    workflows: [{
      codeName: "badTrigger",
      trigger: { componentKey: "submit", eventKey: "onSubmit" },
      nodes: [action("modal-action", "showModal", { modalComponentKey: "missing" })],
      edges: [],
    }],
  };

  assert.throws(
    () => validateProjectWorkflowComponentReferences(workflow, components, definitions),
    /supported by the project registry/,
  );
});

test("ProjectWorkflowComponentReferences_RestrictsSaveToTableToTheTriggerFormsDirectFields", () => {
  const workflow: ProjectWorkflowDefinition = {
    version: 1,
    workflows: [{
      codeName: "onSubmit",
      trigger: { componentKey: "form", eventKey: "onSubmit" },
      nodes: [action("save-action", "saveToTable", {
        sourceFormComponentKey: "form",
        targetTable: {
          tableType: "unityCatalogTable",
          resourceKey: "orders",
          catalog: "main",
          schema: "default",
          table: "orders",
        },
        excludedColumns: [],
        columnMappings: [{ formChildComponentKey: "submit", targetColumnName: "name" }],
      })],
      edges: [],
    }],
  };

  assert.throws(
    () => validateProjectWorkflowComponentReferences(workflow, components, definitions),
    /direct children of the source Form/,
  );
});

function component(
  key: string,
  type: string,
  codeName: string,
  children: string[] = [],
): ProjectComponent {
  return {
    key,
    type: type as ProjectComponent["type"],
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

function action(
  id: string,
  actionType: ProjectWorkflowDefinition["workflows"][number]["nodes"][number]["actionType"],
  params: Record<string, unknown>,
): ProjectWorkflowDefinition["workflows"][number]["nodes"][number] {
  return { id, actionType, schemaVersion: 1, params };
}
