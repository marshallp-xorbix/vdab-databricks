import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { LAKEBASE_MIGRATION_FILES } from "../server/src/db/migrations.ts";
import { SMOKE_COMPONENTS } from "./smoke-app-component-fixtures.ts";
import { assertGeneratedPreviewContracts } from "./smoke-app-preview-contracts.ts";
import { runGeneratedWorkflowSmoke } from "./smoke-app-workflow.ts";
import {
  readComponentCount,
  readComponentDefinitionType,
  readComponentType,
  readFirstComponentKey,
  readFirstListedProjectId,
  readImportRequiresChildAppSelection,
  readImportedProject,
  readPortableProjectName,
  readProjectCreator,
  readProjectId,
  readProjectVersion,
  readRegistryBindingCount,
  readRegistryComponentCount,
  readRegistryStoryCount,
  readUnresolvedResourceCount,
  readWorkspaceBoundComponentKeys,
  isRecord,
} from "./smoke-app-response-readers.ts";

const deploymentDirectory = resolve(import.meta.dirname, "..", ".build");
const runtimeDirectory = resolve(import.meta.dirname, "..", "runtime");
for (const fileName of ["package.json", "package-lock.json"]) {
  assert.deepEqual(
    await readFile(resolve(deploymentDirectory, fileName)),
    await readFile(resolve(runtimeDirectory, fileName)),
    `${fileName} must be copied unchanged into the deployment package`,
  );
}
const latestMigrationFileName =
  LAKEBASE_MIGRATION_FILES[LAKEBASE_MIGRATION_FILES.length - 1];
assert.ok(latestMigrationFileName);
await access(
  resolve(
    deploymentDirectory,
    "server/src/db/migrations",
    latestMigrationFileName,
  ),
);
const port = await getAvailablePort();
const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "server/src/main.ts"],
  {
    cwd: deploymentDirectory,
    env: {
      ...process.env,
      NODE_ENV: "development",
      VDAB_AUTH_MODE: "local-test",
      VDAB_LOCAL_USER_ID: "local-smoke-user",
      DATABRICKS_APP_PORT: String(port),
      DATABRICKS_HOST: "",
      DATABRICKS_WORKSPACE_ID: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let childOutput = "";
child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
  childOutput += chunk;
});
child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
  childOutput += chunk;
});

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  const ready = await waitUntilReady(baseUrl, child);
  assert.equal(ready.status, 200);

  const sessionResponse = await fetch(`${baseUrl}/api/v1/session`, {
    headers: {
      "x-forwarded-access-token": "local-smoke-secret-must-not-be-logged",
      "x-forwarded-user": "forged-forwarded-user",
    },
  });
  const session = await sessionResponse.json();
  assert.equal(sessionResponse.status, 200);
  assert.equal(session.userId, "local-smoke-user");
  assert.equal(session.authenticationMode, "local-test");
  assert.doesNotMatch(JSON.stringify(session), /local-smoke-secret/);

  const appsResponse = await fetch(`${baseUrl}/api/v1/workspace/apps`);
  const appsPage = await appsResponse.json();
  assert.equal(appsResponse.status, 200);
  assert.equal(appsPage.authenticationMode, "local-test");
  assert.deepEqual(appsPage.items, []);

  const catalogsResponse = await fetch(
    `${baseUrl}/api/v1/workspace/resources/catalogs`,
  );
  const catalogsPage = await catalogsResponse.json();
  assert.equal(catalogsResponse.status, 200);
  assert.equal(catalogsPage.authenticationMode, "local-test");
  assert.deepEqual(catalogsPage.items, [{ name: "main" }]);
  const schemasResponse = await fetch(
    `${baseUrl}/api/v1/workspace/resources/schemas?catalogName=main`,
  );
  const schemasPage = await schemasResponse.json();
  assert.deepEqual(schemasPage.items, [{ name: "default" }]);
  const tablesResponse = await fetch(
    `${baseUrl}/api/v1/workspace/resources/tables?catalogName=main&schemaName=default`,
  );
  const tablesPage = await tablesResponse.json();
  assert.equal(tablesResponse.status, 200);
  assert.deepEqual(tablesPage.items, [
    {
      name: "customers",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "customer_id", type: "BIGINT", dataType: "LONG" },
        { name: "customer_name", type: "STRING", dataType: "STRING" },
      ],
    },
  ]);
  const volumesResponse = await fetch(
    `${baseUrl}/api/v1/workspace/resources/volumes?catalogName=main&schemaName=default`,
  );
  const volumesPage = await volumesResponse.json();
  assert.deepEqual(volumesPage.items, [{ name: "uploads" }]);
  const genieSpacesResponse = await fetch(
    `${baseUrl}/api/v1/workspace/resources/genie-spaces`,
  );
  const genieSpacesPage = await genieSpacesResponse.json();
  assert.equal(genieSpacesResponse.status, 200);
  assert.equal(genieSpacesPage.authenticationMode, "local-test");
  assert.deepEqual(genieSpacesPage.items, [
    {
      spaceId: "0123456789abcdef0123456789abcdef",
      title: "Sample Genie Space",
    },
  ]);
  const servingEndpointsResponse = await fetch(
    `${baseUrl}/api/v1/workspace/resources/serving-endpoints`,
  );
  const servingEndpointsPage = await servingEndpointsResponse.json();
  assert.equal(servingEndpointsResponse.status, 200);
  assert.equal(servingEndpointsPage.authenticationMode, "local-test");
  assert.deepEqual(servingEndpointsPage.items, [
    {
      name: "sample-chat-endpoint",
      readiness: "ready",
      permissionLevel: "CAN_QUERY",
    },
  ]);
  const invalidResourceResponse = await fetch(
    `${baseUrl}/api/v1/workspace/resources/catalogs?workspaceHost=https%3A%2F%2Foutside.invalid`,
  );
  assert.equal(invalidResourceResponse.status, 400);

  const registryResponse = await fetch(
    `${baseUrl}/api/v1/component-definitions`,
  );
  const registry: unknown = await registryResponse.json();
  assert.equal(registryResponse.status, 200);
  assert.equal(readRegistryComponentCount(registry), 33);
  assert.equal(readRegistryBindingCount(registry), 4);
  assert.equal(readRegistryStoryCount(registry), 8);

  const storyResponse = await fetch(
    `${baseUrl}/api/v1/component-definitions/AmoebaStory`,
  );
  const story: unknown = await storyResponse.json();
  assert.equal(storyResponse.status, 200);
  assert.equal(readComponentDefinitionType(story), "AmoebaStory");

  const createProjectResponse = await fetch(`${baseUrl}/api/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Local smoke project" }),
  });
  const createdProject: unknown = await createProjectResponse.json();
  const createdProjectId = readProjectId(createdProject);
  const createdProjectCreator = readProjectCreator(createdProject);
  const projectListResponse = await fetch(`${baseUrl}/api/v1/projects`);
  const listedProjectId = await readFirstListedProjectId(projectListResponse);
  const getProjectResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}`,
  );
  const loadedProject: unknown = await getProjectResponse.json();
  assert.equal(createProjectResponse.status, 201);
  assert.equal(createdProjectCreator, "local-smoke-user");
  assert.equal(projectListResponse.status, 200);
  assert.equal(listedProjectId, createdProjectId);
  assert.equal(getProjectResponse.status, 200);
  assert.equal(readProjectId(loadedProject), createdProjectId);

  const metadataResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Local smoke project saved",
        description: "Verified through the packaged process.",
        version: 1,
      }),
    },
  );
  const updatedProject: unknown = await metadataResponse.json();
  assert.equal(metadataResponse.status, 200);
  assert.equal(readProjectVersion(updatedProject), 2);

  const componentsResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}/components`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: 2,
        components: SMOKE_COMPONENTS,
      }),
    },
  );
  const savedComponents: unknown = await componentsResponse.json();
  assert.equal(componentsResponse.status, 200);
  assert.equal(readProjectVersion(savedComponents), 3);

  const reopenedComponentsResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}/components`,
  );
  const reopenedComponents: unknown = await reopenedComponentsResponse.json();
  assert.equal(reopenedComponentsResponse.status, 200);
  assert.equal(readComponentCount(reopenedComponents), 36);
  assert.equal(readFirstComponentKey(reopenedComponents), "smoke-input");
  assert.equal(readComponentType(reopenedComponents, 1), "Button");
  assert.equal(readComponentType(reopenedComponents, 2), "Checkbox");
  assert.equal(readComponentType(reopenedComponents, 3), "Toggle");
  assert.equal(readComponentType(reopenedComponents, 4), "Dropdown");
  assert.equal(readComponentType(reopenedComponents, 5), "DatePicker");
  assert.equal(readComponentType(reopenedComponents, 6), "TimePicker");
  assert.equal(readComponentType(reopenedComponents, 7), "Slider");
  assert.equal(readComponentType(reopenedComponents, 8), "Label");
  assert.equal(readComponentType(reopenedComponents, 9), "Expander");
  assert.equal(readComponentType(reopenedComponents, 10), "Columns");
  assert.equal(readComponentType(reopenedComponents, 11), "Rows");
  assert.equal(readComponentType(reopenedComponents, 12), "Tabs");
  assert.equal(readComponentType(reopenedComponents, 13), "Form");
  assert.equal(readComponentType(reopenedComponents, 14), "TextInput");
  assert.equal(readComponentType(reopenedComponents, 15), "Checkbox");
  assert.equal(readComponentType(reopenedComponents, 16), "Modal");
  assert.equal(readComponentType(reopenedComponents, 17), "TextInput");
  assert.equal(readComponentType(reopenedComponents, 18), "FileUpload");
  assert.equal(readComponentType(reopenedComponents, 19), "DataWindow");
  assert.equal(readComponentType(reopenedComponents, 20), "EditableDataWindow");
  assert.equal(readComponentType(reopenedComponents, 21), "BarChart");
  assert.equal(readComponentType(reopenedComponents, 22), "LineChart");
  assert.equal(readComponentType(reopenedComponents, 23), "PieChart");
  assert.equal(readComponentType(reopenedComponents, 24), "DonutChart");
  assert.equal(readComponentType(reopenedComponents, 25), "AmoebaStory");
  assert.equal(readComponentType(reopenedComponents, 26), "FlowFieldStory");
  assert.equal(readComponentType(reopenedComponents, 27), "HeatMapStory");
  assert.equal(readComponentType(reopenedComponents, 28), "HoneycombStory");
  assert.equal(readComponentType(reopenedComponents, 29), "NetworkWebStory");
  assert.equal(readComponentType(reopenedComponents, 30), "PulseWaveStory");
  assert.equal(readComponentType(reopenedComponents, 31), "SpiralStory");
  assert.equal(readComponentType(reopenedComponents, 32), "TerrainStory");
  assert.equal(readComponentType(reopenedComponents, 33), "DashboardEmbed");
  assert.equal(readComponentType(reopenedComponents, 34), "GenieChat");
  assert.equal(readComponentType(reopenedComponents, 35), "ModelChat");

  const preview = await runGeneratedWorkflowSmoke(baseUrl, createdProjectId);
  assertGeneratedPreviewContracts(preview);

  const exportResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}/export`,
  );
  const portableExport: unknown = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.equal(
    readPortableProjectName(portableExport),
    "Local smoke project saved",
  );
  assert.deepEqual(readWorkspaceBoundComponentKeys(portableExport), []);
  const importBundle = structuredClone(portableExport);
  if (!isRecord(importBundle) || !isRecord(importBundle.project)) {
    throw new Error(
      "The packaged export was not a standalone project document.",
    );
  }
  importBundle.project.name = "Local smoke project imported";
  const importResponse = await fetch(`${baseUrl}/api/v1/projects/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(importBundle),
  });
  const importedProject: unknown = await importResponse.json();
  assert.equal(importResponse.status, 201, JSON.stringify(importedProject));
  const importedProjectSummary = readImportedProject(importedProject);
  assert.notEqual(readProjectId(importedProjectSummary), createdProjectId);
  assert.equal(readProjectCreator(importedProjectSummary), "local-smoke-user");
  assert.equal(readImportRequiresChildAppSelection(importedProject), true);
  assert.ok(readUnresolvedResourceCount(importedProject) > 0);

  const staticResponse = await fetch(`${baseUrl}/`);
  assert.equal(staticResponse.status, 200);
  assert.match(staticResponse.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await staticResponse.text(), /<html/);

  process.stdout.write(
    `${JSON.stringify({ event: "app.smoke.passed", checks: ["health", "session", "offline-apps", "workspace-resource-routes", "component-registry", "project-create-list-read", "project-metadata-save-reopen", "project-components-save-reopen", "project-custom-modules-save-reopen", "workflow-save", "all-workflow-actions-and-event-callbacks-preview", "custom-and-prebuilt-module-preview", "textinput-preview", "button-preview", "checkbox-toggle-preview", "dropdown-preview", "date-time-preview", "slider-preview", "label-preview", "expander-preview", "columns-preview", "rows-preview", "tabs-preview", "form-preview", "modal-preview", "file-upload-preview", "data-window-preview", "editable-data-window-preview", "bar-chart-preview", "line-chart-preview", "pie-chart-preview", "donut-chart-preview", "amoeba-story-preview", "flow-field-story-preview", "heat-map-story-preview", "honeycomb-story-preview", "network-web-story-preview", "pulse-wave-story-preview", "spiral-story-preview", "terrain-story-preview", "dashboard-embed-preview", "genie-chat-preview", "model-chat-preview", "standalone-project-export-import", "static"] })}\n`,
  );
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const childExited = once(child, "exit");
    child.kill("SIGTERM");
    await childExited;
  }
  assert.doesNotMatch(childOutput, /local-smoke-secret/);
}

async function getAvailablePort(): Promise<number> {
  const probeServer = createServer();

  await new Promise<void>((resolveListen, rejectListen) => {
    probeServer.once("error", rejectListen);
    probeServer.listen(0, "127.0.0.1", resolveListen);
  });

  const address = probeServer.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;

  await new Promise<void>((resolveClose, rejectClose) => {
    probeServer.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
  });

  return port;
}

async function waitUntilReady(
  baseUrl: string,
  childProcess: ReturnType<typeof spawn>,
): Promise<Response> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (childProcess.exitCode !== null) {
      throw new Error(
        `Local app exited before readiness. Output: ${childOutput}`,
      );
    }

    try {
      return await fetch(`${baseUrl}/api/health/live`);
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
  }

  throw new Error(`Local app did not become ready. Output: ${childOutput}`);
}
