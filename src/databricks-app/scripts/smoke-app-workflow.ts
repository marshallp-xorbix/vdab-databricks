import assert from "node:assert/strict";
import {
  readCustomModulesSource,
  readPreviewAppSource,
  readPreviewOnly,
  readProjectVersion,
  runGeneratedWorkflowHarness,
} from "./smoke-app-response-readers.ts";

/** Saves custom modules and a representative workflow, then returns its generated preview. */
export async function runGeneratedWorkflowSmoke(
  baseUrl: string,
  createdProjectId: string,
): Promise<unknown> {
  const customModulesRoute = `${baseUrl}/api/v1/projects/${createdProjectId}/custom-modules`;
  const currentCustomModules = await fetch(customModulesRoute);
  const currentCustomModulesDocument: unknown =
    await currentCustomModules.json();
  const customModulesSource =
    "def normalize_order(ctx):\n    return {'ok': True}\n";
  const savedCustomModulesResponse = await fetch(customModulesRoute, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      expectedVersion: readProjectVersion(currentCustomModulesDocument),
      source: customModulesSource,
    }),
  });
  const savedCustomModules: unknown = await savedCustomModulesResponse.json();
  assert.equal(savedCustomModulesResponse.status, 200);
  assert.equal(
    readCustomModulesSource(savedCustomModules),
    customModulesSource,
  );

  const workflowResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}/workflow`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: readProjectVersion(savedCustomModules),
        workflow: {
          version: 1,
          workflows: [
            {
              codeName: "smokeButtonClick",
              trigger: { componentKey: "smoke-button", eventKey: "onClick" },
              nodes: [
                {
                  id: "toast",
                  actionType: "triggerToast",
                  schemaVersion: 1,
                  params: {
                    body: "Refreshing",
                    duration: { kind: "preset", value: "short" },
                  },
                },
                {
                  id: "modal",
                  actionType: "showModal",
                  schemaVersion: 1,
                  params: { modalComponentKey: "smoke-modal" },
                },
                {
                  id: "build",
                  actionType: "buildSql",
                  schemaVersion: 1,
                  params: {
                    sqlSourceKind: "unityCatalogTable",
                    sqlTemplate:
                      "SELECT * FROM main.default.customers WHERE customer_name = {customer}",
                    placeholders: [
                      {
                        token: "customer",
                        componentKey: "smoke-input",
                        valueType: "string",
                        formatHint: "sqlStringLiteral",
                      },
                    ],
                    sqlWarehouseId: "warehouse-smoke",
                    sqlWarehouseName: "Analytics",
                  },
                },
                {
                  id: "run",
                  actionType: "runSql",
                  schemaVersion: 1,
                  params: {
                    statement: {
                      sourceActionType: "buildSql",
                      nodeId: "build",
                    },
                  },
                },
                {
                  id: "bind",
                  actionType: "setBinding",
                  schemaVersion: 1,
                  params: {
                    source: {
                      sourceActionType: "runSql",
                      nodeId: "run",
                      outputKey: "rows",
                    },
                    target: {
                      componentKey: "smoke-data-window",
                      bindingType: "unityCatalogTable",
                    },
                  },
                },
                {
                  id: "job",
                  actionType: "startDatabricksJob",
                  schemaVersion: 1,
                  params: {
                    job: {
                      resourceType: "databricksJob",
                      resourceKey: "12345",
                      jobName: "Refresh customers",
                    },
                  },
                },
                {
                  id: "custom",
                  actionType: "callCustomModule",
                  schemaVersion: 1,
                  params: { functionName: "normalize_order" },
                },
                {
                  id: "prebuilt",
                  actionType: "callPrebuiltModule",
                  schemaVersion: 1,
                  params: {
                    functionName: "change_text",
                    namedArguments: {
                      component: "smokeButton",
                      new_label: "Done",
                    },
                  },
                },
                {
                  id: "sql-success-toast",
                  actionType: "triggerToast",
                  schemaVersion: 1,
                  params: {
                    body: "SQL succeeded",
                    duration: { kind: "preset", value: "short" },
                  },
                },
                {
                  id: "sql-error-toast",
                  actionType: "triggerToast",
                  schemaVersion: 1,
                  params: {
                    body: "SQL failed",
                    duration: { kind: "preset", value: "short" },
                  },
                },
                {
                  id: "job-success-toast",
                  actionType: "triggerToast",
                  schemaVersion: 1,
                  params: {
                    body: "Job succeeded",
                    duration: { kind: "preset", value: "short" },
                  },
                },
                {
                  id: "job-error-toast",
                  actionType: "triggerToast",
                  schemaVersion: 1,
                  params: {
                    body: "Job failed",
                    duration: { kind: "preset", value: "short" },
                  },
                },
              ],
              edges: [
                { fromNodeId: "toast", toNodeId: "modal", route: "onSuccess" },
                { fromNodeId: "modal", toNodeId: "build", route: "onSuccess" },
                { fromNodeId: "build", toNodeId: "run", route: "onSuccess" },
                { fromNodeId: "run", toNodeId: "bind", route: "onSuccess" },
                {
                  fromNodeId: "run",
                  toNodeId: "sql-success-toast",
                  route: "onSuccess",
                },
                {
                  fromNodeId: "run",
                  toNodeId: "sql-error-toast",
                  route: "onError",
                },
                { fromNodeId: "bind", toNodeId: "job", route: "onSuccess" },
                { fromNodeId: "job", toNodeId: "custom", route: "onSuccess" },
                {
                  fromNodeId: "job",
                  toNodeId: "job-success-toast",
                  route: "onSuccess",
                },
                {
                  fromNodeId: "job",
                  toNodeId: "job-error-toast",
                  route: "onError",
                },
                {
                  fromNodeId: "custom",
                  toNodeId: "prebuilt",
                  route: "onSuccess",
                },
              ],
            },
            {
              codeName: "smokeSaveOrder",
              trigger: { componentKey: "smoke-form", eventKey: "onSubmit" },
              nodes: [
                {
                  id: "save",
                  actionType: "saveToTable",
                  schemaVersion: 1,
                  params: {
                    sourceFormComponentKey: "smoke-form",
                    targetTable: {
                      tableType: "unityCatalogTable",
                      resourceKey: "customers-table",
                      catalog: "main",
                      schema: "default",
                      table: "customers",
                    },
                    excludedColumns: [],
                    columnMappings: [
                      {
                        formChildComponentKey: "smoke-form-input",
                        targetColumnName: "customer_name",
                      },
                    ],
                  },
                },
                {
                  id: "save-success-toast",
                  actionType: "triggerToast",
                  schemaVersion: 1,
                  params: {
                    body: "Saved",
                    duration: { kind: "preset", value: "short" },
                  },
                },
                {
                  id: "save-error-toast",
                  actionType: "triggerToast",
                  schemaVersion: 1,
                  params: {
                    body: "Save failed",
                    duration: { kind: "preset", value: "short" },
                  },
                },
              ],
              edges: [
                {
                  fromNodeId: "save",
                  toNodeId: "save-success-toast",
                  route: "onSuccess",
                },
                {
                  fromNodeId: "save",
                  toNodeId: "save-error-toast",
                  route: "onError",
                },
              ],
            },
          ],
        },
      }),
    },
  );
  assert.equal(workflowResponse.status, 200);

  const previewResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}/preview`,
    { method: "POST" },
  );
  const preview: unknown = await previewResponse.json();
  assert.equal(previewResponse.status, 200, JSON.stringify(preview));
  assert.equal(readPreviewOnly(preview), true);
  runGeneratedWorkflowHarness(preview);
  return preview;
}
