import type { VdabComponent } from "../types/components";
import {
  getModalContextKey,
  getModalIdFromContextKey,
  type ComponentContexts,
} from "../types/editor";
import {
  ComponentCategory,
  ComponentType,
} from "../types/components/componentTypes";
import type {
  RemoveComponentMode,
  RemoveComponentOptions,
} from "../types/components/componentRemoval";
import {
  createLayout,
  createTabChildLayout,
  getLayoutTabIndex,
  getLayoutY,
  sortComponentsByLayout,
} from "./layoutUtils";

export type ParentLocation =
  | {
      location: "context";
      contextKey: string;
      parentIndex: number;
    }
  | {
      location: "modal";
      modalIndex: number;
    };

export interface RemoveComponentResult {
  nextContexts: ComponentContexts;
  nextModals: VdabComponent[];
  idsToRemove: Set<string>;
  shouldClearSelection: boolean;
  backendIdsToRemove: Set<number>;
}

export interface RemoveFromContextsResult {
  updatedContexts: ComponentContexts;
  removedComponent?: VdabComponent;
  sourceContextKey?: string;
}

export const getNormalizedChildren = (children?: string[]): string[] =>
  children?.filter((id) => id && id.trim()) ?? [];

/**
 * Returns a new array with duplicate IDs removed, preserving first-occurrence order.
 * Applied defensively wherever a parent's children array is modified.
 */
export const deduplicateIds = (ids: string[]): string[] => [...new Set(ids)];

/**
 * Resolves the parent container location from a known source context + parent ID.
 *
 * Returns `null` in three distinct cases:
 * - `sourceParentId` is undefined (component has no parent — it is top-level)
 * - The modal referenced by the context key is not present in `modals`
 * - The parent component is not found in the source context array
 *
 * Callers must treat all three cases as a no-op; do not distinguish between
 * "intentionally top-level" and "parent unexpectedly missing" at the call site.
 */
export const getParentLocationFromSource = (
  sourceContextKey: string,
  sourceParentId: string | undefined,
  contexts: ComponentContexts,
  modals: VdabComponent[],
): ParentLocation | null => {
  if (!sourceParentId) {
    return null;
  }

  const sourceModalId = getModalIdFromContextKey(sourceContextKey);

  if (sourceModalId && sourceModalId === sourceParentId) {
    const modalIndex = modals.findIndex((modal) => modal.id === sourceModalId);
    if (modalIndex === -1) {
      return null;
    }

    return { location: "modal", modalIndex };
  }

  const sourceComponents = contexts[sourceContextKey] || [];
  const parentIndex = sourceComponents.findIndex(
    (component) => component.id === sourceParentId,
  );

  if (parentIndex === -1) {
    return null;
  }

  return { location: "context", contextKey: sourceContextKey, parentIndex };
};

export const buildComponentMap = (
  contexts: ComponentContexts,
  modals: VdabComponent[],
): Map<string, VdabComponent> => {
  const map = new Map<string, VdabComponent>();
  Object.values(contexts)
    .flat()
    .forEach((component) => map.set(component.id, component));
  modals.forEach((modal) => map.set(modal.id, modal));
  return map;
};

export const collectDescendantIds = (
  rootId: string,
  componentMap: Map<string, VdabComponent>,
): Set<string> => {
  const visited = new Set<string>();
  const stack = [rootId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    const component = componentMap.get(currentId);
    if (!component?.children) continue;

    getNormalizedChildren(component.children).forEach((childId) => {
      if (!visited.has(childId)) {
        stack.push(childId);
      }
    });
  }

  visited.delete(rootId);
  return visited;
};

export const removeIdsFromContexts = (
  contexts: ComponentContexts,
  idsToRemove: Set<string>,
): { nextContexts: ComponentContexts; changedKeys: Set<string> } => {
  const nextContexts: ComponentContexts = { ...contexts };
  const changedKeys = new Set<string>();

  for (const [contextKey, components] of Object.entries(contexts)) {
    const filtered = components.filter(
      (component) => !idsToRemove.has(component.id),
    );
    if (filtered.length !== components.length) {
      nextContexts[contextKey] = filtered;
      changedKeys.add(contextKey);
    }
  }

  return { nextContexts, changedKeys };
};

export const removeFromContexts = (
  contexts: ComponentContexts,
  componentId: string,
): RemoveFromContextsResult => {
  const updatedContexts = { ...contexts };

  for (const [contextKey, components] of Object.entries(updatedContexts)) {
    const componentIndex = components.findIndex((c) => c.id === componentId);
    if (componentIndex !== -1) {
      const removedComponent = components[componentIndex];
      updatedContexts[contextKey] = [...components];
      updatedContexts[contextKey].splice(componentIndex, 1);
      return {
        updatedContexts,
        removedComponent,
        sourceContextKey: contextKey,
      };
    }
  }

  return { updatedContexts: contexts };
};

export const updateParentChildren = (
  contexts: ComponentContexts,
  modals: VdabComponent[],
  parentLocation: ParentLocation,
  updatedChildren: string[],
): {
  contexts: ComponentContexts;
  modals: VdabComponent[];
  updatedParent?: VdabComponent;
} => {
  if (parentLocation.location === "context") {
    const contextComponents = contexts[parentLocation.contextKey] || [];
    const parent = contextComponents[parentLocation.parentIndex];
    const nextContexts = {
      ...contexts,
      [parentLocation.contextKey]: contextComponents.map((comp, index) =>
        index === parentLocation.parentIndex
          ? { ...comp, children: updatedChildren }
          : comp,
      ),
    };
    return {
      contexts: nextContexts,
      modals,
      updatedParent: { ...parent, children: updatedChildren },
    };
  }

  const nextModals = modals.map((modal, index) =>
    index === parentLocation.modalIndex
      ? { ...modal, children: updatedChildren }
      : modal,
  );
  const updatedParent = nextModals[parentLocation.modalIndex];

  return {
    contexts,
    modals: nextModals,
    updatedParent,
  };
};

/**
 * Reindex layout y positions for all children of a Form, Expander, or Tabs component.
 * Both types use layout.y as the canonical ordering ground truth — the children
 * array is an unordered membership set.
 *
 * A provisional fractional y (e.g. insertAt - 0.5) can be used when inserting
 * to express relative order without modifying the children array, and this
 * function will then normalise all values to sequential integers.
 *
 * - Form/Expander: sorts all children by current y, then reassigns sequential y = 0, 1, 2, ...
 * - Tabs: groups children by tabIndex, sorts each group by y, then reassigns
 *   sequential y = 0, 1, 2, ... within each group.
 *
 * TODO: Each new ordered-layout type (Form, Expander, Tabs, ...) adds another branch here.
 * If a third type is added, consider parameterising with a grouping-key extractor
 * function: `(layout?: string) => string` where Form uses `() => 'root'` and
 * Tabs uses `(l) => String(getLayoutTabIndex(l) ?? 0)`.
 */
export const updateOrderedChildLayouts = (
  contexts: ComponentContexts,
  modals: VdabComponent[],
  contextKey: string,
  parent: VdabComponent,
): ComponentContexts => {
  const isFormLike =
    parent.type === ComponentType.Form ||
    parent.type === ComponentType.Expander;
  const isTabs = parent.type === ComponentType.Tabs;
  if ((!isFormLike && !isTabs) || !parent.children?.length) {
    return contexts;
  }

  const allComponents = [...Object.values(contexts).flat(), ...modals];
  const componentMap = new Map(
    allComponents.map((component) => [component.id, component]),
  );
  const updatedLayouts = new Map<string, string>();
  const normalizedChildren = getNormalizedChildren(parent.children);

  if (isFormLike) {
    const entries: Array<{ id: string; y: number }> = [];
    for (const childId of normalizedChildren) {
      const child = componentMap.get(childId);
      if (!child) continue;
      entries.push({ id: childId, y: getLayoutY(child.layout) });
    }
    entries
      .sort((a, b) => a.y - b.y)
      .forEach((entry, i) => {
        updatedLayouts.set(entry.id, createLayout(i));
      });
  } else {
    // Tabs: group children by tabIndex
    const byTab = new Map<number, Array<{ id: string; y: number }>>();
    for (const childId of normalizedChildren) {
      const child = componentMap.get(childId);
      if (!child) continue;
      const tabIndex = getLayoutTabIndex(child.layout) ?? 0;
      if (!byTab.has(tabIndex)) byTab.set(tabIndex, []);
      byTab.get(tabIndex)!.push({ id: childId, y: getLayoutY(child.layout) });
    }
    byTab.forEach((entries, tabIndex) => {
      entries
        .sort((a, b) => a.y - b.y)
        .forEach((entry, i) => {
          updatedLayouts.set(entry.id, createTabChildLayout(tabIndex, i));
        });
    });
  }

  return {
    ...contexts,
    [contextKey]: (contexts[contextKey] || []).map((component) =>
      updatedLayouts.has(component.id)
        ? { ...component, layout: updatedLayouts.get(component.id) }
        : component,
    ),
  };
};

export const getChildIdsInContext = (
  components: VdabComponent[],
): Set<string> => {
  const childIds = new Set<string>();
  components.forEach((component) => {
    getNormalizedChildren(component.children).forEach((childId) => {
      childIds.add(childId);
    });
  });
  return childIds;
};

export const compactTopLevelLayouts = (
  components: VdabComponent[],
  idsToPreserveLayout: Set<string> = new Set<string>(),
): VdabComponent[] => {
  const childIds = getChildIdsInContext(components);
  const topLevelComponents = sortComponentsByLayout(
    components.filter(
      (component) =>
        component.type !== ComponentType.Modal &&
        !childIds.has(component.id) &&
        !idsToPreserveLayout.has(component.id),
    ),
  );

  const updatedLayouts = new Map<string, string>();
  topLevelComponents.forEach((component, index) => {
    updatedLayouts.set(component.id, createLayout(index));
  });

  return components.map((component) =>
    updatedLayouts.has(component.id)
      ? { ...component, layout: updatedLayouts.get(component.id) }
      : component,
  );
};

export const applyRemoveComponent = (
  componentId: string,
  options: RemoveComponentOptions | undefined,
  contexts: ComponentContexts,
  modals: VdabComponent[],
  componentIdMap: Map<string, number>,
  selectedComponentId: string | null,
  removedComponent: VdabComponent,
  sourceContextKey: string,
  sourceParentId?: string,
): RemoveComponentResult => {
  const componentMap = buildComponentMap(contexts, modals);
  componentMap.set(removedComponent.id, removedComponent);
  const mode: RemoveComponentMode | undefined = options?.mode;
  const shouldDeleteSubtree =
    mode === "deleteSubtree" ||
    (removedComponent.category === ComponentCategory.Layout &&
      mode !== "reparent");

  let nextContexts = contexts;
  let nextModals = modals;
  const idsToRemove = new Set<string>([componentId]);
  const backendIdsToRemove = new Set<number>();

  if (shouldDeleteSubtree) {
    collectDescendantIds(componentId, componentMap).forEach((id) =>
      idsToRemove.add(id),
    );
  }

  if (shouldDeleteSubtree) {
    const { nextContexts: filteredContexts, changedKeys } =
      removeIdsFromContexts(nextContexts, idsToRemove);
    nextContexts = filteredContexts;

    if (changedKeys.size > 0) {
      changedKeys.forEach((contextKey) => {
        nextContexts[contextKey] = compactTopLevelLayouts(
          nextContexts[contextKey],
        );
      });
    }
  }

  const parentLocation = getParentLocationFromSource(
    sourceContextKey,
    sourceParentId,
    contexts,
    modals,
  );
  if (parentLocation) {
    const parent =
      parentLocation.location === "context"
        ? contexts[parentLocation.contextKey]?.[parentLocation.parentIndex]
        : modals[parentLocation.modalIndex];

    const parentChildren = [...(parent?.children || [])];
    let updatedChildren: string[];

    if (
      parent?.type === ComponentType.Rows ||
      parent?.type === ComponentType.Columns
    ) {
      updatedChildren = parentChildren.map((childId) =>
        childId === componentId ? "" : childId,
      );
    } else {
      updatedChildren = parentChildren.filter(
        (childId) => childId !== componentId,
      );
    }

    const parentUpdate = updateParentChildren(
      nextContexts,
      nextModals,
      parentLocation,
      updatedChildren,
    );
    nextContexts = parentUpdate.contexts;
    nextModals = parentUpdate.modals;

    if (parentUpdate.updatedParent && parentLocation.location === "context") {
      nextContexts = updateOrderedChildLayouts(
        nextContexts,
        nextModals,
        parentLocation.contextKey,
        parentUpdate.updatedParent,
      );
    }
  } else if (!shouldDeleteSubtree) {
    const idsToPreserveLayout = collectDescendantIds(componentId, componentMap);
    nextContexts = {
      ...nextContexts,
      [sourceContextKey]: compactTopLevelLayouts(
        nextContexts[sourceContextKey] || [],
        idsToPreserveLayout,
      ),
    };
  }

  if (shouldDeleteSubtree) {
    const modalIdsToRemove = new Set<string>();
    idsToRemove.forEach((id) => {
      const component = componentMap.get(id);
      if (component?.type === ComponentType.Modal) {
        modalIdsToRemove.add(id);
      }
    });

    if (modalIdsToRemove.size > 0) {
      nextModals = nextModals.filter(
        (modal) => !modalIdsToRemove.has(modal.id),
      );
      nextContexts = { ...nextContexts };
      modalIdsToRemove.forEach((modalId) => {
        delete nextContexts[getModalContextKey(modalId)];
      });
    }
  }

  if (shouldDeleteSubtree) {
    idsToRemove.forEach((id) => {
      const backendId = componentIdMap.get(id);
      if (backendId) {
        backendIdsToRemove.add(backendId);
      }
    });
  } else {
    const backendId = componentIdMap.get(componentId);
    if (backendId) {
      backendIdsToRemove.add(backendId);
    }
  }

  const shouldClearSelection =
    !!selectedComponentId && idsToRemove.has(selectedComponentId);

  return {
    nextContexts,
    nextModals,
    idsToRemove,
    shouldClearSelection,
    backendIdsToRemove,
  };
};
