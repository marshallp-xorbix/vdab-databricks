/**
 * Utility functions for organizing components by page/modal context
 */

import type { VdabComponent } from "../types/components";
import { ComponentType } from "../types/components/componentTypes";
import {
  CanvasContextType,
  getCurrentPageContextKey,
  getModalIdFromContextKey,
  getModalContextKey,
  isModalContextKey,
  type ComponentOwnershipIndexes,
} from "../types/editor";

/**
 * Checks if a component is a modal
 */
export function isModal(component: VdabComponent): boolean {
  return component.type === ComponentType.Modal;
}

/**
 * Returns all modal components
 */
export function getModalComponents(
  components: VdabComponent[],
): VdabComponent[] {
  return components.filter((comp) => isModal(comp));
}

export function getContextKeyForCanvas(
  contextType: CanvasContextType,
  modalId?: string,
): string {
  if (contextType === CanvasContextType.Modal && modalId) {
    return getModalContextKey(modalId);
  }

  return getCurrentPageContextKey();
}

/**
 * Returns all components that belong to the current page context
 * (i.e., not modals and not children of modals).
 *
 * Note: calls `deriveComponentOwnershipIndexes` internally. If you also need
 * modal children in the same pass, prefer {@link partitionComponentsByContext}.
 */
export function getPageComponents(
  components: VdabComponent[],
): VdabComponent[] {
  const pageContextKey = getCurrentPageContextKey();
  const indexes = deriveComponentOwnershipIndexes(components, pageContextKey);

  return components.filter(
    (comp) =>
      !isModal(comp) &&
      indexes.ownerContextByComponentId[comp.id] === pageContextKey,
  );
}

/**
 * Returns all child components of a specific modal (including nested descendants).
 *
 * Note: calls `deriveComponentOwnershipIndexes` internally. If you also need
 * page components or multiple modal partitions in the same pass, prefer
 * {@link partitionComponentsByContext}.
 */
export function getModalChildComponents(
  components: VdabComponent[],
  modalId: string,
): VdabComponent[] {
  const modalContextKey = getModalContextKey(modalId);
  const indexes = deriveComponentOwnershipIndexes(components);

  return components.filter(
    (comp) => indexes.ownerContextByComponentId[comp.id] === modalContextKey,
  );
}

/**
 * Returns components for a specific context (page or modal)
 * @param components All components
 * @param contextType Type of context
 * @param modalId Required if contextType is "modal"
 * @returns Filtered components for the context
 */
export function getComponentsForContext(
  components: VdabComponent[],
  contextType: CanvasContextType,
  modalId?: string,
): VdabComponent[] {
  if (contextType === CanvasContextType.Page) {
    return getPageComponents(components);
  } else if (contextType === CanvasContextType.Modal && modalId) {
    return getModalChildComponents(components, modalId);
  }
  return [];
}

export function deriveComponentOwnershipIndexes(
  components: VdabComponent[],
  pageContextKey: string = getCurrentPageContextKey(),
): ComponentOwnershipIndexes {
  const componentMap = new Map<string, VdabComponent>(
    components.map((component) => [component.id, component]),
  );
  const modalComponents = components.filter((component) => isModal(component));
  const ownerContextByComponentId: Record<string, string> = {};
  const parentByChildId: Record<string, string> = {};

  modalComponents.forEach((modal) => {
    const modalContextKey = getModalContextKey(modal.id);
    const childIds = (modal.children ?? []).filter(Boolean);

    childIds.forEach((childId) => {
      assignParent(parentByChildId, childId, modal.id);
      walkOwnershipDepthFirst(
        childId,
        modalContextKey,
        componentMap,
        ownerContextByComponentId,
        parentByChildId,
      );
    });
  });

  components.forEach((component) => {
    if (isModal(component)) {
      return;
    }

    if (!ownerContextByComponentId[component.id]) {
      ownerContextByComponentId[component.id] = pageContextKey;
    }
  });

  // Populate parentByChildId for page-level layout components.
  // The modal walk above already covers modal-owned trees; this pass covers
  // Forms, Tabs, Rows, Columns, and any other layout containers on the page.
  // Uses a defensive warn-and-skip instead of throw so that corrupt DB data
  // (child appearing in two parents) does not crash the owership useMemo.
  components.forEach((component) => {
    if (isModal(component)) return;
    if (!component.children?.length) return;
    component.children
      .filter((id) => id && id.trim())
      .forEach((childId) => {
        const existingParentId = parentByChildId[childId];
        if (existingParentId && existingParentId !== component.id) {
          console.warn(
            `[componentOrganization] Component '${childId}' found in multiple parents: '${existingParentId}' and '${component.id}'. First occurrence wins.`,
          );
          return;
        }
        parentByChildId[childId] = component.id;
      });
  });

  return {
    ownerContextByComponentId,
    parentByChildId,
  };
}

/**
 * Runs the ownership DFS once and returns page and all modal child components
 * partitioned in a single pass. Prefer this over calling
 * {@link getPageComponents} and {@link getModalChildComponents} separately
 * when both are needed for the same component array.
 */
export interface ComponentPartition {
  pageComponents: VdabComponent[];
  /** Map from modal component ID to that modal's child components. */
  modalChildrenByModalId: Record<string, VdabComponent[]>;
}

export function partitionComponentsByContext(
  components: VdabComponent[],
): ComponentPartition {
  const pageContextKey = getCurrentPageContextKey();
  const indexes = deriveComponentOwnershipIndexes(components, pageContextKey);
  const pageComponents: VdabComponent[] = [];
  const modalChildrenByModalId: Record<string, VdabComponent[]> = {};

  getModalComponents(components).forEach((modal) => {
    modalChildrenByModalId[modal.id] = [];
  });

  components.forEach((component) => {
    if (isModal(component)) return;

    const ownerContext = indexes.ownerContextByComponentId[component.id];
    if (ownerContext === pageContextKey) {
      pageComponents.push(component);
    } else if (ownerContext && isModalContextKey(ownerContext)) {
      const modalId = getModalIdFromContextKey(ownerContext);
      if (!modalId) {
        return;
      }
      if (!(modalId in modalChildrenByModalId)) {
        modalChildrenByModalId[modalId] = [];
      }
      modalChildrenByModalId[modalId].push(component);
    }
  });

  return { pageComponents, modalChildrenByModalId };
}

function walkOwnershipDepthFirst(
  componentId: string,
  ownerContextKey: string,
  componentMap: Map<string, VdabComponent>,
  ownerContextByComponentId: Record<string, string>,
  parentByChildId: Record<string, string>,
): void {
  const component = componentMap.get(componentId);
  if (!component) {
    throw new Error(
      `Missing child reference '${componentId}' while deriving ownership.`,
    );
  }

  const existingContext = ownerContextByComponentId[componentId];
  if (existingContext && existingContext !== ownerContextKey) {
    throw new Error(
      `Component '${componentId}' is owned by multiple contexts: '${existingContext}' and '${ownerContextKey}'.`,
    );
  }

  if (existingContext === ownerContextKey) {
    return;
  }

  ownerContextByComponentId[componentId] = ownerContextKey;

  const childIds = (component.children ?? []).filter(Boolean);
  childIds.forEach((childId) => {
    assignParent(parentByChildId, childId, componentId);
    walkOwnershipDepthFirst(
      childId,
      ownerContextKey,
      componentMap,
      ownerContextByComponentId,
      parentByChildId,
    );
  });
}

function assignParent(
  parentByChildId: Record<string, string>,
  childId: string,
  parentId: string,
): void {
  const existingParentId = parentByChildId[childId];
  if (existingParentId && existingParentId !== parentId) {
    throw new Error(
      `Component '${childId}' has multiple parents: '${existingParentId}' and '${parentId}'.`,
    );
  }

  parentByChildId[childId] = parentId;
}
