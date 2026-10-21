import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";

const deploymentDirectory = resolve(import.meta.dirname, "..", ".build");
const runtimeDirectory = resolve(import.meta.dirname, "..", "runtime");
for (const fileName of ["package.json", "package-lock.json"]) {
  assert.deepEqual(
    await readFile(resolve(deploymentDirectory, fileName)),
    await readFile(resolve(runtimeDirectory, fileName)),
    `${fileName} must be copied unchanged into the deployment package`,
  );
}
await access(
  resolve(
    deploymentDirectory,
    "server/src/db/migrations/005_project_portability.sql",
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
  assert.deepEqual(tablesPage.items, [{
    name: "customers",
    dataSourceFormat: "DELTA",
    columns: [
      { name: "customer_id", type: "BIGINT", dataType: "LONG" },
      { name: "customer_name", type: "STRING", dataType: "STRING" },
    ],
  }]);
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
  assert.deepEqual(genieSpacesPage.items, [{
    spaceId: "0123456789abcdef0123456789abcdef",
    title: "Sample Genie Space",
  }]);
  const servingEndpointsResponse = await fetch(
    `${baseUrl}/api/v1/workspace/resources/serving-endpoints`,
  );
  const servingEndpointsPage = await servingEndpointsResponse.json();
  assert.equal(servingEndpointsResponse.status, 200);
  assert.equal(servingEndpointsPage.authenticationMode, "local-test");
  assert.deepEqual(servingEndpointsPage.items, [{
    name: "sample-chat-endpoint",
    readiness: "ready",
    permissionLevel: "CAN_QUERY",
  }]);
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

  const componentDefinition = {
    key: "smoke-input",
    type: "TextInput",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeInput",
    description: null,
    properties: { label: "Smoke input" },
    bindings: null,
    children: [],
    layout: null,
  };
  const buttonDefinition = {
    key: "smoke-button",
    type: "Button",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeButton",
    description: null,
    properties: {
      label: "Continue",
      variant: "primary",
      disabled: false,
      help: "Continue the smoke flow.",
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const checkboxDefinition = {
    key: "smoke-checkbox",
    type: "Checkbox",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeCheckbox",
    description: null,
    properties: {
      label: "Approved",
      defaultChecked: true,
      help: "Review this record.",
      disabled: false,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const toggleDefinition = {
    key: "smoke-toggle",
    type: "Toggle",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeToggle",
    description: null,
    properties: {
      label: "Notifications",
      defaultValue: false,
      help: "Send update notifications.",
      disabled: false,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const dropdownDefinition = {
    key: "smoke-dropdown",
    type: "Dropdown",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeDropdown",
    description: null,
    properties: {
      label: "Choose a color",
      options: [{ value: "Blue" }, { value: "Green" }],
      defaultValue: "Green",
      disabled: false,
      help: "Select a color.",
      placeholder: "Pick a color",
      multiselect: true,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const datePickerDefinition = {
    key: "smoke-date-picker",
    type: "DatePicker",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeDatePicker",
    description: null,
    properties: {
      label: "Launch date",
      defaultValue: "2026-11-12",
      minDate: "2026-01-01",
      maxDate: "2026-12-31",
      format: "DD/MM/YYYY",
      help: "Choose a launch date.",
      disabled: false,
    },
    bindings: null,
    children: [],
    layout: { tabIndex: 0, y: 0 },
  };
  const timePickerDefinition = {
    key: "smoke-time-picker",
    type: "TimePicker",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeTimePicker",
    description: null,
    properties: {
      label: "Run time",
      defaultValue: "08:30:00",
      step: 1800,
      help: "Choose a run time.",
      disabled: false,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const sliderDefinition = {
    key: "smoke-slider",
    type: "Slider",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeSlider",
    description: null,
    properties: {
      label: "Budget range",
      minValue: 0,
      maxValue: 100,
      defaultValue: 25,
      upperValue: 75,
      step: 5,
      disabled: false,
      help: "Set the budget range.",
      format: "percent",
      ranged: true,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const labelDefinition = {
    key: "smoke-label",
    type: "Label",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeLabel",
    description: null,
    properties: {
      text: "Workspace <overview>",
      fontSize: "large",
      bold: true,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const expanderDefinition = {
    key: "smoke-expander",
    type: "Expander",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeExpander",
    description: null,
    properties: { sectionTitle: "Workspace details", defaultExpanded: true },
    bindings: null,
    children: [labelDefinition.key],
    layout: null,
  };
  const columnsDefinition = {
    key: "smoke-columns",
    type: "Columns",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeColumns",
    description: null,
    properties: { columnCount: 2 },
    bindings: null,
    children: [componentDefinition.key],
    layout: null,
  };
  const rowsDefinition = {
    key: "smoke-rows",
    type: "Rows",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeRows",
    description: null,
    properties: { rowCount: 2 },
    bindings: null,
    children: [buttonDefinition.key],
    layout: null,
  };
  const tabsDefinition = {
    key: "smoke-tabs",
    type: "Tabs",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeTabs",
    description: null,
    properties: { tabs: ["Overview", "Details"], defaultTabIndex: 1 },
    bindings: null,
    children: [datePickerDefinition.key],
    layout: null,
  };
  const formInputDefinition = {
    key: "smoke-form-input",
    type: "TextInput",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeFormInput",
    description: null,
    properties: { label: "Form record name" },
    bindings: null,
    children: [],
    layout: null,
  };
  const formCheckboxDefinition = {
    key: "smoke-form-checkbox",
    type: "Checkbox",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeFormCheckbox",
    description: null,
    properties: {
      label: "Form approved",
      defaultChecked: false,
      help: "Confirm this form record.",
      disabled: false,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const formDefinition = {
    key: "smoke-form",
    type: "Form",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeForm",
    description: null,
    properties: {
      submitButtonText: "Save smoke form",
      clearOnSubmit: true,
      enterToSubmit: false,
      border: true,
      width: "stretch",
      height: "content",
    },
    bindings: null,
    children: [formInputDefinition.key, formCheckboxDefinition.key],
    layout: null,
  };
  const modalInputDefinition = {
    key: "smoke-modal-input",
    type: "TextInput",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeModalInput",
    description: null,
    properties: { label: "Modal note" },
    bindings: null,
    children: [],
    layout: { y: 0 },
  };
  const modalDefinition = {
    key: "smoke-modal",
    type: "Modal",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeModal",
    description: null,
    properties: {
      title: "Review smoke",
      width: "medium",
      height: null,
      position: "left",
      dismissible: false,
    },
    bindings: null,
    children: [modalInputDefinition.key],
    layout: null,
  };
  const fileUploadDefinition = {
    key: "smoke-file-upload",
    type: "FileUpload",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeFileUpload",
    description: null,
    properties: { label: "Upload smoke files" },
    bindings: {
      databricksVolume: {
        bindingType: "databricksVolume",
        source: {
          kind: "resource",
          valueType: "file",
          resource: {
            type: "databricksVolume",
            catalog: "main",
            schema: "default",
            volume: "uploads",
            filePath: "smoke/imports",
          },
        },
      },
    },
    children: [],
    layout: null,
  };
  const dataWindowDefinition = {
    key: "smoke-data-window",
    type: "DataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeDataWindow",
    description: null,
    properties: {
      label: "Smoke customers",
      maxRows: 25,
      scrollable: true,
      placeholder: null,
      width: "stretch",
      hideIndex: null,
      height: "auto",
    },
    bindings: {
      unityCatalogTable: {
        bindingType: "unityCatalogTable",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "unityCatalogTable",
            catalog: "main",
            schema: "default",
            table: "customers",
            dataSourceFormat: "DELTA",
            columns: [
              { name: "customer_id", type: "BIGINT" },
              { name: "customer_name", type: "STRING" },
            ],
          },
        },
      },
    },
    children: [],
    layout: null,
  };
  const editableDataWindowDefinition = {
    key: "smoke-editable-data-window",
    type: "EditableDataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeEditableDataWindow",
    description: null,
    properties: {
      label: "Smoke editable customers",
      maxRows: 25,
      scrollable: true,
      placeholder: null,
      disabled: false,
      numRows: "dynamic",
      hideIndex: true,
      width: "stretch",
      height: "auto",
    },
    bindings: {
      unityCatalogTable: {
        bindingType: "unityCatalogTable",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "unityCatalogTable",
            catalog: "main",
            schema: "default",
            table: "customers",
            dataSourceFormat: "DELTA",
            primaryKeyColumn: "customer_id",
            columns: [
              { name: "customer_id", type: "BIGINT", dataType: "LONG" },
              { name: "customer_name", type: "STRING", dataType: "STRING" },
            ],
          },
        },
      },
    },
    children: [],
    layout: null,
  };
  const barChartDefinition = {
    key: "smoke-bar-chart",
    type: "BarChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeBarChart",
    description: null,
    properties: {
      title: "Smoke orders by region",
      seriesColor: "#1f77b4",
      xAxis: { field: "customer_name", displayName: "Customer", scaleType: "categorical", transform: "none" },
      yAxis: { field: "", displayName: "Order count", scaleType: "continuous", transform: "count" },
    },
    bindings: {
      unityCatalogTable: {
        bindingType: "unityCatalogTable",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "unityCatalogTable",
            catalog: "main",
            schema: "default",
            table: "customers",
            dataSourceFormat: "DELTA",
            primaryKeyColumn: null,
            columns: [
              { name: "customer_id", type: "BIGINT", dataType: "LONG" },
              { name: "customer_name", type: "STRING", dataType: "STRING" },
            ],
          },
        },
      },
    },
    children: [],
    layout: null,
  };
  const lineChartDefinition = {
    key: "smoke-line-chart",
    type: "LineChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeLineChart",
    description: null,
    properties: {
      title: "Smoke customer values",
      seriesColor: "#1f77b4",
      xAxis: { field: "customer_id", displayName: "Customer ID", scaleType: "continuous", transform: "none" },
      yAxis: { field: "customer_id", displayName: "Customer ID", scaleType: "continuous", transform: "none" },
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const pieChartDefinition = {
    key: "smoke-pie-chart",
    type: "PieChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokePieChart",
    description: null,
    properties: {
      title: "Smoke customers by value",
      seriesColor: "#1f77b4",
      category: { field: "customer_name", displayName: "Customer", scaleType: "categorical", transform: "none" },
      value: { field: "customer_id", displayName: "Customer ID", scaleType: "continuous", transform: "sum" },
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const donutChartDefinition = {
    key: "smoke-donut-chart",
    type: "DonutChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeDonutChart",
    description: null,
    properties: {
      title: "Smoke customers by value",
      seriesColor: "#1f77b4",
      category: { field: "customer_name", displayName: "Customer", scaleType: "categorical", transform: "none" },
      value: { field: "customer_id", displayName: "Customer ID", scaleType: "continuous", transform: "sum" },
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const amoebaStoryDefinition = {
    key: "smoke-amoeba-story",
    type: "AmoebaStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeAmoebaStory",
    description: null,
    properties: {
      title: "Smoke amoeba story",
      entityId: { field: "customer_id", displayName: "Customer ID", scaleType: "categorical", transform: "none" },
      entityLabel: { field: "customer_name", displayName: "Customer", scaleType: "categorical", transform: "none" },
      category: { field: "customer_name", displayName: "Segment", scaleType: "categorical", transform: "none" },
      sizeMetric: { field: "customer_id", displayName: "Size", scaleType: "continuous", transform: "sum" },
      xMetric: { field: "customer_id", displayName: "X", scaleType: "continuous", transform: "avg" },
      yMetric: { field: "customer_id", displayName: "Y", scaleType: "continuous", transform: "avg" },
      changeMetric: { field: "customer_id", displayName: "Change", scaleType: "continuous", transform: "avg" },
      timeField: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      healthScore: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      riskScore: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      layoutMode: "hybrid",
      sizeScale: "sqrt",
      minRadiusPx: 42,
      maxRadiusPx: 130,
      colorBy: "category",
      pulseBy: "risk_score",
      pulseThreshold: 50,
      pulseThresholdMode: "above",
      shapeVariation: 0.35,
      labelMode: "compact",
      animationEnabled: true,
      animationSpeed: 1,
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const flowFieldStoryDefinition = {
    key: "smoke-flow-field-story",
    type: "FlowFieldStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeFlowFieldStory",
    description: null,
    properties: {
      title: "Smoke flow field story",
      sourceStage: { field: "customer_name", displayName: "From", scaleType: "categorical", transform: "none" },
      destinationStage: { field: "customer_name", displayName: "To", scaleType: "categorical", transform: "none" },
      flowVolume: { field: "customer_id", displayName: "Volume", scaleType: "continuous", transform: "sum" },
      stageOrder: { field: "customer_id", displayName: "Order", scaleType: "continuous", transform: "max" },
      timeField: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      conversionPct: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      dropOffCount: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
      avgTimeInStage: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      status: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      showDropOffs: true,
      showLabels: true,
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const heatMapStoryDefinition = {
    key: "smoke-heat-map-story",
    type: "HeatMapStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeHeatMapStory",
    description: null,
    properties: {
      title: "Smoke heat map story",
      geographicArea: { field: "customer_id", displayName: "State", scaleType: "categorical", transform: "none" },
      metricValue: { field: "customer_id", displayName: "Value", scaleType: "continuous", transform: "sum" },
      timeField: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      secondaryMetric: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
      changePct: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      targetValue: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      riskScore: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      category: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      forecastValue: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      notes: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      mapScope: "usa",
      geographicLevel: "state",
      colorScale: "sequential",
      showLabels: true,
      showLegend: true,
      aggregationMethod: "sum",
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const honeycombStoryDefinition = {
    key: "smoke-honeycomb-story",
    type: "HoneycombStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeHoneycombStory",
    description: null,
    properties: {
      title: "Smoke honeycomb story",
      itemName: { field: "customer_name", displayName: "Customer", scaleType: "categorical", transform: "none" },
      impactScore: { field: "customer_id", displayName: "Impact", scaleType: "continuous", transform: "avg" },
      priorityLevel: { field: "customer_name", displayName: "Priority", scaleType: "categorical", transform: "none" },
      progressPct: { field: "customer_id", displayName: "Progress", scaleType: "continuous", transform: "avg" },
      category: { field: "customer_name", displayName: "Category", scaleType: "categorical", transform: "none" },
      timeField: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      trend: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      riskScore: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      owner: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      dueDate: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      investment: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
      benefitValue: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
      notes: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      status: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      showLabels: true,
      showRiskBorders: true,
      showTrendArrows: true,
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const networkWebStoryDefinition = {
    key: "smoke-network-web-story",
    type: "NetworkWebStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeNetworkWebStory",
    description: null,
    properties: {
      title: "Smoke network web story",
      sourceEntityId: { field: "customer_id", displayName: "Source ID", scaleType: "categorical", transform: "none" },
      sourceEntityLabel: { field: "customer_name", displayName: "Source", scaleType: "categorical", transform: "none" },
      targetEntityId: { field: "customer_id", displayName: "Target ID", scaleType: "categorical", transform: "none" },
      targetEntityLabel: { field: "customer_name", displayName: "Target", scaleType: "categorical", transform: "none" },
      relationshipType: { field: "customer_name", displayName: "Relationship", scaleType: "categorical", transform: "none" },
      relationshipWeight: { field: "customer_id", displayName: "Weight", scaleType: "continuous", transform: "none" },
      timeField: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      direction: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      edgeValue: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
      frequency: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
      edgeRiskScore: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
      edgeStatus: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      sourceCategory: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      targetCategory: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      sourceValue: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
      targetValue: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
      sourceHealthScore: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
      targetHealthScore: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
      sourceRiskScore: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
      targetRiskScore: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
      layoutAlgorithm: "force",
      nodeSizeBy: "degree",
      nodeColorBy: "category",
      edgeWidthBy: "weight",
      edgeColorBy: "relationship_type",
      showArrows: true,
      highlightDepth: 1,
      minWeightFilter: 0,
      maxNodes: 300,
      maxEdges: 800,
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const pulseWaveStoryDefinition = {
    key: "smoke-pulse-wave-story",
    type: "PulseWaveStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokePulseWaveStory",
    description: null,
    properties: {
      title: "Smoke pulse wave story",
      metricName: "Customer revenue",
      timeField: { field: "customer_id", displayName: "Period", scaleType: "categorical", transform: "none" },
      metricValue: { field: "customer_id", displayName: "Revenue", scaleType: "continuous", transform: "none" },
      baselineValue: { field: "customer_id", displayName: "Baseline", scaleType: "continuous", transform: "avg" },
      eventName: { field: "customer_name", displayName: "Event", scaleType: "categorical", transform: "none" },
      eventType: { field: "customer_name", displayName: "Type", scaleType: "categorical", transform: "none" },
      impactScore: { field: "customer_id", displayName: "Impact", scaleType: "continuous", transform: "avg" },
      aggregationMethod: "sum",
      showBaseline: true,
      showEvents: true,
      showAnomalyMarkers: true,
      fillUnderWave: true,
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const spiralStoryDefinition = {
    key: "smoke-spiral-story",
    type: "SpiralStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeSpiralStory",
    description: null,
    properties: {
      title: "Smoke spiral story",
      journeyName: { field: "customer_name", displayName: "Journey", scaleType: "categorical", transform: "none" },
      stage: { field: "customer_name", displayName: "Stage", scaleType: "categorical", transform: "none" },
      timelineField: { field: "customer_id", displayName: "Timeline", scaleType: "categorical", transform: "none" },
      progressPct: { field: "customer_id", displayName: "Progress", scaleType: "continuous", transform: "avg" },
      metricValue: { field: "customer_id", displayName: "Metric", scaleType: "continuous", transform: "sum" },
      targetDate: { field: "customer_name", displayName: "Target", scaleType: "categorical", transform: "none" },
      actualDate: { field: "customer_name", displayName: "Actual", scaleType: "categorical", transform: "none" },
      status: { field: "customer_name", displayName: "Status", scaleType: "categorical", transform: "none" },
      riskScore: { field: "customer_id", displayName: "Risk", scaleType: "continuous", transform: "avg" },
      owner: { field: "customer_name", displayName: "Owner", scaleType: "categorical", transform: "none" },
      keyAchievement: { field: "customer_name", displayName: "Achievement", scaleType: "categorical", transform: "none" },
      cost: { field: "customer_id", displayName: "Cost", scaleType: "continuous", transform: "sum" },
      showLabels: true,
      showRiskGlow: true,
      showVariance: true,
      spaceByTimeline: false,
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const terrainStoryDefinition = {
    key: "smoke-terrain-story",
    type: "TerrainStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeTerrainStory",
    description: null,
    properties: {
      title: "Smoke terrain story",
      xDimension: { field: "customer_name", displayName: "Product", scaleType: "categorical", transform: "none" },
      yDimension: { field: "customer_id", displayName: "Line", scaleType: "categorical", transform: "none" },
      heightMetric: { field: "customer_id", displayName: "Output", scaleType: "continuous", transform: "sum" },
      timeField: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      terrainCategory: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      riskScore: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      targetValue: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      baselineValue: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      forecastValue: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
      volumeMetric: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
      status: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      eventName: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      eventDate: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      calloutText: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
      terrainMode: "surface",
      heightScale: 1,
      interpolation: "bilinear",
      gridResolution: 60,
      colorBy: "height_metric",
      showPeakLabels: true,
      showValleyLabels: true,
      cameraPreset: "angled",
      aggregationMethod: "sum",
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const dashboardEmbedDefinition = {
    key: "smoke-dashboard-embed",
    type: "DashboardEmbed",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeDashboardEmbed",
    description: null,
    properties: {
      src: "https://former-workspace.cloud.databricks.com/embed/dashboardsv3/customer_dashboard?o=123456&fullscreenWidget=page_1~widget_2",
      height: 720,
      scrolling: false,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const genieChatDefinition = {
    key: "smoke-genie-chat",
    type: "GenieChat",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeGenieChat",
    description: null,
    properties: {
      genieSpaceId: "0123456789abcdef0123456789abcdef",
      genieSpaceTitle: "Sample Genie Space",
      title: "Workspace Genie",
      showBorder: true,
      chatTotalHeightPixels: 600,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const modelChatDefinition = {
    key: "smoke-model-chat",
    type: "ModelChat",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeModelChat",
    description: null,
    properties: {
      servingEndpointName: "sample-chat-endpoint",
      title: "Workspace model chat",
      showBorder: true,
      chatTotalHeightPixels: 600,
    },
    bindings: null,
    children: [],
    layout: null,
  };
  const componentsResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}/components`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: 2,
        components: [
          componentDefinition,
          buttonDefinition,
          checkboxDefinition,
          toggleDefinition,
          dropdownDefinition,
          datePickerDefinition,
          timePickerDefinition,
          sliderDefinition,
          labelDefinition,
          expanderDefinition,
          columnsDefinition,
          rowsDefinition,
          tabsDefinition,
          formDefinition,
          formInputDefinition,
          formCheckboxDefinition,
          modalDefinition,
          modalInputDefinition,
          fileUploadDefinition,
          dataWindowDefinition,
          editableDataWindowDefinition,
          barChartDefinition,
          lineChartDefinition,
          pieChartDefinition,
          donutChartDefinition,
          amoebaStoryDefinition,
          flowFieldStoryDefinition,
          heatMapStoryDefinition,
          honeycombStoryDefinition,
          networkWebStoryDefinition,
          pulseWaveStoryDefinition,
          spiralStoryDefinition,
          terrainStoryDefinition,
          dashboardEmbedDefinition,
          genieChatDefinition,
          modelChatDefinition,
        ],
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
  assert.equal(
    readFirstComponentKey(reopenedComponents),
    componentDefinition.key,
  );
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

  const customModulesRoute = `${baseUrl}/api/v1/projects/${createdProjectId}/custom-modules`;
  const currentCustomModules = await fetch(customModulesRoute);
  const currentCustomModulesDocument: unknown = await currentCustomModules.json();
  const customModulesSource = "def normalize_order(ctx):\n    return {'ok': True}\n";
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
  assert.equal(readCustomModulesSource(savedCustomModules), customModulesSource);

  const workflowResponse = await fetch(`${baseUrl}/api/v1/projects/${createdProjectId}/workflow`, {
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
              { id: "toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "Refreshing", duration: { kind: "preset", value: "short" } } },
              { id: "modal", actionType: "showModal", schemaVersion: 1, params: { modalComponentKey: "smoke-modal" } },
              { id: "build", actionType: "buildSql", schemaVersion: 1, params: { sqlSourceKind: "unityCatalogTable", sqlTemplate: "SELECT * FROM main.default.customers WHERE customer_name = {customer}", placeholders: [{ token: "customer", componentKey: "smoke-input", valueType: "string", formatHint: "sqlStringLiteral" }], sqlWarehouseId: "warehouse-smoke", sqlWarehouseName: "Analytics" } },
              { id: "run", actionType: "runSql", schemaVersion: 1, params: { statement: { sourceActionType: "buildSql", nodeId: "build" } } },
              { id: "bind", actionType: "setBinding", schemaVersion: 1, params: { source: { sourceActionType: "runSql", nodeId: "run", outputKey: "rows" }, target: { componentKey: "smoke-data-window", bindingType: "unityCatalogTable" } } },
              { id: "job", actionType: "startDatabricksJob", schemaVersion: 1, params: { job: { resourceType: "databricksJob", resourceKey: "12345", jobName: "Refresh customers" } } },
              { id: "custom", actionType: "callCustomModule", schemaVersion: 1, params: { functionName: "normalize_order" } },
              { id: "prebuilt", actionType: "callPrebuiltModule", schemaVersion: 1, params: { functionName: "change_text", namedArguments: { component: "smokeButton", new_label: "Done" } } },
              { id: "sql-success-toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "SQL succeeded", duration: { kind: "preset", value: "short" } } },
              { id: "sql-error-toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "SQL failed", duration: { kind: "preset", value: "short" } } },
              { id: "job-success-toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "Job succeeded", duration: { kind: "preset", value: "short" } } },
              { id: "job-error-toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "Job failed", duration: { kind: "preset", value: "short" } } },
            ],
            edges: [
              { fromNodeId: "toast", toNodeId: "modal", route: "onSuccess" },
              { fromNodeId: "modal", toNodeId: "build", route: "onSuccess" },
              { fromNodeId: "build", toNodeId: "run", route: "onSuccess" },
              { fromNodeId: "run", toNodeId: "bind", route: "onSuccess" },
              { fromNodeId: "run", toNodeId: "sql-success-toast", route: "onSuccess" },
              { fromNodeId: "run", toNodeId: "sql-error-toast", route: "onError" },
              { fromNodeId: "bind", toNodeId: "job", route: "onSuccess" },
              { fromNodeId: "job", toNodeId: "custom", route: "onSuccess" },
              { fromNodeId: "job", toNodeId: "job-success-toast", route: "onSuccess" },
              { fromNodeId: "job", toNodeId: "job-error-toast", route: "onError" },
              { fromNodeId: "custom", toNodeId: "prebuilt", route: "onSuccess" },
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
                  targetTable: { tableType: "unityCatalogTable", resourceKey: "customers-table", catalog: "main", schema: "default", table: "customers" },
                  excludedColumns: [],
                  columnMappings: [{ formChildComponentKey: "smoke-form-input", targetColumnName: "customer_name" }],
                },
              },
              { id: "save-success-toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "Saved", duration: { kind: "preset", value: "short" } } },
              { id: "save-error-toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "Save failed", duration: { kind: "preset", value: "short" } } },
            ],
            edges: [
              { fromNodeId: "save", toNodeId: "save-success-toast", route: "onSuccess" },
              { fromNodeId: "save", toNodeId: "save-error-toast", route: "onError" },
            ],
          },
        ],
      },
    }),
  });
  assert.equal(workflowResponse.status, 200);

  const previewResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}/preview`,
    { method: "POST" },
  );
  const preview: unknown = await previewResponse.json();
  assert.equal(previewResponse.status, 200, JSON.stringify(preview));
  assert.equal(readPreviewOnly(preview), true);
  runGeneratedWorkflowHarness(preview);
  assert.match(readPreviewAppSource(preview), /import custom_modules/);
  assert.match(readPreviewAppSource(preview), /import prebuilt_modules_library/);
  assert.match(
    readPreviewAppSource(preview),
    /function\(_VdabWorkflowContext\(workflow_state\)\)/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_run_component_workflows,\s*args=\('smoke-button', 'onClick'\)/,
  );
  assert.match(readPreviewAppSource(preview), /_vdab_run_component_workflows\('smoke-form', 'onSubmit'\)/);
  assert.match(readPreviewAppSource(preview), /action_type == 'triggerToast'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'showModal'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'buildSql'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'runSql'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'setBinding'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'startDatabricksJob'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'callCustomModule'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'callPrebuiltModule'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'saveToTable'/);
  assert.match(readPreviewAppSource(preview), /SaveToTable supports Unity Catalog or Lakebase Autoscaling targets/);
  assert.match(readPreviewAppSource(preview), /Generated workflow SQL requires Unity Catalog or Lakebase Autoscaling in the hosting workspace/);
  assert.match(readPreviewAppSource(preview), /api\/2\.2\/jobs\/run-now/);
  assert.match(readPreviewAppSource(preview), /'Authorization': 'Bearer ' \+ user_token/);
  assert.doesNotMatch(readPreviewAppSource(preview), /DATABRICKS_CLIENT_SECRET|DATABRICKS_TOKEN/);
  assert.match(readPreviewModuleSource(preview), /def normalize_order\(ctx\):/);
  assert.match(readPreviewAppSource(preview), /st\.text_input\(/);
  assert.match(readPreviewAppSource(preview), /st\.button\(/);
  assert.match(readPreviewAppSource(preview), /'innerRadius': 54/);
  assert.match(readPreviewAppSource(preview), /components\.html\(/);
  assert.match(readPreviewAppSource(preview), /const payload = __AMOEBA_PAYLOAD__/);
  assert.match(readPreviewAppSource(preview), /const payload = __FLOW_FIELD_PAYLOAD__/);
  assert.match(readPreviewAppSource(preview), /const payload = __HEAT_MAP_PAYLOAD__/);
  assert.match(readPreviewAppSource(preview), /const payload = __HONEYCOMB_PAYLOAD__/);
  assert.match(readPreviewAppSource(preview), /const payload = __NETWORK_WEB_PAYLOAD__/);
  assert.match(readPreviewAppSource(preview), /const payload = __PULSE_WAVE_PAYLOAD__/);
  assert.match(readPreviewAppSource(preview), /const payload = __SPIRAL_PAYLOAD__/);
  assert.match(readPreviewAppSource(preview), /const payload = __TERRAIN_PAYLOAD__/);
  assert.match(readPreviewAppSource(preview), /components\.iframe\(_vdab_dashboard_src, height=720, scrolling=False\)/);
  assert.match(readPreviewAppSource(preview), /_vdab_render_genie_chat\('vdab_smokegeniechat', '0123456789abcdef0123456789abcdef', True, 600\)/);
  assert.match(readPreviewAppSource(preview), /_vdab_render_model_chat\('vdab_smokemodelchat', 'sample-chat-endpoint'\)/);
  assert.match(readPreviewAppSource(preview), /x-forwarded-access-token/);
  assert.match(readPreviewAppSource(preview), /\/api\/2\.0\/genie\/spaces/);
  assert.doesNotMatch(readPreviewAppSource(preview), /WorkspaceClient|genie_space_app_resource/);
  assert.match(readPreviewAppSource(preview), /DATABRICKS_WORKSPACE_ID/);
  assert.doesNotMatch(readPreviewAppSource(preview), /former-workspace\.cloud\.databricks\.com|[?&]o=123456(?:[&'" ]|$)/);
  assert.match(readPreviewAppSource(preview), /_vdab_sql_query_df\('main', 'default', 'customers', 100, query_statement=/);
  assert.match(readPreviewAppSource(preview), /GROUP BY `customer_name`, `customer_name` ORDER BY MAX\(`customer_id`\)/);
  assert.match(readPreviewAppSource(preview), /role="group" tabindex="0" aria-label="Spiral journey visualization"/);
  assert.match(readPreviewAppSource(preview), /ArrowRight/);
  assert.match(readPreviewAppSource(preview), /aria-live="polite"/);
  assert.match(readPreviewAppSource(preview), /SELECT `customer_id` AS time_period, SUM\(`customer_id`\) AS metric_value, AVG\(`customer_id`\) AS baseline_value/);
  assert.match(readPreviewAppSource(preview), /_vdab_sql_query_df\('main', 'default', 'customers', 500, query_statement=/);
  assert.match(readPreviewAppSource(preview), /role="group" tabindex="0" aria-describedby="hint"/);
  assert.match(readPreviewAppSource(preview), /const result=Object\.create\(null\)/);
  assert.match(readPreviewAppSource(preview), /announcer\.textContent=pointDetails\(keyboardIndex\)/);
  assert.match(readPreviewAppSource(preview), /_vdab_sql_query_df\('main', 'default', 'customers', 1000, query_statement=/);
  assert.match(readPreviewAppSource(preview), /function neighborhood\(rootId, depth\)/);
  assert.match(readPreviewAppSource(preview), /canvas\.addEventListener/);
  assert.match(readPreviewAppSource(preview), /_vdab_sql_query_df\('main', 'default', 'customers', 500, query_statement=/);
  assert.match(readPreviewAppSource(preview), /_vdab_sql_query_df\('main', 'default', 'customers', 500, query_statement=/);
  assert.match(readPreviewAppSource(preview), /statusColor\(status\)/);
  assert.match(readPreviewAppSource(preview), /Largest drop-off:/);
  assert.match(readPreviewAppSource(preview), /GROUP BY `customer_id`'\)/);
  assert.match(readPreviewAppSource(preview), /_vdab_sql_query_df\('main', 'default', 'customers', 100, query_statement=/);
  assert.match(readPreviewAppSource(preview), /GROUP BY `customer_name`'\)/);
  assert.match(readPreviewAppSource(preview), /const RISK_THRESHOLD = 70/);
  assert.match(readPreviewAppSource(preview), /_vdab_sql_query_df\('main', 'default', 'customers', 500, query_statement=/);
  assert.match(readPreviewAppSource(preview), /GROUP BY `customer_id` ORDER BY `customer_id`/);
  assert.match(readPreviewAppSource(preview), /Fewer than 8 time points/);
  assert.match(readPreviewAppSource(preview), /announcer\.textContent=pointDetails\(keyboardIndex\)/);
  assert.match(readPreviewAppSource(preview), /st\.checkbox\(/);
  assert.match(readPreviewAppSource(preview), /st\.toggle\(/);
  assert.match(readPreviewAppSource(preview), /st\.multiselect\(/);
  assert.match(readPreviewAppSource(preview), /st\.date_input\(/);
  assert.match(readPreviewAppSource(preview), /st\.time_input\(/);
  assert.match(readPreviewAppSource(preview), /st\.slider\(/);
  assert.match(readPreviewAppSource(preview), /html\.escape\(str\(/);
  assert.match(readPreviewAppSource(preview), /with st\.expander\('Workspace details', expanded=True\):/);
  assert.match(readPreviewAppSource(preview), /    st\.markdown\(/);
  assert.match(readPreviewAppSource(preview), /vdab_smokecolumns = st\.columns\(2\)/);
  assert.match(readPreviewAppSource(preview), /with vdab_smokecolumns\[0\]:/);
  assert.match(readPreviewAppSource(preview), /vdab_smokerows = st\.container\(\)/);
  assert.match(readPreviewAppSource(preview), /with vdab_smokerows:/);
  assert.match(readPreviewAppSource(preview), /vdab_smoketabs = st\.tabs\(/);
  assert.match(readPreviewAppSource(preview), /default='Details'/);
  assert.match(readPreviewAppSource(preview), /with vdab_smoketabs\[0\]:/);
  assert.match(readPreviewAppSource(preview), /with st\.form\(/);
  assert.match(readPreviewAppSource(preview), /st\.form_submit_button\('Save smoke form'\)/);
  const generatedAppSource = readPreviewAppSource(preview);
  const generatedFormIndex = generatedAppSource.indexOf("with st.form(");
  assert.ok(
    generatedFormIndex >= 0 &&
      generatedAppSource.indexOf("st.text_input(", generatedFormIndex) <
        generatedAppSource.indexOf("st.checkbox(", generatedFormIndex),
    "Form controls should keep the saved child order.",
  );
  assert.match(
    generatedAppSource,
    /@st\.dialog\('Review smoke', width='medium', position='left', dismissible=False\)/,
  );
  assert.match(generatedAppSource, /def show_smokeModal\(\):/);
  assert.match(generatedAppSource, /st\.button\('Close', key='vdab_smokemodal_close'\)/);
  assert.match(generatedAppSource, /accept_multiple_files=True/);
  assert.match(generatedAppSource, /_vdab_upload_to_volume\(/);
  assert.match(generatedAppSource, /Volumes\/main\/default\/uploads\/smoke\/imports/);
  assert.match(generatedAppSource, /SELECT \* FROM \{table_reference\}/);
  assert.match(generatedAppSource, /st\.dataframe\(vdab_smokedatawindow_data/);
  assert.match(generatedAppSource, /st\.data_editor\(/);
  assert.match(generatedAppSource, /SELECT `customer_id` AS x, `customer_id` AS y/);
  assert.match(generatedAppSource, /'type': 'line', 'point': True/);
  assert.match(generatedAppSource, /SELECT `customer_name` AS category, SUM\(`customer_id`\) AS value/);
  assert.match(generatedAppSource, /'type': 'arc'/);
  assert.match(generatedAppSource, /_vdab_pie_palette\('#1f77b4'/);
  assert.match(generatedAppSource, /_vdab_sql_validate_primary_key\(/);
  assert.match(generatedAppSource, /COUNT\(DISTINCT/);
  assert.match(generatedAppSource, /_vdab_sql_merge_rows\(/);
  assert.match(generatedAppSource, /from_json\(:changes/);
  assert.match(generatedAppSource, /COUNT\(\*\) AS value/);
  assert.match(generatedAppSource, /st\.vega_lite_chart\(/);
  assert.match(generatedAppSource, /x-forwarded-access-token/);
  assert.doesNotMatch(generatedAppSource, /workspaceConnectionId|local-smoke-secret/);
  assert.match(generatedAppSource, /_VDAB_MODEL_CHAT_MAX_RESPONSE_BYTES = 300000/);
  assert.match(generatedAppSource, /x-forwarded-access-token/);
  assert.doesNotMatch(generatedAppSource, /WorkspaceClient|DATABRICKS_CLIENT_SECRET/);

  const exportResponse = await fetch(
    `${baseUrl}/api/v1/projects/${createdProjectId}/export`,
  );
  const portableExport: unknown = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.equal(readPortableProjectName(portableExport), "Local smoke project saved");
  assert.deepEqual(readWorkspaceBoundComponentKeys(portableExport), []);
  const importBundle = structuredClone(portableExport);
  if (!isRecord(importBundle) || !isRecord(importBundle.project)) {
    throw new Error("The packaged export was not a standalone project document.");
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
      throw new Error(`Local app exited before readiness. Output: ${childOutput}`);
    }

    try {
      return await fetch(`${baseUrl}/api/health/live`);
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
  }

  throw new Error(`Local app did not become ready. Output: ${childOutput}`);
}

async function readFirstListedProjectId(response: Response): Promise<string> {
  const payload: unknown = await response.json();

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("items" in payload) ||
    !Array.isArray(payload.items) ||
    payload.items.length === 0
  ) {
    throw new Error("The packaged app did not return the created project.");
  }

  return readProjectId(payload.items[0]);
}

function readProjectId(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new Error("The packaged app returned an invalid project response.");
  }

  return value.id;
}

function readRegistryComponentCount(value: unknown): number {
  return readArrayProperty(value, "components").length;
}

function readRegistryBindingCount(value: unknown): number {
  return readArrayProperty(value, "bindingSchemas").length;
}

function readRegistryStoryCount(value: unknown): number {
  return readArrayProperty(value, "components").filter(
    (component: unknown) =>
      isRecord(component) &&
      typeof component.type === "string" &&
      component.type.endsWith("Story"),
  ).length;
}

function readComponentDefinitionType(value: unknown): string {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("The packaged app returned an invalid component definition.");
  }

  return value.type;
}

function readArrayProperty(value: unknown, property: string): unknown[] {
  if (!isRecord(value) || !(property in value) || !Array.isArray(value[property])) {
    throw new Error(`The packaged app returned an invalid ${property} array.`);
  }

  return value[property];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProjectCreator(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("createdBy" in value) ||
    typeof value.createdBy !== "string"
  ) {
    throw new Error("The packaged app returned an invalid project creator.");
  }

  return value.createdBy;
}

function readProjectVersion(value: unknown): number {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    typeof value.version !== "number"
  ) {
    throw new Error("The packaged app returned an invalid project version.");
  }

  return value.version;
}

function readComponentCount(value: unknown): number {
  if (
    typeof value !== "object" ||
    value === null ||
    !("components" in value) ||
    !Array.isArray(value.components)
  ) {
    throw new Error("The packaged app returned an invalid component collection.");
  }

  return value.components.length;
}

function readComponentType(value: unknown, index: number): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("components" in value) ||
    !Array.isArray(value.components)
  ) {
    throw new Error("The packaged app returned an invalid component collection.");
  }

  const component: unknown = value.components[index];
  if (
    typeof component !== "object" ||
    component === null ||
    !("type" in component) ||
    typeof component.type !== "string"
  ) {
    throw new Error("The packaged app returned an invalid component type.");
  }

  return component.type;
}

function readFirstComponentKey(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("components" in value) ||
    !Array.isArray(value.components) ||
    value.components.length === 0
  ) {
    throw new Error("The packaged app returned no saved components.");
  }

  const component: unknown = value.components[0];

  if (
    typeof component !== "object" ||
    component === null ||
    !("key" in component) ||
    typeof component.key !== "string"
  ) {
    throw new Error("The packaged app returned an invalid component key.");
  }

  return component.key;
}

function readPreviewOnly(value: unknown): boolean {
  if (!isRecord(value) || value.previewOnly !== true) {
    throw new Error("The packaged app returned an invalid preview response.");
  }

  return true;
}

function readPreviewAppSource(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("The packaged app returned no preview files.");
  }

  const appFile: unknown = value.files.find(
    (file: unknown) => isRecord(file) && file.path === "app.py",
  );
  if (!isRecord(appFile) || typeof appFile.content !== "string") {
    throw new Error("The packaged app returned no generated app.py file.");
  }

  return appFile.content;
}

function runGeneratedWorkflowHarness(value: unknown): void {
  const files = readPreviewPythonFiles(value);
  const pythonExecutable = process.env.VDAB_PYTHON_EXECUTABLE ??
    (process.platform === "win32" ? "python" : "python3");
  const harnessPath = resolve(import.meta.dirname, "smoke-generated-workflow.py");
  const result = spawnSync(pythonExecutable, [harnessPath], {
    input: JSON.stringify({ files }),
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 4_000_000,
  });

  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report: unknown = JSON.parse(result.stdout);
  assert.ok(isRecord(report) && report.event === "generated-workflow-smoke.passed");
  assert.deepEqual(report.checks, [
    "button-callback-all-actions-success",
    "button-callback-sql-failure-route",
    "button-callback-job-failure-route",
    "form-save-to-table-success",
    "form-save-to-table-failure-route",
    "all-eight-generated-stories-empty-results",
    "viewer-sql-and-volume-redirects-denied",
    "generated-sql-response-and-result-bounds",
  ]);
}

function readPreviewPythonFiles(value: unknown): Array<{ path: string; content: string }> {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("The packaged app returned no preview files for workflow runtime verification.");
  }
  const allowedPaths = new Set([
    "app.py",
    "custom_modules.py",
    "prebuilt_modules_library.py",
  ]);
  return value.files.flatMap((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.path !== "string" ||
        typeof entry.content !== "string" || !allowedPaths.has(entry.path)) {
      return [];
    }
    const invalidTextIndex = findUnpairedSurrogateIndex(entry.content);
    if (invalidTextIndex !== null) {
      throw new Error(
        `Generated ${entry.path} contains invalid Unicode at UTF-16 offset ${invalidTextIndex}.`,
      );
    }
    return [{ path: entry.path, content: entry.content }];
  });
}

function findUnpairedSurrogateIndex(value: string): number | null {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1);
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        index += 1;
      } else {
        return index;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return index;
    }
  }
  return null;
}

function readPreviewModuleSource(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("The packaged app returned no preview files.");
  }
  const moduleFile: unknown = value.files.find(
    (file: unknown) => isRecord(file) && file.path === "custom_modules.py",
  );
  if (!isRecord(moduleFile) || typeof moduleFile.content !== "string") {
    throw new Error("The packaged app returned no generated custom_modules.py file.");
  }
  return moduleFile.content;
}

function readCustomModulesSource(value: unknown): string {
  if (!isRecord(value) || typeof value.source !== "string") {
    throw new Error("The packaged app returned an invalid custom modules document.");
  }
  return value.source;
}

function readPortableProjectName(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.project) || typeof value.project.name !== "string") {
    throw new Error("The packaged app returned an invalid standalone export.");
  }
  return value.project.name;
}

function readImportedProject(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.project)) {
    throw new Error("The packaged app returned an invalid project import result.");
  }
  return value.project;
}

function readWorkspaceBoundComponentKeys(value: unknown): string[] {
  if (!isRecord(value) || !isRecord(value.project) || !Array.isArray(value.project.components)) {
    throw new Error("The packaged app returned invalid portable components.");
  }
  return value.project.components.flatMap((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.key !== "string" || !isRecord(entry.bindings)) {
      return [];
    }
    return Object.hasOwn(entry.bindings, "resource") || Object.values(entry.bindings).some(
      (binding: unknown) => isRecord(binding) && (Object.hasOwn(binding, "resource") || isRecord(binding.source) && Object.hasOwn(binding.source, "resource")),
    ) ? [entry.key] : [];
  });
}

function readImportRequiresChildAppSelection(value: unknown): boolean {
  if (!isRecord(value) || value.requiresChildAppSelection !== true) {
    throw new Error("The packaged app did not require a new child-App selection.");
  }
  return true;
}

function readUnresolvedResourceCount(value: unknown): number {
  if (!isRecord(value) || !Array.isArray(value.unresolvedResources)) {
    throw new Error("The packaged app returned invalid unresolved resource references.");
  }
  return value.unresolvedResources.length;
}
