import type { IComponentDefinition } from "../models/ComponentRegistry";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { VdabComponent } from "../types/components/vdabComponent";
import { ComponentCategory } from "../types/components/componentTypes";
import type { MoveComponentTarget } from "./componentMoveUtils";
import { moveComponentInContexts } from "./componentMoveUtils";
import type { AddComponentOptions } from "../types/components/componentOperations";
import {
  createProjectComponent,
  PROJECT_COMPONENT_ADD_TYPES,
  type ProjectComponentAddType,
} from "./projectComponentFactory";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import { CanvasContextType, getCurrentPageContextKey, getModalContextKey } from "../types/editor";
import { getComponentsForContext } from "./componentOrganization";

const LAYOUT_COMPONENT_TYPES = new Set([
  "Columns",
  "Rows",
  "Form",
  "Modal",
  "Tabs",
  "Expander",
]);

/** Adapts durable project components to the retained VDAB canvas renderer model. */
export function toCanvasComponents(
  components: IProjectComponent[],
  definitions: IComponentDefinition[],
): VdabComponent[] {
  const definitionsByType = new Map(
    definitions.map((definition) => [definition.type, definition]),
  );

  return components.map((component) => {
    const definition = definitionsByType.get(component.type);
    return {
      id: component.key,
      codeName: component.codeName ?? component.key,
      type: component.type as VdabComponent["type"],
      category:
        definition?.category ??
        (LAYOUT_COMPONENT_TYPES.has(component.type)
          ? ComponentCategory.Layout
          : ComponentCategory.Controls),
      icon: definition?.icon,
      props: component.properties,
      bindings: component.bindings as VdabComponent["bindings"],
      supportedBindings: definition?.supportedBindings ?? undefined,
      supportedEvents: definition?.supportedEvents ?? undefined,
      children: component.children,
      schemaVersion: component.schemaVersion,
      layout: component.layout ? JSON.stringify(component.layout) : undefined,
    };
  });
}

/** Applies the retained SaaS canvas move operation to the standalone component tree. */
export function moveProjectComponentInLegacyCanvas(
  components: IProjectComponent[],
  canvasComponents: VdabComponent[],
  componentKey: string,
  target: MoveComponentTarget,
  contextType: CanvasContextType,
  modalId?: string,
): IProjectComponent[] {
  const modalRoot =
    contextType === CanvasContextType.Modal && modalId
      ? components.find((component) => component.key === modalId)
      : undefined;
  const modalRootParent = components.find((component) =>
    component.children.includes(componentKey),
  );
  if (
    modalRoot &&
    modalRootParent?.key === modalId &&
    !target.parentId
  ) {
    const orderedChildren = [...modalRoot.children].filter((key) =>
      components.some((component) => component.key === key),
    );
    const sourceIndex = orderedChildren.indexOf(componentKey);
    if (sourceIndex < 0) return components;
    orderedChildren.splice(sourceIndex, 1);
    const targetIndex = Math.max(
      0,
      Math.min(target.childIndex ?? orderedChildren.length, orderedChildren.length),
    );
    orderedChildren.splice(targetIndex, 0, componentKey);
    const positions = new Map(
      orderedChildren.map((key, index) => [key, index]),
    );
    return components.map((component) => {
      if (component.key === modalId) {
        return { ...component, children: orderedChildren };
      }
      const position = positions.get(component.key);
      return position === undefined
        ? component
        : { ...component, layout: { ...(component.layout ?? {}), y: position } };
    });
  }

  const contextKey =
    contextType === CanvasContextType.Modal && modalId
      ? getModalContextKey(modalId)
      : getCurrentPageContextKey();
  const contextComponents = getComponentsForContext(
    canvasComponents,
    contextType,
    modalId,
  );
  const parent = modalRootParent;
  const sourceParentId = parent?.type === "Modal" ? undefined : parent?.key;
  const targetParentId =
    target.parentId === modalId ? undefined : target.parentId;
  const result = moveComponentInContexts(
    componentKey,
    { [contextKey]: contextComponents },
    [],
    { contextKey, parentId: sourceParentId },
    { contextKey, parentId: targetParentId, childIndex: target.childIndex, tabIndex: target.tabIndex },
    null,
    new Map(),
  );
  const movedCanvasComponents = result.nextContexts[contextKey] ?? contextComponents;
  const movedById = new Map(
    movedCanvasComponents.map((component) => [component.id, component]),
  );
  const nestedComponentKeys = new Set(
    movedCanvasComponents.flatMap((component) => component.children ?? []),
  );

  const updatedComponents = components.map((existingComponent) => {
    const canvasComponent = movedById.get(existingComponent.key);
    if (!canvasComponent) return existingComponent;
    const isNestedComponent = nestedComponentKeys.has(existingComponent.key);
    return {
      ...existingComponent,
      properties: canvasComponent.props as ProjectJsonObject,
      bindings: canvasComponent.bindings as ProjectJsonObject | undefined ?? null,
      children: canvasComponent.children ?? [],
      layout: isNestedComponent
        ? readLegacyLayout(canvasComponent.layout) ?? existingComponent.layout
        : null,
    };
  });
  if (contextType !== CanvasContextType.Modal || !modalId) {
    return reorderPageRootComponents(
      updatedComponents,
      movedCanvasComponents,
      nestedComponentKeys,
    );
  }

  const nestedChildren = new Set(
    movedCanvasComponents.flatMap((component) => component.children ?? []),
  );
  const modalRootIds = movedCanvasComponents
    .filter((component) => !nestedChildren.has(component.id))
    .map((component) => component.id);
  return updatedComponents.map((component) =>
    component.key === modalId
      ? { ...component, children: modalRootIds }
      : component,
  );
}

function reorderPageRootComponents(
  components: IProjectComponent[],
  movedCanvasComponents: VdabComponent[],
  nestedComponentKeys: Set<string>,
): IProjectComponent[] {
  const reorderedRootKeys = movedCanvasComponents
    .filter((component) => !nestedComponentKeys.has(component.id))
    .sort((first, second) => {
      const firstY = readLegacyLayout(first.layout)?.y;
      const secondY = readLegacyLayout(second.layout)?.y;
      return (typeof firstY === "number" ? firstY : 0) -
        (typeof secondY === "number" ? secondY : 0);
    })
    .map((component) => component.id);
  const reorderedRootKeySet = new Set(reorderedRootKeys);
  const rootSlots = components.flatMap((component, index) =>
    reorderedRootKeySet.has(component.key) ? [index] : [],
  );
  const componentsByKey = new Map(
    components.map((component) => [component.key, component]),
  );
  const reorderedComponents = [...components];

  rootSlots.forEach((slot, index) => {
    const key = reorderedRootKeys[index];
    const component = key ? componentsByKey.get(key) : undefined;
    if (component) reorderedComponents[slot] = component;
  });

  return reorderedComponents;
}

/** Creates a durable project component from an item produced by the SaaS palette. */
export function addProjectComponentFromLegacyCanvas(
  components: IProjectComponent[],
  canvasComponent: VdabComponent,
  options?: AddComponentOptions,
  contextType: CanvasContextType = CanvasContextType.Page,
  modalId?: string,
): { components: IProjectComponent[]; component: IProjectComponent } | null {
  if (!isProjectComponentAddType(canvasComponent.type)) return null;
  const created = createProjectComponent(canvasComponent.type, components);
  const parentId = options?.parentId ??
    (contextType === CanvasContextType.Modal ? modalId : undefined);
  const parent = parentId
    ? components.find((component) => component.key === parentId)
    : undefined;
  if (parentId && !parent) return null;

  const childIndex = Math.max(
    0,
    Math.min(options?.childIndex ?? parent?.children.length ?? components.length,
      parent?.children.length ?? components.length),
  );
  const component: IProjectComponent = {
    ...created,
    key: canvasComponent.id,
    codeName: canvasComponent.codeName || created.codeName,
    properties: toStandaloneProperties(
      canvasComponent.type,
      created.properties,
      canvasComponent.props,
    ),
    bindings: canvasComponent.bindings as ProjectJsonObject | undefined ?? null,
    layout: readLegacyLayout(canvasComponent.layout) ?? (parent ? { y: childIndex } : null),
  };

  if (!parent) {
    return { components: [...components, component], component };
  }

  const children = [...parent.children];
  children.splice(childIndex, 0, component.key);
  return {
    components: [
      ...components.map((candidate) =>
        candidate.key === parent.key ? { ...candidate, children } : candidate,
      ),
      component,
    ],
    component,
  };
}

function toStandaloneProperties(
  type: ProjectComponentAddType,
  defaults: ProjectJsonObject,
  canvasProperties: Record<string, unknown>,
): ProjectJsonObject {
  const properties = { ...defaults, ...canvasProperties };

  if (type === "GenieChat") delete properties.genieSpaceAppResourceName;
  if (type === "ModelChat") delete properties.servingEndpointAppResourceName;

  return properties;
}

function readLegacyLayout(value: string | undefined): ProjectJsonObject | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isProjectComponentAddType(value: string): value is ProjectComponentAddType {
  return PROJECT_COMPONENT_ADD_TYPES.some((type) => type === value);
}

function isJsonObject(value: unknown): value is ProjectJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
