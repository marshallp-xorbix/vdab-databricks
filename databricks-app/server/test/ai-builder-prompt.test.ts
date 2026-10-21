import assert from "node:assert/strict";
import test from "node:test";
import { buildAiBuilderMessages } from "../src/ai-builder-prompt.ts";
import type { AiBuilderResourceContext } from "../src/ai-builder-resource-context.ts";
import { readAiBuilderInput } from "../src/ai-builder-input.ts";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import { PROJECT_WORKFLOW_ACTION_TYPES } from "../src/db/project-workflow-contract.ts";
import { readProjectWorkflowInput } from "../src/db/project-workflow-input.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "../src/generation/custom-modules-template.ts";

const componentDefinitions = new ComponentRegistryService().getRegistry().components;
const resourceContext: AiBuilderResourceContext = {
  unityCatalogTables: { status: "partial", items: ["main.default.customers"], truncated: true },
  jobs: { status: "unavailable", items: [], reason: "permission_required" },
  sqlWarehouses: { status: "empty", items: [] },
  lakebaseAutoscaling: { status: "available", items: [] },
};

test("AiBuilderPrompt_IncludesActiveWorkflowEventsStoriesAndModuleSignatures", () => {
  const messages = buildAiBuilderMessages(
    readAiBuilderInput(createRequest(), componentDefinitions),
    componentDefinitions,
    resourceContext,
  );
  const systemMessage = messages[0]?.content ?? "";

  assert.match(systemMessage, /apply_project_operations/);
  assert.match(systemMessage, /preserve every unrelated component, workflow, and module/i);
  for (const actionType of PROJECT_WORKFLOW_ACTION_TYPES) {
    assert.ok(systemMessage.includes(actionType), `Prompt omitted ${actionType}.`);
  }
  for (const route of ["onSuccess", "onError", "always"]) {
    assert.ok(systemMessage.includes(route), `Prompt omitted workflow route ${route}.`);
  }
  for (const event of ["TextInput: onChange", "Button: onClick", "Form: onSubmit"]) {
    assert.ok(systemMessage.includes(event), `Prompt omitted trigger event ${event}.`);
  }
  for (const story of [
    "AmoebaStory", "FlowFieldStory", "HeatMapStory", "HoneycombStory",
    "NetworkWebStory", "PulseWaveStory", "SpiralStory", "TerrainStory",
  ]) {
    assert.ok(systemMessage.includes(story), `Prompt omitted story type ${story}.`);
  }
  assert.match(systemMessage, /change_text\(ctx, component, new_label\)/);
  assert.match(systemMessage, /never invent catalog, schema, table, Volume, warehouse, Lakebase, endpoint, Genie space, or Job/i);
  assert.match(systemMessage, /Workspace resource context/);
  assert.match(systemMessage, /unavailable list is not empty/i);
  assert.match(systemMessage, /partial lists may omit resources/i);
  assert.match(systemMessage, /main\.default\.customers/);
  assert.match(systemMessage, /permission_required/);
});

test("AiBuilderPrompt_ActiveActionExamplesPassWorkflowValidation", () => {
  for (const actionType of PROJECT_WORKFLOW_ACTION_TYPES) {
    const workflow = readProjectWorkflowInput({
      version: 1,
      workflow: { version: 1, workflows: [createWorkflowForAction(actionType)] },
    }).workflow;
    assert.ok(
      workflow.workflows[0]?.nodes.some((node) => node.actionType === actionType),
      `${actionType} had no valid example.`,
    );
  }
});

function createWorkflowForAction(actionType: string): Record<string, unknown> {
  const nodes: Record<string, unknown>[] = [];
  const addNode = (id: string, type: string, params: Record<string, unknown>): void => {
    nodes.push({ id, actionType: type, schemaVersion: 1, params });
  };
  const buildSql = { sqlSourceKind: "unityCatalogTable", sqlTemplate: "SELECT 1", placeholders: [] };
  const runSql = { statement: { sourceActionType: "buildSql", nodeId: "build-1" } };

  if (actionType === "runSql") {
    addNode("build-1", "buildSql", buildSql);
    addNode("run-1", actionType, runSql);
  } else if (actionType === "setBinding") {
    addNode("build-1", "buildSql", buildSql);
    addNode("run-1", "runSql", runSql);
    addNode("binding-1", actionType, {
      source: { sourceActionType: "runSql", nodeId: "run-1", outputKey: "rows" },
      target: { componentKey: "chart-1", bindingType: "chartData" },
    });
  } else {
    addNode("action-1", actionType, actionParameters(actionType));
  }

  return {
    codeName: `workflow_${actionType}`,
    trigger: { componentKey: "button-1", eventKey: "onClick" },
    nodes,
    edges: [],
  };
}

function actionParameters(actionType: string): Record<string, unknown> {
  switch (actionType) {
    case "triggerToast":
      return { body: "Saved", duration: { kind: "preset", value: "short" } };
    case "showModal":
      return { modalComponentKey: "modal-1" };
    case "saveToTable":
      return {
        sourceFormComponentKey: "form-1",
        targetTable: {
          tableType: "unityCatalogTable",
          resourceKey: "selected-table-key",
          catalog: "catalog",
          schema: "schema",
          table: "table",
        },
        excludedColumns: [],
        columnMappings: [],
      };
    case "buildSql":
      return { sqlSourceKind: "unityCatalogTable", sqlTemplate: "SELECT 1", placeholders: [] };
    case "runSql":
      return { statement: { sourceActionType: "buildSql", nodeId: "build-1" } };
    case "setBinding":
      return {
        source: { sourceActionType: "runSql", nodeId: "run-1", outputKey: "rows" },
        target: { componentKey: "chart-1", bindingType: "chartData" },
      };
    case "startDatabricksJob":
      return { job: { resourceType: "databricksJob", resourceKey: "123", jobName: "Selected job" } };
    case "callCustomModule":
      return { functionName: "transform_data" };
    case "callPrebuiltModule":
      return { functionName: "change_text", namedArguments: { component: "title", new_label: "Updated" } };
    default:
      throw new Error(`Missing workflow example for ${actionType}.`);
  }
}

function createRequest(): Record<string, unknown> {
  return {
    version: 1,
    endpointName: "customer-model",
    prompt: "Add a dashboard title",
    history: [],
    components: [],
    workflow: { version: 1, workflows: [] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  };
}
