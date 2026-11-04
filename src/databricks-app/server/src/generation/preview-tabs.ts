import type { ProjectComponent } from "../db/project-components-contract.ts";
import { invalidTabs } from "./preview-errors.ts";
import type { TabsChildPosition, TabsProperties } from "./preview-models.ts";
import { readOptionalNullableNumber } from "./preview-property-utils.ts";
import { isAllowedLayoutControlChild } from "./preview-expander.ts";
import { appendGeneratedControl } from "./preview-component-dispatch.ts";
import { pythonString, uniqueVariableName } from "./preview-python.ts";
import type { WorkflowEventKeys } from "./preview-workflow-runtime.ts";

const MAX_TAB_NAME_LENGTH = 100;
const TABS_PROPERTIES = new Set(["tabs", "defaultTabIndex"]);

/** Reads and validates the supported Tabs properties. */
export function readTabsProperties(component: ProjectComponent): TabsProperties {
  if (component.schemaVersion !== 1) {
    throw invalidTabs("The Tabs schema version is not supported.");
  }

  if (Object.keys(component.properties).some((key) => !TABS_PROPERTIES.has(key))) {
    throw invalidTabs("Tabs contains an unsupported property.");
  }

  if (component.bindings !== null && Object.keys(component.bindings).length > 0) {
    throw invalidTabs("Tabs does not support resource bindings.");
  }

  if (component.layout !== null) {
    throw invalidTabs("Tabs does not support layout settings.");
  }

  const tabsValue = component.properties.tabs;
  if (!Array.isArray(tabsValue)) {
    throw invalidTabs("Tabs requires at least one string label.");
  }

  const tabNames: string[] = [];
  for (const tabValue of tabsValue) {
    if (typeof tabValue !== "string") {
      throw invalidTabs("Tabs labels must be strings.");
    }
    tabNames.push(tabValue);
  }

  if (
    tabNames.length === 0 ||
    tabNames.some((tabName) => tabName.trim() === "" || tabName.trim().length > MAX_TAB_NAME_LENGTH)
  ) {
    throw invalidTabs("Tabs labels must contain 1 to 100 non-empty trimmed characters.");
  }

  const defaultTabIndex = readOptionalNullableNumber(
    component.properties,
    "defaultTabIndex",
    0,
    invalidTabs,
  ) ?? 0;

  if (!Number.isSafeInteger(defaultTabIndex) || defaultTabIndex < 0 || defaultTabIndex >= tabNames.length) {
    throw invalidTabs("The default tab index must identify a configured tab.");
  }

  const defaultTabName = tabNames[defaultTabIndex];
  if (defaultTabName === undefined || tabNames.indexOf(defaultTabName) !== defaultTabIndex) {
    throw invalidTabs("The default tab label must not duplicate an earlier tab label.");
  }

  return { tabNames, defaultTabIndex };
}

/** Reads the pane index and order assigned to a direct tab child. */
export function readTabsChildPosition(
  component: ProjectComponent,
  tabCount: number,
): TabsChildPosition {
  const tabIndex = component.layout?.tabIndex;
  const y = component.layout?.y;
  if (
    typeof tabIndex !== "number" ||
    !Number.isSafeInteger(tabIndex) ||
    tabIndex < 0 ||
    tabIndex >= tabCount ||
    typeof y !== "number" ||
    !Number.isFinite(y)
  ) {
    throw invalidTabs("Each tab child needs a valid pane index and finite position.");
  }

  return { tabIndex, y };
}

/** Emits tabs and validated first-level control children in pane order. */
export function appendTabs(
  lines: string[],
  component: ProjectComponent,
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  workflowEventKeys?: WorkflowEventKeys,
): void {
  const properties = readTabsProperties(component);
  const variableName = uniqueVariableName(
    component,
    componentIndexes.get(component.key) ?? 0,
    usedVariableNames,
  );
  const labels = properties.tabNames.map(pythonString).join(",\n        ");
  lines.push(
    "",
    `${variableName} = st.tabs(`,
    "    [",
    `        ${labels},`,
    "    ],",
    `    default=${pythonString(properties.tabNames[properties.defaultTabIndex] ?? properties.tabNames[0] ?? "Tab 1")},`,
    ")",
  );

  const orderedChildren = component.children.map((childKey, arrayIndex) => {
    const child = componentsByKey.get(childKey);
    const componentIndex = componentIndexes.get(childKey);
    if (child === undefined || componentIndex === undefined) {
      throw invalidTabs("Tab child references must resolve to project components.");
    }

    if (!isAllowedLayoutControlChild(child)) {
      throw invalidTabs("Tabs can contain supported controls but not nested layouts.");
    }

    const position = readTabsChildPosition(child, properties.tabNames.length);
    return { child, componentIndex, arrayIndex, ...position };
  });

  for (let tabIndex = 0; tabIndex < properties.tabNames.length; tabIndex += 1) {
    lines.push("", `with ${variableName}[${tabIndex}]:`);
    const paneChildren = orderedChildren
      .filter((child) => child.tabIndex === tabIndex)
      .sort((left, right) => left.y - right.y || left.arrayIndex - right.arrayIndex);

    if (paneChildren.length === 0) {
      lines.push(`    st.text(${pythonString(properties.tabNames[tabIndex] ?? "Tab")})`);
      continue;
    }

    for (const paneChild of paneChildren) {
      const childLines: string[] = [];
      appendGeneratedControl(
        childLines,
        { ...paneChild.child, layout: null },
        paneChild.componentIndex,
        usedVariableNames,
        workflowEventKeys,
      );
      lines.push(...childLines.map(indentPythonLine));
    }
  }
}

function indentPythonLine(line: string): string {
  return line === "" ? "" : `    ${line}`;
}
