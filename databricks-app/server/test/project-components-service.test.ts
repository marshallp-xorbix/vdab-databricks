import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
} from "../src/db/project-components-contract.ts";
import { PROJECT_COMPONENT_TYPES } from "../src/db/project-components-contract.ts";
import {
  ProjectComponentsService,
} from "../src/db/project-components-service.ts";
import type {
  ProjectComponentsRepository,
} from "../src/db/project-components-repository.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";

const caller: CallerIdentity = {
  userId: "editor-1",
  preferredUsername: "Editor",
  email: "editor@example.com",
  workspaceId: "untrusted-workspace-value",
  authenticationMode: "local-test",
  isInstallationAdmin: false,
  databricksAccessToken: null,
};

test("ProjectComponentsService_AcceptsAllLegacyComponentTypesAndNormalizesDefaults", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const components = PROJECT_COMPONENT_TYPES.map((type, index) => ({
    key: `component-${index}`,
    type,
    schemaVersion: 1,
    codeName: null,
    description: null,
    properties: type === "Tabs"
      ? { tabs: ["Tab 1", "Tab 2"], defaultTabIndex: 0 }
      : type === "Dropdown"
      ? { label: "Select an option", options: [{ value: "1" }] }
      : type === "DatePicker"
      ? { label: "Select Date", defaultValue: "today" }
      : type === "TimePicker"
      ? { label: "Select Time", defaultValue: "now", step: 900 }
      : type === "Slider"
      ? {
          label: "Slider",
          minValue: 0,
          maxValue: 100,
          defaultValue: 50,
          upperValue: 60,
          step: 1,
          ranged: false,
        }
      : type === "Label"
      ? { text: "Revenue", fontSize: "medium", bold: false }
      : type === "Expander"
      ? { sectionTitle: "Section", defaultExpanded: false }
      : type === "Columns"
      ? { columnCount: 2 }
      : type === "Rows"
      ? { rowCount: 2 }
      : type === "Form"
      ? {
          submitButtonText: "Submit",
          clearOnSubmit: false,
          enterToSubmit: true,
          border: true,
          width: "stretch",
          height: "content",
        }
      : type === "Modal"
      ? {
          title: "My Modal",
          width: null,
          height: null,
          position: "center",
          dismissible: true,
        }
      : type === "FileUpload"
      ? { label: "Upload File" }
      : type === "DataWindow"
      ? {
          label: "Data Table",
          maxRows: 0,
          scrollable: true,
          placeholder: null,
          width: "stretch",
          hideIndex: null,
          height: "auto",
        }
      : type === "EditableDataWindow"
      ? {
          label: "Editable Data Table",
          maxRows: 0,
          scrollable: true,
          placeholder: null,
          disabled: false,
          numRows: "fixed",
          hideIndex: null,
          width: "stretch",
          height: "auto",
        }
      : type === "BarChart"
      ? {
          title: "Bar Chart",
          seriesColor: "#1f77b4",
          xAxis: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          yAxis: { field: "", displayName: "", scaleType: "continuous", transform: "count" },
        }
      : type === "LineChart"
      ? {
          title: "Line Chart",
          seriesColor: "#1f77b4",
          xAxis: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
          yAxis: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
        }
      : type === "PieChart"
      ? {
          title: "Pie Chart",
          seriesColor: "#1f77b4",
          category: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          value: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
        }
      : type === "DonutChart"
      ? {
          title: "Donut Chart",
          seriesColor: "#1f77b4",
          category: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          value: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
        }
      : type === "AmoebaStory"
      ? {
          title: "Amoeba Story",
          entityId: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          entityLabel: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          category: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          sizeMetric: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
          xMetric: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
          yMetric: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
          changeMetric: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
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
        }
      : type === "FlowFieldStory"
      ? {
          title: "Flow Field Story",
          sourceStage: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          destinationStage: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          flowVolume: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
          stageOrder: { field: "", displayName: "", scaleType: "continuous", transform: "max" },
          timeField: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          conversionPct: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
          dropOffCount: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
          avgTimeInStage: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
          status: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          showDropOffs: true,
          showLabels: true,
        }
      : type === "HeatMapStory"
      ? {
          title: "Heat Map Story",
          geographicArea: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          metricValue: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
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
        }
      : type === "HoneycombStory"
      ? {
          title: "Honeycomb Story",
          itemName: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          impactScore: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
          priorityLevel: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
          progressPct: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
          category: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
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
        }
      : type === "NetworkWebStory"
      ? networkWebStoryDefaults()
      : type === "PulseWaveStory"
      ? pulseWaveStoryDefaults()
      : type === "SpiralStory"
      ? spiralStoryDefaults()
      : type === "TerrainStory"
      ? terrainStoryDefaults()
      : type === "DashboardEmbed"
      ? { src: "", height: 600, scrolling: true }
      : type === "GenieChat"
      ? { genieSpaceId: "", genieSpaceTitle: "", title: "Genie Chat", showBorder: false, chatTotalHeightPixels: 600 }
      : type === "ModelChat"
      ? { servingEndpointName: "", title: "Model Chat", showBorder: false, chatTotalHeightPixels: 600 }
      : { order: index },
  }));

  const result = await service.replaceComponents(
    caller,
    "request-1",
    "project-1",
    { version: 3, components },
  );

  assert.equal(PROJECT_COMPONENT_TYPES.length, 33);
  assert.equal(result.version, 4);
  assert.equal(result.components.length, 33);
  assert.equal(result.components[0]?.componentVersion, 1);
  assert.deepEqual(result.components[0]?.children, []);
  assert.equal(repository.lastActor?.workspaceId, "workspace-a");
  assert.equal(repository.lastActor?.userId, "editor-1");
  assert.deepEqual(
    result.components.map((component) => component.key),
    components.map((component) => component.key),
  );
});

function networkWebStoryDefaults() {
  const categoricalAxis = { field: "", displayName: "", scaleType: "categorical", transform: "none" };
  const continuousAxis = { field: "", displayName: "", scaleType: "continuous", transform: "none" };
  return {
    title: "Network Web Story",
    sourceEntityId: categoricalAxis,
    sourceEntityLabel: categoricalAxis,
    targetEntityId: categoricalAxis,
    targetEntityLabel: categoricalAxis,
    relationshipType: categoricalAxis,
    relationshipWeight: continuousAxis,
    timeField: categoricalAxis,
    direction: categoricalAxis,
    edgeValue: continuousAxis,
    frequency: continuousAxis,
    edgeRiskScore: continuousAxis,
    edgeStatus: categoricalAxis,
    sourceCategory: categoricalAxis,
    targetCategory: categoricalAxis,
    sourceValue: continuousAxis,
    targetValue: continuousAxis,
    sourceHealthScore: continuousAxis,
    targetHealthScore: continuousAxis,
    sourceRiskScore: continuousAxis,
    targetRiskScore: continuousAxis,
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
  };
}

function pulseWaveStoryDefaults() {
  const categoricalAxis = { field: "", displayName: "", scaleType: "categorical", transform: "none" };
  const continuousAxis = { field: "", displayName: "", scaleType: "continuous", transform: "none" };
  return {
    title: "Pulse Wave Story",
    metricName: "Metric",
    timeField: categoricalAxis,
    metricValue: { ...continuousAxis, transform: "sum" },
    baselineValue: { ...continuousAxis, transform: "avg" },
    eventName: categoricalAxis,
    eventType: categoricalAxis,
    impactScore: { ...continuousAxis, transform: "avg" },
    aggregationMethod: "sum",
    showBaseline: true,
    showEvents: true,
    showAnomalyMarkers: true,
    fillUnderWave: true,
  };
}

function spiralStoryDefaults() {
  return {
    title: "Spiral Story",
    journeyName: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    stage: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    timelineField: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    progressPct: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
    metricValue: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
    targetDate: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    actualDate: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    status: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    riskScore: { field: "", displayName: "", scaleType: "continuous", transform: "avg" },
    owner: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    keyAchievement: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    cost: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
    showLabels: true,
    showRiskGlow: true,
    showVariance: true,
    spaceByTimeline: false,
  };
}

function terrainStoryDefaults() {
  const categoricalAxis = { field: "", displayName: "", scaleType: "categorical", transform: "none" };
  const continuousAxis = { field: "", displayName: "", scaleType: "continuous", transform: "none" };
  return {
    title: "Terrain Story",
    xDimension: categoricalAxis,
    yDimension: categoricalAxis,
    heightMetric: { ...continuousAxis, transform: "sum" },
    timeField: categoricalAxis,
    terrainCategory: categoricalAxis,
    riskScore: { ...continuousAxis, transform: "avg" },
    targetValue: { ...continuousAxis, transform: "avg" },
    baselineValue: { ...continuousAxis, transform: "avg" },
    forecastValue: { ...continuousAxis, transform: "avg" },
    volumeMetric: { ...continuousAxis, transform: "sum" },
    status: categoricalAxis,
    eventName: categoricalAxis,
    eventDate: categoricalAxis,
    calloutText: categoricalAxis,
    terrainMode: "surface",
    heightScale: 1,
    interpolation: "bilinear",
    gridResolution: 60,
    colorBy: "height_metric",
    showPeakLabels: true,
    showValleyLabels: true,
    cameraPreset: "angled",
    aggregationMethod: "sum",
  };
}

test("ProjectComponentsService_RejectsInvalidAuthorityVersionsAndNestedReferences", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const validComponent = {
    key: "component-1",
    type: "TextInput",
    schemaVersion: 1,
    properties: { label: "Customer" },
    children: [],
  };
  const invalidRequests: unknown[] = [
    { version: 0, components: [] },
    { version: 1, workspaceHost: "https://outside.invalid", components: [] },
    { version: 1, components: [{ ...validComponent, key: "bad key" }] },
    { version: 1, components: [{ ...validComponent, type: "Unknown" }] },
    { version: 1, components: [{ ...validComponent, schemaVersion: 0 }] },
    {
      version: 1,
      components: [
        validComponent,
        { ...validComponent, codeName: "customer" },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "DatePicker",
          properties: { label: "Pick a date", defaultValue: "2025-02-30" },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "DatePicker",
          properties: {
            label: "Pick a date",
            minDate: "2025-02-01",
            maxDate: "2025-01-01",
          },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "DatePicker",
          properties: { label: "Pick a date", format: "DD/MM/YY" },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "TimePicker",
          properties: { label: "Pick a time", defaultValue: "25:30" },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "TimePicker",
          properties: { label: "Pick a time", step: 0 },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "TimePicker",
          properties: { label: "Pick a time", step: 82_801 },
        },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, children: ["missing-child"] },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, children: ["component-2"] },
        { ...validComponent, key: "component-2", children: ["component-1"] },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, properties: { workspaceHost: "https://outside.invalid" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, bindings: { source: { workspaceConnectionId: "external" } } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, properties: { number: Number.POSITIVE_INFINITY } },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "Dropdown",
          properties: { label: "Pick one", options: [{ value: "one", externalUrl: "https://outside.invalid" }] },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "Dropdown",
          properties: { label: "Pick one", options: [{ value: 1 }] },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "Dropdown",
          properties: {
            label: "Pick one",
            options: [{ value: "one" }],
            defaultValue: "missing",
            multiselect: true,
          },
        },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section", defaultExpanded: "true" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section", unknown: true } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", schemaVersion: 2, properties: { sectionTitle: "Section" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, layout: { y: 0 } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, bindings: { source: "table" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, children: ["nested-expander"] },
        { ...validComponent, key: "nested-expander", type: "Expander", properties: { sectionTitle: "Nested" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, children: ["unsupported-child"] },
        { ...validComponent, key: "unsupported-child", type: "Form", properties: {} },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, children: ["nested-input"] },
        { ...validComponent, key: "nested-input", children: ["other-input"] },
        { ...validComponent, key: "other-input" },
      ],
    },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: 0 } }] },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: 1.5 } }] },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: 13 } }] },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: "two" } }] },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: 2, extra: true } }] },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Columns", properties: { columnCount: 1 }, children: ["first-input", "second-input"] },
        validTextInput("first-input"),
        validTextInput("second-input"),
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Columns", properties: { columnCount: 2 }, children: ["nested-expander"] },
        { ...validComponent, key: "nested-expander", type: "Expander", properties: { sectionTitle: "Nested" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Columns", properties: { columnCount: 2 }, bindings: { source: "volume" } },
      ],
    },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: 0 } }] },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: 1.5 } }] },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: 13 } }] },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: "two" } }] },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: 2, extra: true } }] },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Rows", properties: { rowCount: 1 }, children: ["first-input", "second-input"] },
        validTextInput("first-input"),
        validTextInput("second-input"),
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Rows", properties: { rowCount: 2 }, children: ["nested-columns"] },
        { ...validComponent, key: "nested-columns", type: "Columns", properties: { columnCount: 2 } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Rows", properties: { rowCount: 2 }, bindings: { source: "volume" } },
      ],
    },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_RejectsOversizedAndOverdeepJson", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  let nestedValue: unknown = "value";

  for (let depth = 0; depth < 22; depth += 1) {
    nestedValue = { child: nestedValue };
  }

  const invalidRequests = [
    {
      version: 1,
      components: [
        {
          key: "deep-json",
          type: "TextInput",
          schemaVersion: 1,
          properties: { nested: nestedValue },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          key: "large-json",
          type: "TextInput",
          schemaVersion: 1,
          properties: { text: "x".repeat(950_000) },
        },
      ],
    },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_RejectsInvalidSliderPropertiesBeforePersistence", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const invalidSliders = [
    { label: "", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, ranged: false },
    { label: "Slider", minValue: 100, maxValue: 0, defaultValue: 50, step: 1, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 101, step: 1, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 0, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 101, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, ranged: true },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 75, upperValue: 50, step: 1, ranged: true },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, format: "bad-format", ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, ranged: "false" },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: Number.NaN, step: 1, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, ranged: false, unknown: true },
  ];

  for (const [index, properties] of invalidSliders.entries()) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-slider-invalid", "project-1", {
        version: 1,
        components: [{
          key: "slider-invalid",
          type: "Slider",
          schemaVersion: 1,
          properties,
        }],
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
      `invalid slider case ${index} should be rejected`,
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_AcceptsValidRangedSliderProperties", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const component = {
    key: "slider-range",
    type: "Slider",
    schemaVersion: 1,
    properties: {
      label: "Budget",
      minValue: 0,
      maxValue: 100,
      defaultValue: 25,
      upperValue: 75,
      step: 5,
      ranged: true,
    },
  };

  const result = await service.replaceComponents(caller, "request-slider-range", "project-1", {
    version: 1,
    components: [component],
  });

  assert.equal(result.components[0]?.type, "Slider");
  assert.equal(result.components[0]?.properties.ranged, true);
  assert.equal(result.components[0]?.properties.upperValue, 75);
});

test("ProjectComponentsService_RejectsInvalidLabelPropertiesBeforePersistence", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const invalidLabels = [
    { text: 12, fontSize: "medium", bold: false },
    { text: "Revenue", fontSize: "huge", bold: false },
    { text: "Revenue", fontSize: "small", bold: "false" },
    { text: "Revenue", fontSize: "small", bold: false, extra: true },
  ];

  for (const [index, properties] of invalidLabels.entries()) {
    await assert.rejects(
      () => service.replaceComponents(caller, `request-label-invalid-${index}`, "project-1", {
        version: 1,
        components: [{
          key: `label-invalid-${index}`,
          type: "Label",
          schemaVersion: 1,
          properties,
        }],
      }),
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_AcceptsLabelProperties", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-label", "project-1", {
    version: 1,
    components: [{
      key: "revenue-label",
      type: "Label",
      schemaVersion: 1,
      properties: { text: "Revenue", fontSize: "large", bold: true },
    }],
  });

  assert.equal(result.components[0]?.type, "Label");
  assert.deepEqual(result.components[0]?.properties, {
    text: "Revenue",
    fontSize: "large",
    bold: true,
  });
});

test("ProjectComponentsService_AcceptsOrderedExpanderChildren", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-expander", "project-1", {
    version: 1,
    components: [
      {
        key: "section",
        type: "Expander",
        schemaVersion: 1,
        properties: { sectionTitle: "Details", defaultExpanded: true },
        children: ["second-input", "first-input"],
      },
      { ...validTextInput("first-input"), properties: { label: "First" } },
      { ...validTextInput("second-input"), properties: { label: "Second" } },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["second-input", "first-input"]);
  assert.equal(result.components[0]?.properties.defaultExpanded, true);
});

test("ProjectComponentsService_AcceptsOrderedColumnsChildren", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-columns", "project-1", {
    version: 1,
    components: [
      {
        key: "columns",
        type: "Columns",
        schemaVersion: 1,
        properties: { columnCount: 3 },
        children: ["second-input", "first-input"],
      },
      { ...validTextInput("first-input"), properties: { label: "First" } },
      { ...validTextInput("second-input"), properties: { label: "Second" } },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["second-input", "first-input"]);
  assert.equal(result.components[0]?.properties.columnCount, 3);
});

test("ProjectComponentsService_AcceptsOrderedRowsChildren", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-rows", "project-1", {
    version: 1,
    components: [
      {
        key: "rows",
        type: "Rows",
        schemaVersion: 1,
        properties: { rowCount: 3 },
        children: ["second-input", "first-input"],
      },
      { ...validTextInput("first-input"), properties: { label: "First" } },
      { ...validTextInput("second-input"), properties: { label: "Second" } },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["second-input", "first-input"]);
  assert.equal(result.components[0]?.properties.rowCount, 3);
});

test("ProjectComponentsService_AcceptsTabsChildrenByPaneAndPosition", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-tabs", "project-1", {
    version: 1,
    components: [
      {
        key: "tabs",
        type: "Tabs",
        schemaVersion: 1,
        properties: { tabs: ["Overview", "Details"], defaultTabIndex: 1 },
        children: ["later-child", "first-child", "second-pane"],
      },
      { ...validTextInput("first-child"), layout: { tabIndex: 0, y: 0 } },
      { ...validTextInput("later-child"), layout: { tabIndex: 0, y: 1 } },
      { ...validTextInput("second-pane"), layout: { tabIndex: 1, y: 0 } },
    ],
  });

  assert.deepEqual(result.components[0]?.children, [
    "later-child",
    "first-child",
    "second-pane",
  ]);
  assert.deepEqual(result.components[0]?.properties, {
    tabs: ["Overview", "Details"],
    defaultTabIndex: 1,
  });
  assert.deepEqual(result.components[1]?.layout, { tabIndex: 0, y: 0 });
});

test("ProjectComponentsService_RejectsInvalidTabsAndChildLayouts", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const tabs = {
    key: "tabs",
    type: "Tabs",
    schemaVersion: 1,
    properties: { tabs: ["Overview", "Details"], defaultTabIndex: 0 },
    children: ["child"],
  };
  const child = { ...validTextInput("child"), layout: { tabIndex: 0, y: 0 } };
  const invalidRequests: unknown[] = [
    { version: 1, components: [{ ...tabs, properties: {} }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: [] } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: [" "] } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: ["x".repeat(101)] } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: ["Overview"], defaultTabIndex: 1 } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: ["Same", "Same"], defaultTabIndex: 1 } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: ["Overview"], extra: true } }] },
    { version: 1, components: [{ ...tabs, schemaVersion: 2 }] },
    { version: 1, components: [{ ...tabs, layout: { y: 0 } }] },
    { version: 1, components: [{ ...tabs, bindings: { table: "resource" } }] },
    { version: 1, components: [{ ...tabs, children: ["child"] }, validTextInput("child")] },
    { version: 1, components: [{ ...tabs, children: ["child"] }, { ...child, layout: { tabIndex: -1, y: 0 } }] },
    { version: 1, components: [{ ...tabs, children: ["child"] }, { ...child, layout: { tabIndex: 2, y: 0 } }] },
    { version: 1, components: [{ ...tabs, children: ["child"] }, { ...child, layout: { tabIndex: 0, y: "first" } }] },
    {
      version: 1,
      components: [
        { ...tabs, children: ["nested-tabs"] },
        { ...validTextInput("nested-tabs"), type: "Tabs", properties: { tabs: ["Nested"] }, layout: { tabIndex: 0, y: 0 } },
      ],
    },
    {
      version: 1,
      components: [
        { ...tabs, children: ["nested-child"] },
        { ...child, children: ["grandchild"] },
        validTextInput("grandchild"),
      ],
    },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid-tabs", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_AcceptsOrderedFormControlsAndDocumentedDimensions", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-form", "project-1", {
    version: 1,
    components: [
      {
        key: "form",
        type: "Form",
        schemaVersion: 1,
        properties: {
          submitButtonText: "Save record",
          clearOnSubmit: true,
          enterToSubmit: false,
          border: false,
          width: 720,
          height: "content",
        },
        children: ["name", "approved"],
      },
      validTextInput("name"),
      {
        key: "approved",
        type: "Checkbox",
        schemaVersion: 1,
        properties: { label: "Approved", defaultChecked: false },
        children: [],
      },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["name", "approved"]);
  assert.equal(result.components[0]?.properties.width, 720);
});

test("ProjectComponentsService_RejectsInvalidFormPropertiesAndChildren", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const form = {
    key: "form",
    type: "Form",
    schemaVersion: 1,
    properties: { submitButtonText: "Save" },
    children: ["child"],
  };
  const invalidRequests: unknown[] = [
    { version: 1, components: [{ ...form, properties: { ...form.properties, extra: true } }] },
    { version: 1, components: [{ ...form, properties: { ...form.properties, clearOnSubmit: "yes" } }] },
    { version: 1, components: [{ ...form, properties: { ...form.properties, width: "wide" } }] },
    { version: 1, components: [{ ...form, properties: { ...form.properties, width: 10_001 } }] },
    { version: 1, components: [{ ...form, schemaVersion: 2 }] },
    { version: 1, components: [{ ...form, layout: { y: 1 } }] },
    { version: 1, components: [{ ...form, bindings: { table: "resource" } }] },
    { version: 1, components: [{ ...form, children: ["child"] }, { ...validTextInput("child"), type: "Button" }] },
    {
      version: 1,
      components: [
        { ...form, children: ["child"] },
        { ...validTextInput("child"), children: ["grandchild"] },
        validTextInput("grandchild"),
      ],
    },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid-form", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_AcceptsModalChildrenAndPreservesLegacyDimensions", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-modal", "project-1", {
    version: 1,
    components: [
      {
        key: "modal",
        type: "Modal",
        schemaVersion: 1,
        codeName: "reviewModal",
        properties: {
          title: "Review details",
          width: "medium",
          height: 640,
          position: "right",
          dismissible: false,
        },
        children: ["section", "confirm"],
      },
      {
        key: "section",
        type: "Expander",
        schemaVersion: 1,
        properties: { sectionTitle: "Details", defaultExpanded: true },
        children: ["note"],
      },
      validTextInput("note"),
      {
        ...validTextInput("confirm"),
        type: "Button",
        properties: { label: "Close" },
        layout: { y: 1 },
      },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["section", "confirm"]);
  assert.deepEqual(result.components[1]?.children, ["note"]);
  assert.equal(result.components[0]?.properties.height, 640);
  assert.equal(result.components[0]?.properties.position, "right");
  assert.equal(result.components[0]?.properties.dismissible, false);
});

test("ProjectComponentsService_RejectsInvalidModalPropertiesAndNesting", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const modal = {
    key: "modal",
    type: "Modal",
    schemaVersion: 1,
    properties: { title: "Review" },
    children: ["child"],
  };
  const invalidRequests: unknown[] = [
    { version: 1, components: [{ ...modal, properties: { title: "  " } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", width: "wide" } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", width: 2_147_483_648 } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", position: "top" } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", dismissible: "yes" } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", height: "content" } }] },
    { version: 1, components: [{ ...modal, layout: { y: 1 } }] },
    { version: 1, components: [{ ...modal, bindings: { table: "resource" } }] },
    { version: 1, components: [{ ...modal, children: ["nested"] }, { ...modal, key: "nested" }] },
    { version: 1, components: [{ ...modal, children: ["child"] }, { ...validTextInput("child"), layout: { y: -1 } }] },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid-modal", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_AcceptsCompleteAndIncompleteFileUploadVolumeBindings", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-file-upload", "project-1", {
    version: 3,
    components: [
      {
        key: "upload",
        type: "FileUpload",
        schemaVersion: 1,
        properties: { label: "Select files" },
        bindings: {
          databricksVolume: {
            bindingType: "databricksVolume",
            source: {
              kind: "resource",
              valueType: "file",
              resource: {
                type: "databricksVolume",
                catalog: "main",
                schema: "landing",
                volume: "incoming",
                filePath: "imports/2026",
              },
            },
          },
        },
      },
      {
        key: "incomplete-upload",
        type: "FileUpload",
        schemaVersion: 1,
        properties: { label: "Choose a destination later" },
        bindings: {
          databricksVolume: {
            bindingType: "databricksVolume",
            source: {
              kind: "resource",
              valueType: "file",
              resource: {
                type: "databricksVolume",
                catalog: "main",
                schema: null,
                volume: null,
                filePath: "",
              },
            },
          },
        },
      },
    ],
  });

  assert.equal(result.components[0]?.properties.label, "Select files");
  assert.deepEqual(
    result.components[0]?.bindings?.databricksVolume,
    repository.lastComponents[0]?.bindings?.databricksVolume,
  );
  assert.equal(result.components[1]?.bindings?.databricksVolume !== null, true);
});

test("ProjectComponentsService_AcceptsCompleteAndIncompleteUnityCatalogDataWindowBindings", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const binding = (catalog: string | null, schema: string | null, table: string | null) => ({
    unityCatalogTable: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          catalog,
          schema,
          table,
          primaryKeyColumn: null,
          columns: [{ name: "customer name", type: "STRING" }],
        },
      },
    },
  });
  const components: unknown[] = [
    {
      key: "data-window-complete",
      type: "DataWindow",
      schemaVersion: 1,
      properties: {
        label: "Customers",
        maxRows: 100,
        scrollable: true,
        placeholder: "(missing)",
        width: 800,
        hideIndex: false,
        height: "content",
      },
      bindings: binding("main", "default", "customers"),
    },
    {
      key: "data-window-incomplete",
      type: "DataWindow",
      schemaVersion: 1,
      properties: { label: "Choose table" },
      bindings: binding("main", null, null),
    },
  ];

  const result = await service.replaceComponents(
    caller,
    "request-data-window",
    "project-1",
    { version: 3, components },
  );

  assert.equal(result.components[0]?.properties.maxRows, 100);
  assert.deepEqual(result.components[0]?.bindings, repository.lastComponents[0]?.bindings);
  assert.equal(result.components[1]?.bindings?.unityCatalogTable !== null, true);
});

test("ProjectComponentsService_RejectsInvalidDataWindowPropertiesAndAuthorityBinding", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const invalidComponents = [
    { key: "bad-label", type: "DataWindow", schemaVersion: 1, properties: { label: " " } },
    { key: "bad-rows", type: "DataWindow", schemaVersion: 1, properties: { maxRows: -1 } },
    { key: "bad-width", type: "DataWindow", schemaVersion: 1, properties: { width: "wide" } },
    {
      key: "authority-binding",
      type: "DataWindow",
      schemaVersion: 1,
      properties: { label: "Table" },
      bindings: { unityCatalogTable: { workspaceHost: "https://outside.invalid" } },
    },
  ];

  for (const component of invalidComponents) {
    await assert.rejects(
      () => service.replaceComponents(
        caller,
        "request-data-window-invalid",
        "project-1",
        { version: 3, components: [component] },
      ),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_SavesEditableDataWindowOptionsAndPrimaryKeyBinding", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const component = {
    key: "editable-customers",
    type: "EditableDataWindow",
    schemaVersion: 1,
    properties: {
      label: "Editable customers",
      maxRows: 75,
      scrollable: false,
      placeholder: "No rows",
      disabled: false,
      numRows: "dynamic",
      hideIndex: true,
      width: "stretch",
      height: "content",
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
              { name: "customer name", type: "STRING", dataType: "STRING" },
            ],
          },
        },
      },
    },
  };

  const result = await service.replaceComponents(
    caller,
    "request-editable-data-window",
    "project-1",
    { version: 3, components: [component] },
  );

  assert.equal(result.components[0]?.properties.numRows, "dynamic");
  assert.equal(result.components[0]?.properties.disabled, false);
  assert.equal(result.components[0]?.bindings?.unityCatalogTable !== undefined, true);
});

test("ProjectComponentsService_RejectsEditableDataWindowWithoutValidPrimaryKeyOrOptions", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const binding = (primaryKeyColumn: string | null) => ({
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
          primaryKeyColumn,
          columns: [{ name: "customer_id", type: "BIGINT", dataType: "LONG" }],
        },
      },
    },
  });
  const invalidComponents: unknown[] = [
    { key: "bad-mode", type: "EditableDataWindow", schemaVersion: 1, properties: { numRows: "unbounded" } },
    { key: "bad-disabled", type: "EditableDataWindow", schemaVersion: 1, properties: { disabled: "false" } },
    { key: "missing-key", type: "EditableDataWindow", schemaVersion: 1, properties: {}, bindings: binding(null) },
    { key: "unknown-key", type: "EditableDataWindow", schemaVersion: 1, properties: {}, bindings: binding("missing") },
  ];

  for (const component of invalidComponents) {
    await assert.rejects(
      () => service.replaceComponents(
        caller,
        "request-editable-data-window-invalid",
        "project-1",
        { version: 3, components: [component] },
      ),
      (error: unknown) =>
        typeof error === "object" && error !== null &&
        "code" in error && error.code === "invalid_component_aggregate",
    );
  }
  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_RejectsUnsafeFileUploadBindingsAndLabels", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const volumeBinding = (filePath: string) => ({
    databricksVolume: {
      bindingType: "databricksVolume",
      source: {
        kind: "resource",
        valueType: "file",
        resource: {
          type: "databricksVolume",
          catalog: "main",
          schema: "landing",
          volume: "incoming",
          filePath,
        },
      },
    },
  });
  const invalidRequests: unknown[] = [
    { label: "  " },
    { label: "Upload", workspaceHost: "https://outside.invalid" },
  ].map((properties) => ({
    version: 3,
    components: [{ key: "upload", type: "FileUpload", schemaVersion: 1, properties }],
  }));

  for (const filePath of ["../escape", "a/../../escape", "/absolute", "folder\\name"]) {
    invalidRequests.push({
      version: 3,
      components: [{
        key: "upload",
        type: "FileUpload",
        schemaVersion: 1,
        properties: { label: "Upload" },
        bindings: volumeBinding(filePath),
      }],
    });
  }

  const invalidResourceNameBinding = volumeBinding("imports");
  invalidResourceNameBinding.databricksVolume.source.resource.catalog = "main/other";
  invalidRequests.push({
    version: 3,
    components: [{
      key: "upload",
      type: "FileUpload",
      schemaVersion: 1,
      properties: { label: "Upload" },
      bindings: invalidResourceNameBinding,
    }],
  });

  invalidRequests.push({
    version: 3,
    components: [{
      key: "upload",
      type: "FileUpload",
      schemaVersion: 1,
      properties: { label: "Upload" },
      bindings: {
        databricksVolume: {
          ...volumeBinding("imports").databricksVolume,
          workspaceHost: "https://outside.invalid",
        },
      },
    }],
  });

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-file-upload-invalid", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_PassesReadsThroughWithTrustedWorkspaceActor", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");

  const document = await service.getComponents(caller, "request-read", "project-1");

  assert.equal(document.projectId, "project-1");
  assert.equal(repository.lastActor?.workspaceId, "workspace-a");
  assert.equal(repository.lastActor?.requestId, "request-read");
});

class RecordingComponentsRepository implements ProjectComponentsRepository {
  lastActor: ProjectActor | null = null;
  lastComponents: ProjectComponent[] = [];
  replaceCalls = 0;

  async getComponents(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument> {
    this.lastActor = actor;
    return { projectId, version: 3, components: [] };
  }

  async replaceComponents(
    projectId: string,
    expectedVersion: number,
    components: ProjectComponent[],
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument> {
    this.replaceCalls += 1;
    this.lastActor = actor;
    this.lastComponents = components;
    return {
      projectId,
      version: expectedVersion + 1,
      components,
    };
  }
}

function validTextInput(key: string): ProjectComponent {
  return {
    key,
    type: "TextInput",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: key.replaceAll("-", "_"),
    description: null,
    properties: { label: key },
    bindings: null,
    children: [],
    layout: null,
  };
}
