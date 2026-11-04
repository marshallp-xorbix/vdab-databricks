/**
 * Utility functions for handling component layout positioning
 */

import type { VdabComponent } from "../types/components";
import { ComponentType } from "../types/components/componentTypes";
import { getChartValueAxisSaveValidationError } from "./charts/chartValueAxisValidation";

/**
 * Parse layout JSON and return the y position
 */
export function getLayoutY(layout?: string): number {
  if (!layout) return Number.MAX_SAFE_INTEGER;
  try {
    const parsed = JSON.parse(layout);
    return parsed.y ?? Number.MAX_SAFE_INTEGER;
  } catch {
    console.warn("Failed to parse layout JSON:", layout);
    return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * Create layout JSON string from y position
 */
export function createLayout(y: number): string {
  return JSON.stringify({ y });
}

/**
 * Create layout JSON string for a child inside a Tabs pane
 */
export function createTabChildLayout(tabIndex: number, y: number): string {
  return JSON.stringify({ tabIndex, y });
}

/**
 * Parse layout JSON and return the tabIndex (undefined if not a tab child)
 */
export function getLayoutTabIndex(layout?: string): number | undefined {
  if (!layout) return undefined;
  try {
    const parsed = JSON.parse(layout);
    return typeof parsed.tabIndex === "number" ? parsed.tabIndex : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sort components by their layout y position
 */
export function sortComponentsByLayout(
  components: VdabComponent[],
): VdabComponent[] {
  return [...components].sort((a, b) => {
    const aY = getLayoutY(a.layout);
    const bY = getLayoutY(b.layout);
    return aY - bY;
  });
}

/**
 * Get the next y position for a new component in a context
 */
export function getNextLayoutY(components: VdabComponent[]): number {
  const topLevelComponents = getTopLevelComponents(components);
  if (topLevelComponents.length === 0) return 0;

  const maxY = Math.max(
    ...topLevelComponents.map((comp) => getLayoutY(comp.layout)),
  );
  // If all components have MAX_SAFE_INTEGER (no layout), start from 0
  // Otherwise, add 1 to the max
  return maxY === Number.MAX_SAFE_INTEGER ? 0 : maxY + 1;
}

/**
 * Collect child component IDs within a context
 */
export function getChildIdsInContext(components: VdabComponent[]): Set<string> {
  const childIds = new Set<string>();
  components.forEach((component) => {
    component.children?.forEach((childId) => {
      if (childId && childId.trim()) {
        childIds.add(childId);
      }
    });
  });
  return childIds;
}

/**
 * Get top-level components within a context (not referenced as children)
 */
export function getTopLevelComponents(
  components: VdabComponent[],
): VdabComponent[] {
  const childIds = getChildIdsInContext(components);
  return components.filter(
    (component) =>
      !childIds.has(component.id) && component.type !== ComponentType.Modal,
  );
}

/**
 * Assign layout to a component based on its context
 */
export function assignLayoutToComponent(
  component: VdabComponent,
  contextComponents: VdabComponent[],
): VdabComponent {
  // Modals don't get layout
  if (component.type === ComponentType.Modal) {
    return { ...component, layout: undefined };
  }

  if (component.layout) {
    return component;
  }

  const nextY = getNextLayoutY(contextComponents);
  return {
    ...component,
    layout: createLayout(nextY),
  };
}

export function applyTopLevelLayoutOrder(
  components: VdabComponent[],
  orderedIds: string[],
): VdabComponent[] {
  const updatedLayouts = new Map<string, string>();
  orderedIds.forEach((id, index) => {
    updatedLayouts.set(id, createLayout(index));
  });

  return components.map((component) =>
    updatedLayouts.has(component.id)
      ? { ...component, layout: updatedLayouts.get(component.id) }
      : component,
  );
}

export function validateTabsChildLayouts(
  components: VdabComponent[],
): string[] {
  const errors: string[] = [];
  const componentById = new Map(
    components.map((component) => [component.id, component]),
  );

  components
    .filter((component) => component.type === ComponentType.Tabs)
    .forEach((tabsComponent) => {
      const childIds = tabsComponent.children ?? [];

      childIds.forEach((childId) => {
        const childComponent = componentById.get(childId);
        if (!childComponent) {
          return;
        }

        if (!childComponent.layout) {
          errors.push(
            `Tabs child '${childId}' under '${tabsComponent.id}' must define layout with tabIndex and y.`,
          );
          return;
        }

        try {
          const parsedLayout = JSON.parse(childComponent.layout);
          const hasValidTabIndex =
            typeof parsedLayout?.tabIndex === "number" &&
            Number.isFinite(parsedLayout.tabIndex);
          const hasValidY =
            typeof parsedLayout?.y === "number" &&
            Number.isFinite(parsedLayout.y);

          if (!hasValidTabIndex || !hasValidY) {
            errors.push(
              `Tabs child '${childId}' under '${tabsComponent.id}' must define numeric tabIndex and y in layout.`,
            );
          }
        } catch {
          errors.push(
            `Tabs child '${childId}' under '${tabsComponent.id}' has invalid layout JSON.`,
          );
        }
      });
    });

  return errors;
}

/**
 * Validates components before save and throws on the first integrity issue found.
 *
 * Enforces Tabs child layout integrity (each Tabs child must have numeric
 * `tabIndex` and `y` fields) and chart value-axis rules (line/bar Y, pie/donut
 * Value) when column metadata is available. Rows/Columns slot occupancy and Form
 * layout ordering are not yet validated here.
 */
export function validateComponentsForSave(
  components: VdabComponent[],
): void {
  const tabsLayoutErrors = validateTabsChildLayouts(components);
  if (tabsLayoutErrors.length > 0) {
    throw new Error(
      `Save blocked due to invalid Tabs child layout: ${tabsLayoutErrors[0]}`,
    );
  }

  for (const c of components) {
    const chartErr = getChartValueAxisSaveValidationError(c);
    if (chartErr) {
      throw new Error(`Save blocked: ${chartErr}`);
    }
  }
}
