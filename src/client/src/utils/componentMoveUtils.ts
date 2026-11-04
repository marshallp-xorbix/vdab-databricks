import type { VdabComponent } from "../types/components";
import {
  getModalIdFromContextKey,
  isModalContextKey,
  type ComponentContexts,
} from "../types/editor";
import { ComponentType } from "../types/components/componentTypes";
import {
  applyRemoveComponent,
  collectDescendantIds,
  deduplicateIds,
  updateOrderedChildLayouts,
} from "./componentRemovalUtils";
import {
  applyTopLevelLayoutOrder,
  assignLayoutToComponent,
  createLayout,
  createTabChildLayout,
  getLayoutTabIndex,
  getLayoutY,
} from "./layoutUtils";
import { buildSortableModelForTopLevel } from "./sortableUtils";

export type MoveComponentTarget = {
  contextKey: string;
  parentId?: string;
  childIndex?: number;
  /** Only used when parent is a Tabs component */
  tabIndex?: number;
};

export type MoveComponentSource = {
  contextKey: string;
  parentId?: string;
};

export type MoveComponentResult = {
  nextContexts: ComponentContexts;
  nextModals: VdabComponent[];
  movedComponent?: VdabComponent;
};

const getAllComponents = (
  contexts: ComponentContexts,
  modals: VdabComponent[],
): VdabComponent[] => [...Object.values(contexts).flat(), ...modals];

export const moveComponentInContexts = (
  componentId: string,
  contexts: ComponentContexts,
  modals: VdabComponent[],
  source: MoveComponentSource,
  target: MoveComponentTarget,
  selectedComponentId: string | null,
  componentIdMap: Map<string, number>,
): MoveComponentResult => {
  const sourceComponents = contexts[source.contextKey] || [];
  const sourceComponentIndex = sourceComponents.findIndex(
    (component) => component.id === componentId,
  );

  if (sourceComponentIndex === -1) {
    return { nextContexts: contexts, nextModals: modals };
  }

  const removedComponent = sourceComponents[sourceComponentIndex];
  const updatedContexts: ComponentContexts = {
    ...contexts,
    [source.contextKey]: [...sourceComponents],
  };

  // updatedContexts is a shallow copy of contexts. The splice below mutates only
  // updatedContexts; if a later guard reverts by returning the original `contexts`,
  // this in-progress removal is implicitly abandoned.
  updatedContexts[source.contextKey].splice(sourceComponentIndex, 1);

  const sourceContextKey = source.contextKey;

  const removalResult = applyRemoveComponent(
    componentId,
    { mode: "reparent" },
    updatedContexts,
    modals,
    componentIdMap,
    selectedComponentId,
    removedComponent,
    sourceContextKey,
    source.parentId,
  );

  let nextContexts = removalResult.nextContexts;
  let nextModals = removalResult.nextModals;

  const targetComponents = nextContexts[target.contextKey] || [];
  const allComponents = getAllComponents(nextContexts, nextModals);
  const allComponentsById = new Map(
    allComponents.map((component) => [component.id, component]),
  );

  let componentToInsert: VdabComponent = removedComponent;
  const clampIndex = (index: number, min: number, max: number) =>
    Math.max(min, Math.min(index, max));

  if (target.parentId) {
    const parentIndex = targetComponents.findIndex(
      (comp) => comp.id === target.parentId,
    );
    if (parentIndex === -1) {
      // Parent not found — revert to original contexts/modals to avoid losing the removed component
      return { nextContexts: contexts, nextModals: modals };
    }

    const parent = targetComponents[parentIndex];
    const childIndex =
      typeof target.childIndex === "number"
        ? target.childIndex
        : (parent.children || []).length;

    let updatedChildren = [...(parent.children || [])];

    if (
      parent.type === ComponentType.Form ||
      parent.type === ComponentType.Expander
    ) {
      // Sort existing children by layout y — children array is unordered membership
      const existingInForm = (parent.children || [])
        .map((id) => allComponentsById.get(id))
        .filter((c): c is VdabComponent => !!c)
        .sort((a, b) => getLayoutY(a.layout) - getLayoutY(b.layout));
      const insertAt = clampIndex(childIndex, 0, existingInForm.length);
      // Fractional y signals insertion position; updateOrderedChildLayouts normalises to integers
      componentToInsert = {
        ...componentToInsert,
        layout: createLayout(insertAt - 0.5),
      };
      updatedChildren = [...(parent.children || []), componentId];
    } else if (
      parent.type === ComponentType.Rows ||
      parent.type === ComponentType.Columns
    ) {
      if (
        updatedChildren[childIndex] &&
        updatedChildren[childIndex] !== componentId
      ) {
        // Slot occupied — revert the operation and return original contexts/modals so UI can keep component in place
        return { nextContexts: contexts, nextModals: modals };
      }
      updatedChildren[childIndex] = componentId;
      componentToInsert = {
        ...componentToInsert,
        layout: createLayout(childIndex),
      };
    } else if (parent.type === ComponentType.Tabs) {
      const tabIdx = typeof target.tabIndex === "number" ? target.tabIndex : 0;
      // Get existing children in this tab pane sorted by y
      const existingInTab = (parent.children || [])
        .map((id) => allComponentsById.get(id))
        .filter(
          (c): c is VdabComponent =>
            !!c && getLayoutTabIndex(c.layout) === tabIdx,
        )
        .sort((a, b) => getLayoutY(a.layout) - getLayoutY(b.layout));
      const insertAt = Math.max(0, Math.min(childIndex, existingInTab.length));
      // Fractional y signals insertion position; updateOrderedChildLayouts normalises to integers
      componentToInsert = {
        ...componentToInsert,
        layout: createTabChildLayout(tabIdx, insertAt - 0.5),
      };
      updatedChildren = [...(parent.children || []), componentId];
    } else {
      const normalizedChildren = updatedChildren.filter(
        (childId) => childId !== componentId,
      );
      const nextIndex = clampIndex(childIndex, 0, normalizedChildren.length);
      normalizedChildren.splice(nextIndex, 0, componentId);
      updatedChildren = normalizedChildren;
    }

    const updatedParent = {
      ...parent,
      children: deduplicateIds(updatedChildren),
    };
    const nextTargetComponents = targetComponents.map((comp, index) =>
      index === parentIndex ? updatedParent : comp,
    );

    nextContexts = {
      ...nextContexts,
      [target.contextKey]: [...nextTargetComponents, componentToInsert],
    };

    if (
      updatedParent.type === ComponentType.Form ||
      updatedParent.type === ComponentType.Expander ||
      updatedParent.type === ComponentType.Tabs
    ) {
      nextContexts = updateOrderedChildLayouts(
        nextContexts,
        nextModals,
        target.contextKey,
        updatedParent,
      );
    }

    return { nextContexts, nextModals, movedComponent: componentToInsert };
  }

  const model = buildSortableModelForTopLevel(targetComponents);
  const componentMap = new Map<string, VdabComponent>(
    allComponents.map((component) => [component.id, component]),
  );
  componentMap.set(componentToInsert.id, componentToInsert);
  const descendantIds = collectDescendantIds(componentId, componentMap);

  const orderedIds = model.orderedIds.filter(
    (id) => id !== componentId && !descendantIds.has(id),
  );
  const childIndex =
    typeof target.childIndex === "number"
      ? target.childIndex
      : orderedIds.length;
  const nextIndex = clampIndex(childIndex, 0, orderedIds.length);
  orderedIds.splice(nextIndex, 0, componentId);

  const componentWithLayout = assignLayoutToComponent(
    { ...componentToInsert, layout: undefined },
    targetComponents,
  );

  nextContexts = {
    ...nextContexts,
    [target.contextKey]: applyTopLevelLayoutOrder(
      [...targetComponents, componentWithLayout],
      orderedIds,
    ),
  };

  if (isModalContextKey(target.contextKey)) {
    const modalId = getModalIdFromContextKey(target.contextKey);
    if (!modalId) {
      return { nextContexts, nextModals, movedComponent: componentWithLayout };
    }
    nextModals = nextModals.map((modal) =>
      modal.id === modalId ? { ...modal, children: orderedIds } : modal,
    );
  }

  return { nextContexts, nextModals, movedComponent: componentWithLayout };
};
