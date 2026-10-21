import type { IProjectComponent, ProjectJsonObject } from "../models/ProjectComponents";
import { createHeatMapStoryProperties } from "../types/heatMapStory";
import { createHoneycombStoryProperties } from "../types/honeycombStory";
import { createNetworkWebStoryProperties } from "../types/networkWebStory";
import { createPulseWaveStoryProperties } from "../types/pulseWaveStory";
import { createSpiralStoryProperties } from "../types/spiralStory";
import { createTerrainStoryProperties } from "../types/terrainStory";
import { createDashboardEmbedProperties } from "../types/dashboardEmbed";
import { createGenieChatProperties } from "../types/genieChat";
import { createModelChatProperties } from "../types/modelChat";

export const PROJECT_COMPONENT_ADD_TYPES = [
  "DashboardEmbed",
  "GenieChat",
  "ModelChat",
  "TextInput",
  "Button",
  "Checkbox",
  "Toggle",
  "Dropdown",
  "DatePicker",
  "TimePicker",
  "FileUpload",
  "DataWindow",
  "EditableDataWindow",
  "Slider",
  "Label",
  "Expander",
  "Columns",
  "Rows",
  "Tabs",
  "Form",
  "Modal",
  "BarChart",
  "LineChart",
  "PieChart",
  "DonutChart",
  "AmoebaStory",
  "FlowFieldStory",
  "HeatMapStory",
  "HoneycombStory",
  "NetworkWebStory",
  "PulseWaveStory",
  "SpiralStory",
  "TerrainStory",
] as const;

export type ProjectComponentAddType = (typeof PROJECT_COMPONENT_ADD_TYPES)[number];

export const LAYOUT_CHILD_TYPES = [
  "TextInput",
  "Button",
  "Checkbox",
  "Toggle",
  "Dropdown",
  "DatePicker",
  "TimePicker",
  "FileUpload",
  "Slider",
  "Label",
] as const;

export type LayoutChildComponentType = (typeof LAYOUT_CHILD_TYPES)[number];

export const FORM_CHILD_TYPES = [
  "TextInput",
  "Checkbox",
  "Toggle",
  "Dropdown",
  "DatePicker",
  "TimePicker",
  "Slider",
  "Label",
] as const;

export type FormChildComponentType = (typeof FORM_CHILD_TYPES)[number];

export const MODAL_CHILD_TYPES = [
  ...LAYOUT_CHILD_TYPES,
  "Expander",
  "Columns",
  "Rows",
  "Tabs",
  "Form",
] as const;

export type ModalChildComponentType = (typeof MODAL_CHILD_TYPES)[number];

const CODE_NAME_PREFIXES: Record<ProjectComponentAddType, string> = {
  DashboardEmbed: "dashboardEmbed",
  GenieChat: "genieChat",
  ModelChat: "modelChat",
  TextInput: "textInput",
  Button: "button",
  Checkbox: "checkbox",
  Toggle: "toggle",
  Dropdown: "dropdown",
  DatePicker: "datePicker",
  TimePicker: "timePicker",
  FileUpload: "fileUpload",
  DataWindow: "dataWindow",
  EditableDataWindow: "editableDataWindow",
  Slider: "slider",
  Label: "label",
  Expander: "expander",
  Columns: "columns",
  Rows: "rows",
  Tabs: "tabs",
  Form: "form",
  Modal: "modal",
  BarChart: "barChart",
  LineChart: "lineChart",
  PieChart: "pieChart",
  DonutChart: "donutChart",
  AmoebaStory: "amoebaStory",
  FlowFieldStory: "flowFieldStory",
  HeatMapStory: "heatMapStory",
  HoneycombStory: "honeycombStory",
  NetworkWebStory: "networkWebStory",
  PulseWaveStory: "pulseWaveStory",
  SpiralStory: "spiralStory",
  TerrainStory: "terrainStory",
};

const DEFAULT_PROPERTIES: Record<
  ProjectComponentAddType,
  () => ProjectJsonObject
> = {
  DashboardEmbed: createDashboardEmbedProperties,
  GenieChat: createGenieChatProperties,
  ModelChat: createModelChatProperties,
  TextInput: () => ({ label: "Label", placeholder: "", defaultValue: "", help: "", disabled: false, type: "default", multiline: false, height: "" }),
  Button: () => ({ label: "Click Me", variant: "primary", disabled: false, help: "" }),
  Checkbox: () => ({ label: "Checkbox", defaultChecked: false, help: "", disabled: false }),
  Toggle: () => ({ label: "Toggle", defaultValue: false, help: "", disabled: false }),
  Dropdown: () => ({ label: "Select an option", options: [{ value: "1" }, { value: "2" }], defaultValue: "", disabled: false, help: "", placeholder: "Select an option", multiselect: false }),
  DatePicker: () => ({ label: "Select Date", defaultValue: "today", minDate: "", maxDate: "", format: "", help: "", disabled: false }),
  TimePicker: () => ({ label: "Select Time", defaultValue: "now", step: 900, help: "", disabled: false }),
  FileUpload: () => ({ label: "Upload File" }),
  DataWindow: () => ({ label: "Data Table", maxRows: 0, scrollable: true, placeholder: null, width: "stretch", hideIndex: null, height: "auto" }),
  EditableDataWindow: () => ({ label: "Editable Data Table", maxRows: 0, scrollable: true, placeholder: null, disabled: false, numRows: "fixed", width: "stretch", hideIndex: null, height: "auto" }),
  Slider: () => ({ label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, upperValue: 60, step: 1, disabled: false, help: "", format: "", ranged: false }),
  Label: () => ({ text: "Label Text", fontSize: "medium", bold: false }),
  Expander: () => ({ sectionTitle: "Section", defaultExpanded: false }),
  Columns: () => ({ columnCount: 2 }),
  Rows: () => ({ rowCount: 2 }),
  Tabs: () => ({ tabs: ["Tab 1", "Tab 2"], defaultTabIndex: 0 }),
  Form: () => ({ submitButtonText: "Submit", clearOnSubmit: false, enterToSubmit: true, border: true, width: "stretch", height: "content" }),
  Modal: () => ({ title: "My Modal", width: null, height: null, position: "center", dismissible: true }),
  BarChart: () => ({
    title: "Bar Chart",
    seriesColor: "#1f77b4",
    xAxis: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    yAxis: { field: "", displayName: "", scaleType: "continuous", transform: "count" },
  }),
  LineChart: () => ({
    title: "Line Chart",
    seriesColor: "#1f77b4",
    xAxis: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
    yAxis: { field: "", displayName: "", scaleType: "continuous", transform: "none" },
  }),
  PieChart: () => ({
    title: "Pie Chart",
    seriesColor: "#1f77b4",
    category: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    value: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
  }),
  DonutChart: () => ({
    title: "Donut Chart",
    seriesColor: "#1f77b4",
    category: { field: "", displayName: "", scaleType: "categorical", transform: "none" },
    value: { field: "", displayName: "", scaleType: "continuous", transform: "sum" },
  }),
  AmoebaStory: () => ({
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
  }),
  FlowFieldStory: () => ({
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
  }),
  HeatMapStory: createHeatMapStoryProperties,
  HoneycombStory: createHoneycombStoryProperties,
  NetworkWebStory: createNetworkWebStoryProperties,
  PulseWaveStory: createPulseWaveStoryProperties,
  SpiralStory: createSpiralStoryProperties,
  TerrainStory: createTerrainStoryProperties,
};

/** Creates a new standalone component using the registry's current defaults. */
export function createProjectComponent(
  type: ProjectComponentAddType,
  existingComponents: IProjectComponent[],
): IProjectComponent {
  return {
    key: crypto.randomUUID(),
    type,
    schemaVersion: 1,
    componentVersion: 1,
    codeName: nextCodeName(existingComponents, CODE_NAME_PREFIXES[type]),
    description: null,
    properties: DEFAULT_PROPERTIES[type](),
    bindings: null,
    children: [],
    layout: null,
  };
}

function nextCodeName(components: IProjectComponent[], prefix: string): string {
  const usedNames = new Set(
    components
      .map((component) => component.codeName?.toLowerCase())
      .filter((name): name is string => name !== undefined),
  );
  let index = 1;

  while (usedNames.has(`${prefix.toLowerCase()}${index}`)) {
    index += 1;
  }

  return `${prefix}${index}`;
}
