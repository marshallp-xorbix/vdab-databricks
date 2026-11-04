import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
} from "../src/db/project-components-contract.ts";
import { PROJECT_COMPONENT_TYPES } from "../src/db/project-components-contract.ts";
import { ProjectComponentsService } from "../src/db/project-components-service.ts";
import type { ProjectComponentsRepository } from "../src/db/project-components-repository.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";
import {
  caller,
  RecordingComponentsRepository,
  validTextInput,
} from "./project-components-service-test-support.ts";

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

