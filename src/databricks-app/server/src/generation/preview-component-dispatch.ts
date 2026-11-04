import type { ProjectComponent } from "../db/project-components-contract.ts";
import { invalidComponentTree } from "./preview-errors.ts";
import {
  appendBooleanControl,
  appendButton,
  appendDatePicker,
  appendDropdown,
  appendLabel,
  appendSlider,
  appendTextInput,
  appendTimePicker,
} from "./preview-component-renderers.ts";
import {
  readBooleanControlProperties,
  readButtonProperties,
  readDropdownProperties,
  readTextInputProperties,
} from "./preview-simple-properties.ts";
import { readDatePickerProperties, readTimePickerProperties } from "./preview-date-time-properties.ts";
import { readLabelProperties, readSliderProperties } from "./preview-range-properties.ts";
import { appendFileUpload } from "./preview-file-upload.ts";
import { appendDataWindow } from "./preview-data-window.ts";
import { appendEditableDataWindow } from "./preview-editable-data-window.ts";
import { appendCartesianChart } from "./preview-cartesian-chart.ts";
import { appendDonutChart, appendPieChart } from "./preview-pie-chart.ts";
import { appendAmoebaStory } from "./preview-amoeba-story.ts";
import { appendFlowFieldStory } from "./preview-flow-field-story.ts";
import { appendHeatMapStory } from "./preview-heat-map-story.ts";
import { appendHoneycombStory } from "./preview-honeycomb-story.ts";
import { appendNetworkWebStory } from "./preview-network-web-story.ts";
import { appendPulseWaveStory } from "./preview-pulse-wave-story.ts";
import { appendSpiralStory } from "./preview-spiral-story.ts";
import { appendTerrainStory } from "./preview-terrain-story.ts";
import { appendDashboardEmbed } from "./preview-dashboard-embed.ts";
import { appendGenieChat } from "./preview-genie-chat.ts";
import { appendModelChat } from "./preview-model-chat.ts";
import { uniqueVariableName } from "./preview-python.ts";
import {
  appendWorkflowComponentRegistration,
  type WorkflowEventKeys,
} from "./preview-workflow-runtime.ts";

/** Appends a supported control and keeps its generated key unique. */
export function appendGeneratedControl(
  lines: string[],
  component: ProjectComponent,
  componentIndex: number,
  usedVariableNames: Set<string>,
  workflowEventKeys?: WorkflowEventKeys,
  allowEventCallbacks = true,
): void {
  const variableName = uniqueVariableName(component, componentIndex, usedVariableNames);
  const workflowEventKey = allowEventCallbacks
    ? workflowEventKeys?.get(component.key)
    : undefined;
  if (workflowEventKeys !== undefined) {
    const widgetKey = component.type === "FileUpload"
      ? `${variableName}_uploader`
      : component.type === "EditableDataWindow"
      ? component.key
      : variableName;
    appendWorkflowComponentRegistration(lines, component, widgetKey);
  }

  switch (component.type) {
    case "DashboardEmbed":
      appendDashboardEmbed(lines, component);
      return;
    case "GenieChat":
      appendGenieChat(lines, component, variableName);
      return;
    case "ModelChat":
      appendModelChat(lines, component, variableName);
      return;
    case "TextInput":
      appendTextInput(lines, component, readTextInputProperties(component.properties), variableName, workflowEventKey);
      return;
    case "Button":
      appendButton(lines, component, readButtonProperties(component.properties), variableName, workflowEventKey);
      return;
    case "Checkbox":
    case "Toggle":
      appendBooleanControl(
        lines,
        component,
        readBooleanControlProperties(component.properties, component.type),
        variableName,
        component.type,
        workflowEventKey,
      );
      return;
    case "Dropdown":
      appendDropdown(lines, component, readDropdownProperties(component.properties), variableName, workflowEventKey);
      return;
    case "DatePicker":
      appendDatePicker(lines, component, readDatePickerProperties(component.properties), variableName, workflowEventKey);
      return;
    case "TimePicker":
      appendTimePicker(lines, component, readTimePickerProperties(component.properties), variableName, workflowEventKey);
      return;
    case "Slider":
      appendSlider(lines, component, readSliderProperties(component.properties), variableName, workflowEventKey);
      return;
    case "Label":
      appendLabel(lines, component, readLabelProperties(component.properties), variableName);
      return;
    case "FileUpload":
      appendFileUpload(lines, component, variableName, workflowEventKey);
      return;
    case "DataWindow":
      appendDataWindow(lines, component, variableName, workflowEventKeys !== undefined);
      return;
    case "EditableDataWindow":
      appendEditableDataWindow(
        lines,
        component,
        variableName,
        workflowEventKey,
        workflowEventKeys !== undefined,
      );
      return;
    case "BarChart":
    case "LineChart":
      appendCartesianChart(lines, component, variableName, workflowEventKeys !== undefined);
      return;
    case "PieChart":
      appendPieChart(lines, component, variableName, workflowEventKeys !== undefined);
      return;
    case "DonutChart":
      appendDonutChart(lines, component, variableName, workflowEventKeys !== undefined);
      return;
    case "AmoebaStory":
      appendAmoebaStory(lines, component, variableName);
      return;
    case "FlowFieldStory":
      appendFlowFieldStory(lines, component, variableName);
      return;
    case "HeatMapStory":
      appendHeatMapStory(lines, component, variableName);
      return;
    case "HoneycombStory":
      appendHoneycombStory(lines, component, variableName);
      return;
    case "NetworkWebStory":
      appendNetworkWebStory(lines, component, variableName);
      return;
    case "PulseWaveStory":
      appendPulseWaveStory(lines, component, variableName);
      return;
    case "SpiralStory":
      appendSpiralStory(lines, component, variableName);
      return;
    case "TerrainStory":
      appendTerrainStory(lines, component, variableName);
      return;
    default:
      throw invalidComponentTree(`No preview renderer exists for ${component.type}.`);
  }
}
