import { FORM_CHILD_COMPONENT_TYPES, LAYOUT_CHILD_COMPONENT_TYPES, MODAL_CHILD_COMPONENT_TYPES, type ProjectComponent } from "./project-components-contract.ts";
import { DEFAULT_LAYOUT_SLOT_COUNT } from "./project-component-validation-constants.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import { readOptionalNullableNumber } from "./project-component-properties.ts";
export function validateComponentReferences(components: ProjectComponent[]): void {
  const componentKeys = new Set<string>();
  const codeNames = new Set<string>();
  const componentsByKey = new Map<string, ProjectComponent>();

  for (const component of components) {
    if (componentKeys.has(component.key)) {
      throw invalidComponents();
    }

    componentKeys.add(component.key);
    componentsByKey.set(component.key, component);

    if (component.codeName) {
      const normalizedCodeName = component.codeName.toLowerCase();

      if (codeNames.has(normalizedCodeName)) {
        throw invalidComponents();
      }

      codeNames.add(normalizedCodeName);
    }
  }

  const parentByKey = new Map<string, string>();

  for (const component of components) {
    const childKeys = new Set<string>();

    for (const childKey of component.children) {
      if (
        !componentKeys.has(childKey) ||
        childKey === component.key ||
        childKeys.has(childKey) ||
        parentByKey.has(childKey)
      ) {
        throw invalidComponents();
      }

      childKeys.add(childKey);
      parentByKey.set(childKey, component.key);

      if (component.type === "Expander") {
        const child = componentsByKey.get(childKey) ??
          components.find((candidate) => candidate.key === childKey);

        if (
          child === undefined ||
          !LAYOUT_CHILD_COMPONENT_TYPES.some((type) => type === child.type) ||
          child.children.length > 0
        ) {
          throw invalidComponents();
        }
      }

      if (component.type === "Columns") {
        const child = componentsByKey.get(childKey);
        const columnCount = readOptionalNullableNumber(
          component.properties,
          "columnCount",
          DEFAULT_LAYOUT_SLOT_COUNT,
        ) ?? DEFAULT_LAYOUT_SLOT_COUNT;

        if (
          child === undefined ||
          !LAYOUT_CHILD_COMPONENT_TYPES.some((type) => type === child.type) ||
          child.children.length > 0 ||
          component.children.length > columnCount
        ) {
          throw invalidComponents();
        }
      }

      if (component.type === "Rows") {
        const child = componentsByKey.get(childKey);
        const rowCount = readOptionalNullableNumber(
          component.properties,
          "rowCount",
          DEFAULT_LAYOUT_SLOT_COUNT,
        ) ?? DEFAULT_LAYOUT_SLOT_COUNT;

        if (
          child === undefined ||
          !LAYOUT_CHILD_COMPONENT_TYPES.some((type) => type === child.type) ||
          child.children.length > 0 ||
          component.children.length > rowCount
        ) {
          throw invalidComponents();
        }
      }

      if (component.type === "Tabs") {
        const child = componentsByKey.get(childKey);
        const tabNames = component.properties.tabs;
        const tabIndex = child?.layout?.tabIndex;
        const position = child?.layout?.y;

        if (
          child === undefined ||
          !LAYOUT_CHILD_COMPONENT_TYPES.some((type) => type === child.type) ||
          child.children.length > 0 ||
          !Array.isArray(tabNames) ||
          typeof tabIndex !== "number" ||
          !Number.isSafeInteger(tabIndex) ||
          tabIndex < 0 ||
          tabIndex >= tabNames.length ||
          typeof position !== "number" ||
          !Number.isFinite(position)
        ) {
          throw invalidComponents();
        }
      }

      if (component.type === "Form") {
        const child = componentsByKey.get(childKey);

        if (
          child === undefined ||
          !FORM_CHILD_COMPONENT_TYPES.some((type) => type === child.type) ||
          child.children.length > 0
        ) {
          throw invalidComponents();
        }
      }

      if (component.type === "Modal") {
        const child = componentsByKey.get(childKey);

        if (
          child === undefined ||
          !MODAL_CHILD_COMPONENT_TYPES.some((type) => type === child.type) ||
          (!isLayoutParent(child) && child.children.length > 0) ||
          (child.layout !== null &&
            child.layout.y !== undefined &&
            (typeof child.layout.y !== "number" ||
              !Number.isFinite(child.layout.y) ||
              child.layout.y < 0))
        ) {
          throw invalidComponents();
        }
      }
    }
  }

  for (const component of components) {
    if (
      (component.type === "Expander" ||
        component.type === "Columns" ||
        component.type === "Rows" ||
        component.type === "Tabs" ||
        component.type === "Form" ||
        component.type === "Modal") &&
      parentByKey.has(component.key) &&
      (component.type === "Modal" ||
        componentsByKey.get(parentByKey.get(component.key) ?? "")?.type !== "Modal")
    ) {
      throw invalidComponents();
    }
  }

  for (const component of components) {
    const ancestry = new Set<string>([component.key]);
    let parentKey = parentByKey.get(component.key);

    while (parentKey !== undefined) {
      if (ancestry.has(parentKey)) {
        throw invalidComponents();
      }

      ancestry.add(parentKey);
      parentKey = parentByKey.get(parentKey);
    }
  }
}

function isLayoutParent(component: ProjectComponent): boolean {
  return component.type === "Expander" ||
    component.type === "Columns" ||
    component.type === "Rows" ||
    component.type === "Tabs" ||
    component.type === "Form";
}
