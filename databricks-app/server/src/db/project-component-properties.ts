import type { ProjectComponent, ProjectJsonObject } from "./project-components-contract.ts";
import { validateFileUploadProperties } from "./project-component-file-upload.ts";
import { validateDataWindowProperties } from "./project-component-data-window.ts";
import { validateEditableDataWindowProperties } from "./project-component-editable-data-window.ts";
import { validateCartesianChartProperties } from "./project-component-cartesian-chart.ts";
import {
  validateDonutChartProperties,
  validatePieChartProperties,
} from "./project-component-pie-chart.ts";
import { validateAmoebaStoryProperties } from "./project-component-amoeba-story.ts";
import { validateFlowFieldStoryProperties } from "./project-component-flow-field-story.ts";
import { validateHeatMapStoryProperties } from "./project-component-heat-map-story.ts";
import { validateHoneycombStoryProperties } from "./project-component-honeycomb-story.ts";
import { validateNetworkWebStoryProperties } from "./project-component-network-web-story.ts";
import { validatePulseWaveStoryProperties } from "./project-component-pulse-wave-story.ts";
import { validateSpiralStoryProperties } from "./project-component-spiral-story.ts";
import { validateTerrainStoryProperties } from "./project-component-terrain-story.ts";
import { validateDashboardEmbedProperties } from "./project-component-dashboard-embed.ts";
import { validateGenieChatProperties } from "./project-component-genie-chat.ts";
import { validateModelChatProperties } from "./project-component-model-chat.ts";
import {
  validateDatePickerProperties,
  validateDropdownProperties,
  validateLabelProperties,
  validateSliderProperties,
  validateTimePickerProperties,
} from "./project-component-input-properties.ts";
import {
  validateColumnsProperties,
  validateExpanderProperties,
  validateFormProperties,
  validateModalProperties,
  validateRowsProperties,
  validateTabsProperties,
} from "./project-component-layout-properties.ts";

export { readOptionalNullableNumber } from "./project-component-property-readers.ts";

export function validateComponentProperties(
  type: ProjectComponent["type"],
  properties: ProjectJsonObject,
): void {
  if (type === "DashboardEmbed") {
    validateDashboardEmbedProperties(properties);
  } else if (type === "GenieChat") {
    validateGenieChatProperties(properties);
  } else if (type === "ModelChat") {
    validateModelChatProperties(properties);
  } else if (type === "Dropdown") {
    validateDropdownProperties(properties);
  } else if (type === "DatePicker") {
    validateDatePickerProperties(properties);
  } else if (type === "TimePicker") {
    validateTimePickerProperties(properties);
  } else if (type === "Slider") {
    validateSliderProperties(properties);
  } else if (type === "Label") {
    validateLabelProperties(properties);
  } else if (type === "Expander") {
    validateExpanderProperties(properties);
  } else if (type === "Columns") {
    validateColumnsProperties(properties);
  } else if (type === "Rows") {
    validateRowsProperties(properties);
  } else if (type === "Tabs") {
    validateTabsProperties(properties);
  } else if (type === "Form") {
    validateFormProperties(properties);
  } else if (type === "Modal") {
    validateModalProperties(properties);
  } else if (type === "FileUpload") {
    validateFileUploadProperties(properties);
  } else if (type === "DataWindow") {
    validateDataWindowProperties(properties);
  } else if (type === "EditableDataWindow") {
    validateEditableDataWindowProperties(properties);
  } else if (type === "BarChart" || type === "LineChart") {
    validateCartesianChartProperties(properties, type);
  } else if (type === "PieChart") {
    validatePieChartProperties(properties);
  } else if (type === "DonutChart") {
    validateDonutChartProperties(properties);
  } else if (type === "AmoebaStory") {
    validateAmoebaStoryProperties(properties);
  } else if (type === "FlowFieldStory") {
    validateFlowFieldStoryProperties(properties);
  } else if (type === "HeatMapStory") {
    validateHeatMapStoryProperties(properties);
  } else if (type === "HoneycombStory") {
    validateHoneycombStoryProperties(properties);
  } else if (type === "NetworkWebStory") {
    validateNetworkWebStoryProperties(properties);
  } else if (type === "PulseWaveStory") {
    validatePulseWaveStoryProperties(properties);
  } else if (type === "SpiralStory") {
    validateSpiralStoryProperties(properties);
  } else if (type === "TerrainStory") {
    validateTerrainStoryProperties(properties);
  }
}
