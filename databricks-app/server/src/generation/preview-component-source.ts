import type { ProjectComponent } from "../db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../db/project-workflow-contract.ts";
import { appendWorkflowRuntime } from "./preview-workflow-runtime.ts";
import { invalidComponentTree } from "./preview-errors.ts";
import { appendGeneratedControl } from "./preview-component-dispatch.ts";
import { appendColumns } from "./preview-columns.ts";
import { appendRows } from "./preview-rows.ts";
import { appendTabs } from "./preview-tabs.ts";
import { appendForm } from "./preview-form.ts";
import {
  appendExpanderChildren,
  appendExpanderStart,
  readExpanderProperties,
} from "./preview-expander.ts";
import { appendModal } from "./preview-modal.ts";
import { buildPreviewComponentTree } from "./preview-component-tree.ts";
import { pythonString } from "./preview-python.ts";
import { appendFileUploadHelpers } from "./preview-file-upload-helpers.ts";
import { appendNoRedirectHttpHelpers } from "./preview-no-redirect-http.ts";
import { appendGenieChatHelpers } from "./preview-genie-chat-helpers.ts";
import { appendModelChatHelpers } from "./preview-model-chat-helpers.ts";
import { appendRadialChartHelpers } from "./preview-pie-chart.ts";
import {
  appendDataWindowHelpers,
  appendDataWindowReadHelpers,
} from "./preview-data-window-helpers.ts";
import { appendLakebaseHelpers, projectUsesLakebase } from "./preview-lakebase-helpers.ts";

/** Builds the complete deterministic preview source for a project. */
export function generateProjectSource(
  projectName: string,
  components: ProjectComponent[],
  workflow: ProjectWorkflowDefinition = { version: 1, workflows: [] },
): string {
  const imports = new Set(["import streamlit as st"]);
  const usesLakebase = projectUsesLakebase(components, workflow);
  if (usesLakebase) {
    imports.add("import asyncio");
    imports.add("import asyncpg");
  }
  if (components.some((component) => component.type === "Label" || component.type === "ModelChat")) {
    imports.add("import html");
  }
  if (components.some((component) => component.type === "DashboardEmbed" || component.type === "AmoebaStory" || component.type === "FlowFieldStory" || component.type === "HeatMapStory" || component.type === "HoneycombStory" || component.type === "NetworkWebStory" || component.type === "PulseWaveStory" || component.type === "SpiralStory" || component.type === "TerrainStory")) {
    imports.add("import streamlit.components.v1 as components");
  }
  if (components.some((component) => component.type === "DashboardEmbed")) {
    imports.add("import os");
    imports.add("import urllib.parse");
  }
  if (components.some((component) => component.type === "GenieChat")) {
    for (const sourceImport of [
      "import json",
      "import os",
      "import pandas as pd",
      "import re",
      "import time",
      "import urllib.error",
      "import urllib.parse",
      "import urllib.request",
    ]) {
      imports.add(sourceImport);
    }
  }
  if (components.some((component) => component.type === "ModelChat")) {
    for (const sourceImport of [
      "import json",
      "import os",
      "import urllib.error",
      "import urllib.parse",
      "import urllib.request",
    ]) {
      imports.add(sourceImport);
    }
  }
  if (workflow.workflows.length > 0) {
    for (const sourceImport of [
      "import inspect",
      "import json",
      "import math",
      "import os",
      "import pandas as pd",
      "import re",
      "import urllib.error",
      "import urllib.parse",
      "import urllib.request",
    ]) {
      imports.add(sourceImport);
    }
  }
  const workflowNodes = workflow.workflows.flatMap((definition) => definition.nodes);
  if (workflowNodes.some((node) => node.actionType === "callCustomModule")) {
    imports.add("import custom_modules");
  }
  if (workflowNodes.some((node) => node.actionType === "callPrebuiltModule")) {
    imports.add("import prebuilt_modules_library");
  }
  if (components.some((component) => component.type === "FileUpload")) {
    for (const sourceImport of [
      "import hashlib",
      "import os",
      "import re",
      "import urllib.error",
      "import urllib.parse",
      "import urllib.request",
    ]) {
      imports.add(sourceImport);
    }
  }
  if (components.some((component) => component.type === "PieChart" || component.type === "DonutChart" || component.type === "FlowFieldStory" || component.type === "HeatMapStory" || component.type === "HoneycombStory" || component.type === "NetworkWebStory" || component.type === "PulseWaveStory" || component.type === "SpiralStory" || component.type === "TerrainStory")) {
    imports.add("import math");
  }
  if (components.some((component) => component.type === "DataWindow" || component.type === "EditableDataWindow" || component.type === "BarChart" || component.type === "LineChart" || component.type === "PieChart" || component.type === "DonutChart" || component.type === "AmoebaStory" || component.type === "FlowFieldStory" || component.type === "HeatMapStory" || component.type === "HoneycombStory" || component.type === "NetworkWebStory" || component.type === "PulseWaveStory" || component.type === "SpiralStory" || component.type === "TerrainStory")) {
    for (const sourceImport of [
      "import json",
      "import os",
      "import pandas as pd",
      "import re",
      "import time",
      "import urllib.error",
      "import urllib.parse",
      "import urllib.request",
    ]) {
      imports.add(sourceImport);
    }
  }

  const lines = [
    ...imports,
    "",
    `st.set_page_config(page_title=${pythonString(projectName)}, layout='wide')`,
    `st.title(${pythonString(projectName)})`,
    "",
    workflow.workflows.length > 0
      ? "ui_overrides = st.session_state.setdefault('ui_overrides', {'labels': {}})"
      : "ui_overrides = {'labels': {}}",
  ];
  const workflowEventKeys = workflow.workflows.length > 0
    ? appendWorkflowRuntime(lines, workflow, components)
    : undefined;
  if (workflow.workflows.length > 0) {
    lines.push("");
  }
  const workflowActions = workflow.workflows.flatMap((definition) => definition.nodes);
  const workflowUsesSql = workflowActions.some((node) =>
    node.actionType === "runSql" || node.actionType === "saveToTable",
  );
  const workflowNeedsWriteSql = workflowActions.some((node) =>
    node.actionType === "saveToTable",
  );
  const componentsUseDataHelpers = components.some((component) => component.type === "DataWindow" || component.type === "EditableDataWindow" || component.type === "BarChart" || component.type === "LineChart" || component.type === "PieChart" || component.type === "DonutChart" || component.type === "AmoebaStory" || component.type === "FlowFieldStory" || component.type === "HeatMapStory" || component.type === "HoneycombStory" || component.type === "NetworkWebStory" || component.type === "PulseWaveStory" || component.type === "SpiralStory" || component.type === "TerrainStory");
  const hasFileUpload = components.some((component) => component.type === "FileUpload");
  if (hasFileUpload || componentsUseDataHelpers || workflowUsesSql) {
    appendNoRedirectHttpHelpers(lines);
  }
  if (hasFileUpload) {
    appendFileUploadHelpers(lines);
  }
  if (components.some((component) => component.type === "GenieChat")) {
    appendGenieChatHelpers(lines);
  }
  if (components.some((component) => component.type === "ModelChat")) {
    appendModelChatHelpers(lines);
  }
  const componentsNeedWriteDataHelpers = components.some(
    (component) => component.type === "EditableDataWindow",
  );
  if (componentsUseDataHelpers) {
    if (componentsNeedWriteDataHelpers || workflowNeedsWriteSql) {
      appendDataWindowHelpers(lines);
    } else {
      appendDataWindowReadHelpers(lines);
    }
  } else if (workflowUsesSql) {
    if (workflowNeedsWriteSql) {
      appendDataWindowHelpers(lines);
    } else {
      appendDataWindowReadHelpers(lines);
    }
  }
  if (usesLakebase) {
    appendLakebaseHelpers(lines);
  }
  if (components.some((component) => component.type === "PieChart" || component.type === "DonutChart")) {
    appendRadialChartHelpers(lines);
  }
  const componentTree = buildPreviewComponentTree(components);
  const componentIndexes = new Map(
    components.map((component, index) => [component.key, index]),
  );
  const usedVariableNames = new Set<string>();
  appendModalDefinitions(
    lines,
    componentTree.rootComponents,
    componentTree.componentsByKey,
    componentIndexes,
    usedVariableNames,
    (childLines, child) => appendProjectComponent(
      childLines,
      child,
      componentTree.componentsByKey,
      componentIndexes,
      usedVariableNames,
      workflowEventKeys,
    ),
  );
  if (workflowEventKeys !== undefined) {
    lines.push("_vdab_flush_pending_modal()", "");
  }
  appendRootComponents(
    lines,
    componentTree.rootComponents,
    componentTree.componentsByKey,
    componentIndexes,
    usedVariableNames,
    workflowEventKeys,
  );

  if (workflowEventKeys !== undefined) {
    lines.push("", "_vdab_flush_pending_modal()", "_vdab_flush_toasts()", "");
  }

  return `${lines.join("\n")}\n`;
}

function appendModalDefinitions(
  lines: string[],
  roots: ProjectComponent[],
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  appendChildSource: (lines: string[], child: ProjectComponent) => void,
): void {
  const modals = roots
    .filter((component) => component.type === "Modal")
    .sort((left, right) => (left.codeName ?? "").localeCompare(right.codeName ?? ""));

  for (const modal of modals) {
    appendModal(
      lines,
      modal,
      componentIndexes.get(modal.key) ?? 0,
      componentsByKey,
      componentIndexes,
      usedVariableNames,
      appendChildSource,
    );
    lines.push("");
  }
}

function appendRootComponents(
  lines: string[],
  roots: ProjectComponent[],
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  workflowEventKeys?: ReadonlyMap<string, string>,
): void {
  for (const component of roots) {
    if (component.type === "Modal") {
      continue;
    }

    appendProjectComponent(
      lines,
      component,
      componentsByKey,
      componentIndexes,
      usedVariableNames,
      workflowEventKeys,
    );
  }
}

function appendProjectComponent(
  lines: string[],
  component: ProjectComponent,
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  workflowEventKeys?: ReadonlyMap<string, string>,
): void {
  const componentIndex = componentIndexes.get(component.key) ?? 0;

  if (component.type === "Expander") {
    appendExpanderStart(lines, readExpanderProperties(component));
    appendExpanderChildren(
      lines,
      component,
      componentsByKey,
      componentIndexes,
      usedVariableNames,
      workflowEventKeys,
    );
    return;
  }

  if (component.type === "Columns") {
    appendColumns(lines, component, componentsByKey, componentIndexes, usedVariableNames, workflowEventKeys);
  } else if (component.type === "Rows") {
    appendRows(lines, component, componentsByKey, componentIndexes, usedVariableNames, workflowEventKeys);
  } else if (component.type === "Tabs") {
    appendTabs(lines, component, componentsByKey, componentIndexes, usedVariableNames, workflowEventKeys);
  } else if (component.type === "Form") {
    appendForm(lines, component, componentsByKey, componentIndexes, usedVariableNames, workflowEventKeys);
  } else if (component.type === "Modal") {
    throw invalidComponentTree("Modal dialogs cannot be nested.");
  } else {
    appendGeneratedControl(lines, component, componentIndex, usedVariableNames, workflowEventKeys);
  }
}
