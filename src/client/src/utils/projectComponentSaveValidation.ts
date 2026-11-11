import type { IProjectComponent } from "../models/ProjectComponents";
import {
  FORM_CHILD_TYPES,
  LAYOUT_CHILD_TYPES,
  MODAL_CHILD_TYPES,
} from "./projectComponentFactory";

const DEFAULT_LAYOUT_SLOT_COUNT = 2;

/**
 * Client-side integrity checks for Columns/Rows/Form/Tabs/Modal before save.
 * Mirrors server `validateComponentReferences` rules for layout parents.
 */
export function validateProjectComponentsForSave(
  components: readonly IProjectComponent[],
): void {
  const byKey = new Map(components.map((component) => [component.key, component]));
  for (const component of components) {
    for (const childKey of component.children) {
      const child = byKey.get(childKey);
      if (!child) {
        throw new Error(
          `Save blocked: ${component.type} "${component.codeName || component.key}" references missing child "${childKey}".`,
        );
      }

      if (component.type === "Columns") {
        const columnCount = readSlotCount(component.properties.columnCount);
        if (
          !LAYOUT_CHILD_TYPES.some((type) => type === child.type) ||
          child.children.length > 0 ||
          component.children.length > columnCount
        ) {
          throw new Error(
            `Save blocked: Columns "${component.codeName || component.key}" only accept up to ${columnCount} layout controls without nested children.`,
          );
        }
      }

      if (component.type === "Rows") {
        const rowCount = readSlotCount(component.properties.rowCount);
        if (
          !LAYOUT_CHILD_TYPES.some((type) => type === child.type) ||
          child.children.length > 0 ||
          component.children.length > rowCount
        ) {
          throw new Error(
            `Save blocked: Rows "${component.codeName || component.key}" only accept up to ${rowCount} layout controls without nested children.`,
          );
        }
      }

      if (component.type === "Form") {
        if (
          !FORM_CHILD_TYPES.some((type) => type === child.type) ||
          child.children.length > 0
        ) {
          throw new Error(
            `Save blocked: Form "${component.codeName || component.key}" only accepts form controls without nested children.`,
          );
        }
      }

      if (component.type === "Tabs") {
        const tabNames = component.properties.tabs;
        const tabIndex = child.layout?.tabIndex;
        const position = child.layout?.y;
        if (
          !LAYOUT_CHILD_TYPES.some((type) => type === child.type) ||
          child.children.length > 0 ||
          !Array.isArray(tabNames) ||
          typeof tabIndex !== "number" ||
          !Number.isSafeInteger(tabIndex) ||
          tabIndex < 0 ||
          tabIndex >= tabNames.length ||
          typeof position !== "number" ||
          !Number.isFinite(position)
        ) {
          throw new Error(
            `Save blocked: Tabs child "${child.codeName || child.key}" must be a layout control with numeric tabIndex and y.`,
          );
        }
      }

      if (component.type === "Modal") {
        const isLayoutParent =
          child.type === "Expander" ||
          child.type === "Columns" ||
          child.type === "Rows" ||
          child.type === "Tabs" ||
          child.type === "Form";
        if (
          !MODAL_CHILD_TYPES.some((type) => type === child.type) ||
          (!isLayoutParent && child.children.length > 0) ||
          (child.layout !== null &&
            child.layout.y !== undefined &&
            (typeof child.layout.y !== "number" ||
              !Number.isFinite(child.layout.y) ||
              child.layout.y < 0))
        ) {
          throw new Error(
            `Save blocked: Modal "${component.codeName || component.key}" has an invalid child "${child.codeName || child.key}".`,
          );
        }
      }
    }
  }
}

function readSlotCount(value: unknown): number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
    ? value
    : DEFAULT_LAYOUT_SLOT_COUNT;
}
