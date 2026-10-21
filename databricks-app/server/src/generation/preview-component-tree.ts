import type { ProjectComponent } from "../db/project-components-contract.ts";
import { invalidComponentTree } from "./preview-errors.ts";
import { readColumnsProperties } from "./preview-columns.ts";
import { readRowsProperties } from "./preview-rows.ts";
import { readTabsChildPosition, readTabsProperties } from "./preview-tabs.ts";
import { isAllowedFormChild } from "./preview-form.ts";
import { isAllowedLayoutControlChild } from "./preview-expander.ts";
import { readModalProperties } from "./preview-modal.ts";

export interface PreviewComponentTree {
  rootComponents: ProjectComponent[];
  componentsByKey: Map<string, ProjectComponent>;
  parentByKey: Map<string, string>;
}

/** Validates component relationships and returns the ordered top-level nodes. */
export function buildPreviewComponentTree(
  components: ProjectComponent[],
): PreviewComponentTree {
  const componentsByKey = new Map<string, ProjectComponent>();
  const parentByKey = new Map<string, string>();

  for (const component of components) {
    if (componentsByKey.has(component.key)) {
      throw invalidComponentTree("Component keys must be unique in a preview.");
    }

    componentsByKey.set(component.key, component);
  }

  for (const component of components) {
    if (
      component.type !== "Expander" &&
      component.type !== "Columns" &&
      component.type !== "Rows" &&
      component.type !== "Tabs" &&
      component.type !== "Form" &&
      component.type !== "Modal"
    ) {
      continue;
    }

    if (component.type === "Columns") {
      readColumnsProperties(component);
    }

    if (component.type === "Rows") {
      readRowsProperties(component);
    }

    if (component.type === "Modal") {
      readModalProperties(component);
    }

    const tabCount = component.type === "Tabs"
      ? readTabsProperties(component).tabNames.length
      : null;

    const childKeys = new Set<string>();

    for (const childKey of component.children) {
      const child = componentsByKey.get(childKey);

      if (
        child === undefined ||
        childKey === component.key ||
        childKeys.has(childKey) ||
        parentByKey.has(childKey)
      ) {
        throw invalidComponentTree("Child references must resolve to one unique parent.");
      }

      const isAllowedChild = component.type === "Form"
        ? isAllowedFormChild(child)
        : component.type === "Modal"
        ? isAllowedModalChild(child)
        : isAllowedLayoutControlChild(child);

      if (!isAllowedChild) {
        throw invalidComponentTree(
          "Supported layout containers can contain only supported first-level controls.",
        );
      }

      if (tabCount !== null) {
        readTabsChildPosition(child, tabCount);
      }

      childKeys.add(childKey);
      parentByKey.set(childKey, component.key);
    }
  }

  for (const component of components) {
    if (
      (component.type === "Expander" ||
        component.type === "Columns" ||
        component.type === "Rows" ||
        component.type === "Tabs" ||
        component.type === "Form") &&
      parentByKey.has(component.key) &&
      componentsByKey.get(parentByKey.get(component.key) ?? "")?.type !== "Modal"
    ) {
      throw invalidComponentTree("Layout containers cannot be nested in this preview slice.");
    }

    if (component.type === "Modal" && parentByKey.has(component.key)) {
      throw invalidComponentTree("Modal dialogs cannot be nested.");
    }

    assertAcyclic(component.key, parentByKey);
  }

  return {
    rootComponents: components.filter((component) => !parentByKey.has(component.key)),
    componentsByKey,
    parentByKey,
  };
}

function isAllowedModalChild(component: ProjectComponent): boolean {
  return isAllowedLayoutControlChild(component) ||
    component.type === "Expander" ||
    component.type === "Columns" ||
    component.type === "Rows" ||
    component.type === "Tabs" ||
    component.type === "Form";
}

function assertAcyclic(
  componentKey: string,
  parentByKey: Map<string, string>,
): void {
  const visited = new Set([componentKey]);
  let parentKey = parentByKey.get(componentKey);

  while (parentKey !== undefined) {
    if (visited.has(parentKey)) {
      throw invalidComponentTree("Component nesting cannot contain a cycle.");
    }

    visited.add(parentKey);
    parentKey = parentByKey.get(parentKey);
  }
}
