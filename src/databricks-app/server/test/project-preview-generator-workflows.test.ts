import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
} from "../src/db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../src/db/project-workflow-contract.ts";
import { ApplicationError } from "../src/application-error.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";
import { createAutoscalingAppResourceBinding } from "../src/lakebase-app-resource-binding.ts";
import {
  generateLakebaseProvisionedTestApp,
  generateLakebaseTestApp,
} from "../../scripts/lakebase-test-app.ts";

import { project, createDocument, createTextInput, createButton, createCheckbox, createToggle, createDropdown, createDatePicker, createTimePicker, createSlider, createLabel, createExpander, createColumns, createRows, createTabs, createForm, createModal } from "./project-preview-generator-test-support.ts";
import { createFileUpload, createDataWindow, createEditableDataWindow, createEditableDataWindowBinding, createProvisionedLakebaseBinding, isRecord } from "./project-preview-generator-data-test-support.ts";

test("ProjectPreviewGenerator_RejectsMissingWorkflowModuleFunction", () => {
  const generator = new ProjectPreviewGenerator();
  const workflow: ProjectWorkflowDefinition = {
    version: 1,
    workflows: [{
      codeName: "runCustom",
      trigger: { componentKey: "save-button", eventKey: "onClick" },
      nodes: [{
        id: "custom-module",
        actionType: "callCustomModule",
        schemaVersion: 1,
        params: { functionName: "missing_function" },
      }],
      edges: [],
    }],
  };

  assert.throws(
    () => generator.generate(
      project,
      createDocument([createButton({ key: "save-button" })]),
      workflow,
      "def available_function(ctx):\n    return ctx\n",
    ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "preview_workflow_module_invalid",
  );
});

test("ProjectPreviewGenerator_EscapesTextAndKeepsDistinctPythonNames", () => {
  const generator = new ProjectPreviewGenerator();
  const first = createTextInput({
    codeName: "duplicateName",
    properties: { label: "Name\n'\"; raise Exception()" },
  });
  const second = createTextInput({
    key: "second-input",
    codeName: "duplicateName",
    properties: { label: "Second" },
  });
  const preview = generator.generate(project, createDocument([first, second]));
  const source = preview.files[0]?.content ?? "";

  assert.match(source, /vdab_duplicatename = st\.text_input\(/);
  assert.match(source, /vdab_duplicatename_2 = st\.text_input\(/);
  assert.match(source, /Name\\n\\'\"; raise Exception\(\)/);
  assert.doesNotMatch(source, /\nraise Exception\(\)/);
});


test("ProjectPreviewGenerator_EmitsWorkflowRuntimeCallbacksActionsAndModuleFiles", () => {
  const generator = new ProjectPreviewGenerator();
  const form = createForm({
    key: "order-form",
    codeName: "orderForm",
    children: ["order-name"],
  });
  const modal = createModal({ key: "saved-modal", codeName: "savedModal" });
  const button = createButton({ key: "refresh-button", codeName: "refreshButton" });
  const input = createTextInput({ key: "order-name", codeName: "orderName" });
  const dataWindow = createDataWindow({
    key: "orders-grid",
    codeName: "ordersGrid",
  });
  const customModulesSource = [
    "def normalize_order(ctx):",
    "    ctx.set_label('refreshButton', 'Refreshed')",
    "    return {'ok': True}",
  ].join("\n");
  const workflow: ProjectWorkflowDefinition = {
    version: 1,
    workflows: [
      {
        codeName: "refreshOrders",
        trigger: { componentKey: button.key, eventKey: "onClick" },
        nodes: [
          { id: "toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "Refreshing", duration: { kind: "preset", value: "short" } } },
          { id: "modal", actionType: "showModal", schemaVersion: 1, params: { modalComponentKey: modal.key } },
          { id: "build", actionType: "buildSql", schemaVersion: 1, params: { sqlSourceKind: "unityCatalogTable", sqlTemplate: "SELECT * FROM orders WHERE customer = {customer}", placeholders: [{ token: "customer", componentKey: input.key, valueType: "string", formatHint: "sqlStringLiteral" }], sqlWarehouseId: "warehouse-123", sqlWarehouseName: "Analytics" } },
          { id: "run", actionType: "runSql", schemaVersion: 1, params: { statement: { sourceActionType: "buildSql", nodeId: "build" } } },
          { id: "bind", actionType: "setBinding", schemaVersion: 1, params: { source: { sourceActionType: "runSql", nodeId: "run", outputKey: "rows" }, target: { componentKey: dataWindow.key, bindingType: "unityCatalogTable" } } },
          { id: "job", actionType: "startDatabricksJob", schemaVersion: 1, params: { job: { resourceType: "databricksJob", resourceKey: "12345", jobName: "Refresh orders" } } },
          { id: "custom", actionType: "callCustomModule", schemaVersion: 1, params: { functionName: "normalize_order" } },
          { id: "prebuilt", actionType: "callPrebuiltModule", schemaVersion: 1, params: { functionName: "change_text", namedArguments: { component: "refreshButton", new_label: "Done" } } },
        ],
        edges: [
          { fromNodeId: "toast", toNodeId: "modal", route: "onSuccess" },
          { fromNodeId: "modal", toNodeId: "build", route: "onSuccess" },
          { fromNodeId: "build", toNodeId: "run", route: "onSuccess" },
          { fromNodeId: "run", toNodeId: "bind", route: "onSuccess" },
          { fromNodeId: "bind", toNodeId: "job", route: "onSuccess" },
          { fromNodeId: "job", toNodeId: "custom", route: "onSuccess" },
          { fromNodeId: "custom", toNodeId: "prebuilt", route: "onSuccess" },
        ],
      },
      {
        codeName: "saveOrder",
        trigger: { componentKey: form.key, eventKey: "onSubmit" },
        nodes: [
          { id: "save", actionType: "saveToTable", schemaVersion: 1, params: { sourceFormComponentKey: form.key, targetTable: { tableType: "unityCatalogTable", resourceKey: "orders-table", catalog: "main", schema: "default", table: "orders" }, excludedColumns: [], columnMappings: [{ formChildComponentKey: input.key, targetColumnName: "customer_name" }] } },
        ],
        edges: [],
      },
    ],
  };

  const preview = generator.generate(
    project,
    createDocument([button, input, dataWindow, form, modal]),
    workflow,
    customModulesSource,
  );
  const source = preview.files.find((file) => file.path === "app.py")?.content ?? "";

  assert.deepEqual(preview.files.map((file) => file.path), [
    "app.py",
    "app.yaml",
    "custom_modules.py",
    "requirements.txt",
    ".streamlit/config.toml",
    "prebuilt_modules_library.py",
  ]);
  assert.match(source, /on_click=_vdab_run_component_workflows/);
  assert.match(source, /_vdab_run_component_workflows\('order-form', 'onSubmit'\)/);
  assert.match(source, /_vdab_sql_parameter\(parameter_name, value\)/);
  assert.match(source, /warehouse_id_override=source_output\.get\('sqlWarehouseId'\)/);
  assert.match(source, /sqlWarehouseId': params\.get\('sqlWarehouseId'\)/);
  assert.match(source, /warehouse_id_override or os\.environ\.get\('DATABRICKS_SQL_WAREHOUSE_ID'/);
  assert.match(source, /binding_overrides\[str\(target_code_name\) \+ ':' \+ str\(target\.get\('bindingType'\)\)\]/);
  assert.match(source, /'ordersGrid:unityCatalogTable'/);
  assert.match(source, /_vdab_binding_override_to_dataframe\(_vdab_binding_override_[A-Za-z0-9_]+\)/);
  assert.match(source, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
  assert.match(source, /urllib\.request\.build_opener\(_NoRedirect\)/);
  assert.match(source, /def _vdab_start_databricks_job\(job\):/);
  assert.match(source, /api\/2\.2\/jobs\/run-now/);
  assert.match(source, /'Authorization': 'Bearer ' \+ user_token/);
  assert.match(source, /workspace_host = os\.environ\.get\('DATABRICKS_HOST'/);
  assert.match(source, /job_id > '9223372036854775807'/);
  assert.match(source, /if error\.code in \(401, 403\):/);
  assert.match(source, /import custom_modules/);
  assert.match(source, /import prebuilt_modules_library/);
  assert.doesNotMatch(source, /DATABRICKS_CLIENT_SECRET|DATABRICKS_TOKEN|DATABRICKS_HOST.*params/);
  assert.match(
    preview.files.find((file) => file.path === "custom_modules.py")?.content ?? "",
    /def normalize_order\(ctx\):/,
  );
  assert.match(
    preview.files.find((file) => file.path === "prebuilt_modules_library.py")?.content ?? "",
    /def change_text\(ctx, component, new_label\):/,
  );
});

test("ProjectPreviewGenerator_InjectsPerDatabaseResourceKeysIntoGeneratedWorkflowOnly", () => {
  const resource = createAutoscalingAppResourceBinding({
    projectId: "project-one",
    branchId: "branch-one",
    endpointId: "endpoint-one",
    databaseId: "database-one",
  });
  const form = createForm({ key: "save-form", children: ["customer-name"] });
  const input = createTextInput({ key: "customer-name" });
  const workflow: ProjectWorkflowDefinition = {
    version: 1,
    workflows: [{
      codeName: "saveOrder",
      trigger: { componentKey: form.key, eventKey: "onSubmit" },
      nodes: [
        {
          id: "build",
          actionType: "buildSql",
          schemaVersion: 1,
          params: {
            sqlSourceKind: "lakebaseAutoscaling",
            sqlTemplate: "SELECT 1",
            lakebaseDatabaseName: "appdb",
            lakebaseDatabaseId: "database-one",
            lakebaseProjectId: "project-one",
            lakebaseBranchId: "branch-one",
            lakebaseEndpointId: "endpoint-one",
          },
        },
        {
          id: "save",
          actionType: "saveToTable",
          schemaVersion: 1,
          params: {
            sourceFormComponentKey: form.key,
            targetTable: {
              tableType: "lakebaseAutoscaling",
              database: "appdb",
              databaseId: "database-one",
              projectId: "project-one",
              branchId: "branch-one",
              endpointId: "endpoint-one",
              schema: "public",
              table: "orders",
            },
            columnMappings: [{ formChildComponentKey: input.key, targetColumnName: "customer_name" }],
          },
        },
      ],
      edges: [{ fromNodeId: "build", toNodeId: "save", route: "onSuccess" }],
    }],
  };

  const source = new ProjectPreviewGenerator().generate(
    project,
    createDocument([form, input]),
    workflow,
  ).files[0]?.content ?? "";

  assert.equal(source.match(new RegExp(resource.environmentVariable, "g"))?.length, 2);
  assert.match(source, /'lakebaseResourceEnvironmentVariable': params\.get\('lakebaseResourceEnvironmentVariable'\)/);
  assert.match(source, /target\.get\('resourceEnvironmentVariable'\)/);
  assert.match(source, /resource_environment_variable=source_output\.get\('lakebaseResourceEnvironmentVariable'\)/);
  assert.match(source, /VDAB_LAKEBASE_ENDPOINT_[A-F0-9]{16}/);
  assert.doesNotMatch(source, /lakebaseResourceEnvironmentVariable.*sqlTemplate/);
});
