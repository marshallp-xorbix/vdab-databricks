import type { ProjectComponent, ProjectComponentsDocument, ProjectJsonObject } from "./project-components-contract.ts";
import { COMPONENT_CODE_NAME_PATTERN, MAX_COMPONENT_COUNT, MAX_COMPONENTS_JSON_BYTES } from "./project-component-validation-constants.ts";
import { hasUnexpectedProperties, isRecord, readChildKeys, readComponentKey, readComponentType, readJsonObject, readNullableText, readPositiveInteger } from "./project-component-json.ts";
import { validateComponentProperties } from "./project-component-properties.ts";
import { validateComponentReferences } from "./project-component-relationships.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import { validateFileUploadBindings } from "./project-component-file-upload.ts";
import { validateDataWindowBindings } from "./project-component-data-window.ts";
import { validateEditableDataWindowBindings } from "./project-component-editable-data-window.ts";
import { validateCartesianChartBindings } from "./project-component-cartesian-chart.ts";
import {
  validateDonutChartBindings,
  validatePieChartBindings,
} from "./project-component-pie-chart.ts";
import { validateAmoebaStoryBindings } from "./project-component-amoeba-story.ts";
import { validateFlowFieldStoryBindings } from "./project-component-flow-field-story.ts";
import { validateHeatMapStoryBindings } from "./project-component-heat-map-story.ts";
import { validateHoneycombStoryBindings } from "./project-component-honeycomb-story.ts";
import { validateNetworkWebStoryBindings } from "./project-component-network-web-story.ts";
import { validatePulseWaveStoryBindings } from "./project-component-pulse-wave-story.ts";
import { validateSpiralStoryBindings } from "./project-component-spiral-story.ts";
import { validateTerrainStoryBindings } from "./project-component-terrain-story.ts";
import { normalizeDashboardEmbedProperties } from "./project-component-dashboard-embed.ts";
import { normalizeGenieChatProperties } from "./project-component-genie-chat.ts";
import { normalizeModelChatProperties } from "./project-component-model-chat.ts";
interface ComponentsInput {
  expectedVersion: number;
  components: ProjectComponent[];
}

export function readComponentsInput(value: unknown): ComponentsInput {
  if (
    !isRecord(value) ||
    hasUnexpectedProperties(value, ["version", "components"]) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1 ||
    !Array.isArray(value.components)
  ) {
    throw invalidComponents();
  }

  if (
    value.components.length > MAX_COMPONENT_COUNT
  ) {
    throw invalidComponents();
  }

  const components = value.components.map(readComponent);
  validateComponentReferences(components);
  const serializedValue = JSON.stringify({
    version: value.version,
    components,
  });

  if (
    serializedValue === undefined ||
    Buffer.byteLength(serializedValue, "utf8") > MAX_COMPONENTS_JSON_BYTES
  ) {
    throw invalidComponents();
  }

  return {
    expectedVersion: value.version as number,
    components,
  };
}

function readComponent(value: unknown): ProjectComponent {
  if (
    !isRecord(value) ||
    hasUnexpectedProperties(value, [
      "key",
      "type",
      "schemaVersion",
      "componentVersion",
      "codeName",
      "description",
      "properties",
      "bindings",
      "children",
      "layout",
    ])
  ) {
    throw invalidComponents();
  }

  const key = readComponentKey(value.key);
  const type = readComponentType(value.type);
  const schemaVersion = readPositiveInteger(value.schemaVersion);
  const componentVersion =
    value.componentVersion === undefined
      ? schemaVersion
      : readPositiveInteger(value.componentVersion);
  const codeName = readNullableText(
    value.codeName,
    COMPONENT_CODE_NAME_PATTERN,
  );
  const description = readNullableText(value.description);
  const rawProperties = readJsonObject(value.properties);
  const properties = type === "DashboardEmbed"
    ? normalizeDashboardEmbedProperties(rawProperties)
    : type === "GenieChat"
    ? normalizeGenieChatProperties(rawProperties)
    : type === "ModelChat"
    ? normalizeModelChatProperties(rawProperties)
    : rawProperties;
  validateComponentProperties(type, properties);
  const bindings =
    value.bindings === undefined || value.bindings === null
      ? null
      : readJsonObject(value.bindings);
  if (type === "FileUpload") {
    validateFileUploadBindings(bindings);
  } else if (type === "DataWindow") {
    validateDataWindowBindings(bindings);
  } else if (type === "EditableDataWindow") {
    validateDataWindowBindings(bindings);
    validateEditableDataWindowBindings(bindings);
  } else if (type === "BarChart" || type === "LineChart") {
    validateDataWindowBindings(bindings);
    validateCartesianChartBindings(bindings, properties, type);
  } else if (type === "PieChart") {
    validateDataWindowBindings(bindings);
    validatePieChartBindings(bindings, properties);
  } else if (type === "DonutChart") {
    validateDataWindowBindings(bindings);
    validateDonutChartBindings(bindings, properties);
  } else if (type === "AmoebaStory") {
    validateDataWindowBindings(bindings);
    validateAmoebaStoryBindings(bindings, properties);
  } else if (type === "FlowFieldStory") {
    validateDataWindowBindings(bindings);
    validateFlowFieldStoryBindings(bindings, properties);
  } else if (type === "HeatMapStory") {
    validateDataWindowBindings(bindings);
    validateHeatMapStoryBindings(bindings, properties);
  } else if (type === "HoneycombStory") {
    validateDataWindowBindings(bindings);
    validateHoneycombStoryBindings(bindings, properties);
  } else if (type === "NetworkWebStory") {
    validateNetworkWebStoryBindings(bindings, properties);
  } else if (type === "PulseWaveStory") {
    validatePulseWaveStoryBindings(bindings, properties);
  } else if (type === "SpiralStory") {
    validateSpiralStoryBindings(bindings, properties);
  } else if (type === "TerrainStory") {
    validateTerrainStoryBindings(bindings, properties);
  }
  const children =
    value.children === undefined ? [] : readChildKeys(value.children);
  const layout =
    value.layout === undefined || value.layout === null
      ? null
      : readJsonObject(value.layout);

  if (
    type === "DashboardEmbed" &&
    (schemaVersion !== 1 ||
      (bindings !== null && Object.keys(bindings).length > 0) ||
      children.length > 0 ||
      layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    type === "GenieChat" &&
    (schemaVersion !== 1 ||
      (bindings !== null && Object.keys(bindings).length > 0) ||
      children.length > 0 ||
      layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    type === "ModelChat" &&
    (schemaVersion !== 1 ||
      (bindings !== null && Object.keys(bindings).length > 0) ||
      children.length > 0 ||
      layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    type === "Expander" &&
    (schemaVersion !== 1 ||
      (bindings !== null && Object.keys(bindings).length > 0) ||
      layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    (type === "FlowFieldStory" || type === "HeatMapStory" || type === "HoneycombStory" || type === "NetworkWebStory" || type === "PulseWaveStory" || type === "SpiralStory" || type === "TerrainStory") &&
    (schemaVersion !== 1 || children.length > 0 || layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    type === "Columns" &&
    (schemaVersion !== 1 ||
      (bindings !== null && Object.keys(bindings).length > 0) ||
      layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    type === "Rows" &&
    (schemaVersion !== 1 ||
      (bindings !== null && Object.keys(bindings).length > 0) ||
      layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    type === "Tabs" &&
    (schemaVersion !== 1 ||
      (bindings !== null && Object.keys(bindings).length > 0) ||
      layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    type === "Form" &&
    (schemaVersion !== 1 ||
      (bindings !== null && Object.keys(bindings).length > 0) ||
      layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    type === "Modal" &&
    (schemaVersion !== 1 ||
      (bindings !== null && Object.keys(bindings).length > 0) ||
      layout !== null)
  ) {
    throw invalidComponents();
  }

  if (
    (type === "BarChart" || type === "LineChart" || type === "PieChart" || type === "DonutChart" || type === "AmoebaStory") &&
    (schemaVersion !== 1 || children.length > 0 || layout !== null)
  ) {
    throw invalidComponents();
  }

  return {
    key,
    type,
    schemaVersion,
    componentVersion,
    codeName,
    description,
    properties,
    bindings,
    children,
    layout,
  };
}
