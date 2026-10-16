import { useCallback, useMemo, useState, type RefObject } from "react";
import type { VdabComponent } from "../types/components";
import type { RemoveComponentOptions } from "../types/components/componentRemoval";
import type { ComponentContexts } from "../types/editor";
import {
  getModalContextKey,
  getModalIdFromContextKey,
  isModalContextKey,
  type CanvasContextType,
} from "../types/editor";
import { ComponentType } from "../types/components/componentTypes";
import {
  applyTopLevelLayoutOrder,
  assignLayoutToComponent,
  createLayout,
  createTabChildLayout,
  getLayoutTabIndex,
  getLayoutY,
} from "../utils/layoutUtils";
import type { AddComponentOptions } from "../types/components/componentOperations";
import {
  applyRemoveComponent,
  collectDescendantIds,
  deduplicateIds,
  getNormalizedChildren,
  removeFromContexts,
  updateOrderedChildLayouts,
} from "../utils/componentRemovalUtils";
import { moveComponentInContexts } from "../utils/componentMoveUtils";
import { buildSortableModelForTopLevel } from "../utils/sortableUtils";
import { assignCodeNameOnCreate } from "../utils/codeNameUtils";
import {
  deriveComponentOwnershipIndexes,
  getContextKeyForCanvas,
} from "../utils/componentOrganization";

const COMPONENT_LEVEL_FIELDS = new Set([
  "codeName",
  "props",
  "children",
  "bindings",
  "supportedBindings",
  "supportedEvents",
]);

const applyComponentUpdates = (
  component: VdabComponent,
  updates: Record<string, unknown>,
): VdabComponent => {
  const hasComponentFields = Object.keys(updates).some((key) =>
    COMPONENT_LEVEL_FIELDS.has(key),
  );

  if (hasComponentFields) {
    return { ...component, ...updates };
  }

  return {
    ...component,
    props: { ...component.props, ...updates },
  };
};

interface UseComponentOperationsOptions {
  closeTabRef: RefObject<(tabId: string) => void>;
}

export const useComponentOperations = ({
  closeTabRef,
}: UseComponentOperationsOptions) => {
  // Component state - hierarchical contexts
  // Keys: "page_{id}", "modal_{id}"
  const [componentContexts, setComponentContexts] = useState<ComponentContexts>(
    {},
  );

  // Separate state for modal components (they don't belong to any context, they ARE a context)
  const [modals, setModals] = useState<VdabComponent[]>([]);

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null,
  );

  const [componentIdMap, setComponentIdMap] = useState<Map<string, number>>(
    new Map(),
  );

  // Track deleted component backend IDs for hard deletion on save
  const [deletedComponentIds, setDeletedComponentIds] = useState<Set<number>>(
    new Set(),
  );

  // Helper to get all components flattened (contexts + modals)
  const getAllComponents = useCallback((): VdabComponent[] => {
    return [...Object.values(componentContexts).flat(), ...modals];
  }, [componentContexts, modals]);

  const componentOwnershipIndexes = useMemo(
    () => deriveComponentOwnershipIndexes(getAllComponents()),
    [getAllComponents],
  );

  // Helper to find component by ID (check contexts and modals)
  const findComponent = useCallback(
    (id: string): VdabComponent | undefined => {
      for (const contextComponents of Object.values(componentContexts)) {
        const component = contextComponents.find((c) => c.id === id);
        if (component) return component;
      }
      const modal = modals.find((m) => m.id === id);
      return modal;
    },
    [componentContexts, modals],
  );

  // Update component - finds and updates in correct context or modals array
  const updateComponent = useCallback(
    (componentId: string, updates: Record<string, unknown>) => {
      const modalIndex = modals.findIndex((m) => m.id === componentId);
      if (modalIndex !== -1) {
        setModals((prev) => {
          const updated = [...prev];
          updated[modalIndex] = applyComponentUpdates(
            updated[modalIndex],
            updates,
          );
          return updated;
        });
        return;
      }

      // Update component in context
      setComponentContexts((prev) => {
        const newContexts = { ...prev };

        for (const [contextKey, components] of Object.entries(newContexts)) {
          const componentIndex = components.findIndex(
            (c) => c.id === componentId,
          );
          if (componentIndex !== -1) {
            newContexts[contextKey] = [...components];
            newContexts[contextKey][componentIndex] = applyComponentUpdates(
              components[componentIndex],
              updates,
            );
            break;
          }
        }

        return newContexts;
      });
    },
    [modals],
  );

  const addComponent = useCallback(
    (
      component: VdabComponent,
      contextType: CanvasContextType,
      modalId?: string,
      options?: AddComponentOptions,
    ) => {
      setComponentContexts((prev) => {
        const newContexts = { ...prev };
        const contextKey = getContextKeyForCanvas(contextType, modalId);
        const contextComponents = newContexts[contextKey] || [];

        const contextComponentsById = new Map(
          contextComponents.map((contextComponent) => [
            contextComponent.id,
            contextComponent,
          ]),
        );
        const existingComponents = [...Object.values(prev).flat(), ...modals];
        const componentWithCodeName = assignCodeNameOnCreate(
          component,
          existingComponents,
        );
        const parentComponent = options?.parentId
          ? contextComponentsById.get(options.parentId)
          : undefined;

        const childIndex =
          typeof options?.childIndex === "number"
            ? options.childIndex
            : (parentComponent?.children?.length ?? 0);

        let componentWithLayout = assignLayoutToComponent(
          componentWithCodeName,
          contextComponents,
        );

        if (
          parentComponent?.type === ComponentType.Form ||
          parentComponent?.type === ComponentType.Expander
        ) {
          // Sort existing children by layout y to determine insertion position
          const existingInForm = (parentComponent.children || [])
            .map((id) => contextComponentsById.get(id))
            .filter((c): c is VdabComponent => !!c)
            .sort((a, b) => getLayoutY(a.layout) - getLayoutY(b.layout));
          const insertAt = Math.max(
            0,
            Math.min(childIndex, existingInForm.length),
          );
          // Fractional y signals insertion position; updateOrderedChildLayouts normalises to integers
          componentWithLayout = {
            ...componentWithLayout,
            layout: createLayout(insertAt - 0.5),
          };
        } else if (
          parentComponent?.type === ComponentType.Rows ||
          parentComponent?.type === ComponentType.Columns
        ) {
          componentWithLayout = {
            ...componentWithLayout,
            layout: createLayout(childIndex),
          };
        } else if (parentComponent?.type === ComponentType.Tabs) {
          const tabIdx =
            typeof options?.tabIndex === "number" ? options.tabIndex : 0;
          // Count existing children in this tab pane to determine insertion y
          const existingInTab = (parentComponent.children || [])
            .map((id) => contextComponentsById.get(id))
            .filter(
              (c): c is VdabComponent =>
                !!c && getLayoutTabIndex(c.layout) === tabIdx,
            );
          const insertAt = Math.max(
            0,
            Math.min(childIndex, existingInTab.length),
          );
          // Fractional y signals insertion position; updateOrderedChildLayouts normalises to integers
          componentWithLayout = {
            ...componentWithLayout,
            layout: createTabChildLayout(tabIdx, insertAt - 0.5),
          };
        }
        const nextContextComponents = [
          ...contextComponents,
          componentWithLayout,
        ];

        if (options?.parentId) {
          newContexts[contextKey] = nextContextComponents.map((comp) => {
            if (comp.id !== options.parentId) return comp;

            const currentChildren = [...(comp.children || [])];

            if (
              comp.type === ComponentType.Form ||
              comp.type === ComponentType.Expander
            ) {
              // Append to parent.children — y-based ordering is handled by updateOrderedChildLayouts
              return {
                ...comp,
                children: deduplicateIds([
                  ...currentChildren,
                  componentWithLayout.id,
                ]),
              };
            }

            if (
              comp.type === ComponentType.Rows ||
              comp.type === ComponentType.Columns
            ) {
              currentChildren[childIndex] = componentWithLayout.id;
              return { ...comp, children: currentChildren };
            }

            if (comp.type === ComponentType.Tabs) {
              // Append to parent.children — y-based ordering is handled by updateOrderedChildLayouts
              return {
                ...comp,
                children: deduplicateIds([
                  ...currentChildren,
                  componentWithLayout.id,
                ]),
              };
            }

            const nextIndex = Math.max(
              0,
              Math.min(childIndex, currentChildren.length),
            );
            currentChildren.splice(nextIndex, 0, componentWithLayout.id);
            return { ...comp, children: deduplicateIds(currentChildren) };
          });

          if (
            parentComponent?.type === ComponentType.Form ||
            parentComponent?.type === ComponentType.Expander ||
            parentComponent?.type === ComponentType.Tabs
          ) {
            const updatedParent = newContexts[contextKey].find(
              (comp) => comp.id === options.parentId,
            );
            if (updatedParent) {
              newContexts[contextKey] = updateOrderedChildLayouts(
                newContexts,
                modals,
                contextKey,
                updatedParent,
              )[contextKey];
            }
          }
        } else {
          if (typeof options?.childIndex === "number") {
            const model = buildSortableModelForTopLevel(nextContextComponents);
            const orderedIds = model.orderedIds.filter(
              (id) => id !== componentWithLayout.id,
            );
            const nextIndex = Math.max(
              0,
              Math.min(options.childIndex, orderedIds.length),
            );
            orderedIds.splice(nextIndex, 0, componentWithLayout.id);
            newContexts[contextKey] = applyTopLevelLayoutOrder(
              nextContextComponents,
              orderedIds,
            );
            // Sync modal.children to match the new y-ordered layout
            if (isModalContextKey(contextKey)) {
              const targetModalId = getModalIdFromContextKey(contextKey);
              if (!targetModalId) {
                return newContexts;
              }
              setModals((prevModals) =>
                prevModals.map((modal) =>
                  modal.id === targetModalId
                    ? { ...modal, children: orderedIds }
                    : modal,
                ),
              );
            }
          } else {
            newContexts[contextKey] = nextContextComponents;
          }
        }

        if (options?.onComplete) {
          setTimeout(() => options.onComplete?.(), 0);
        }

        return newContexts;
      });
    },
    [modals],
  );

  const removeComponent = useCallback(
    (componentId: string, options?: RemoveComponentOptions) => {
      const modalToRemove = modals.find((modal) => modal.id === componentId);
      if (modalToRemove) {
        setComponentContexts((prev) => {
          const removalResult = applyRemoveComponent(
            componentId,
            { mode: "deleteSubtree" },
            prev,
            modals,
            componentIdMap,
            selectedComponentId,
            modalToRemove,
            getModalContextKey(componentId),
            undefined,
          );

          if (removalResult.backendIdsToRemove.size > 0) {
            setDeletedComponentIds((prevDeleted) => {
              const updated = new Set(prevDeleted);
              removalResult.backendIdsToRemove.forEach((backendId) =>
                updated.add(backendId),
              );
              return updated;
            });
          }

          if (removalResult.nextModals !== modals) {
            setModals(removalResult.nextModals);
          }

          if (removalResult.shouldClearSelection) {
            setSelectedComponentId(null);
          }

          return removalResult.nextContexts;
        });

        return;
      }

      setComponentContexts((prev) => {
        const sourceParentId =
          componentOwnershipIndexes.parentByChildId[componentId];
        const { updatedContexts, removedComponent, sourceContextKey } =
          removeFromContexts(prev, componentId);

        if (!removedComponent || !sourceContextKey) return prev;

        const removalResult = applyRemoveComponent(
          componentId,
          options,
          updatedContexts,
          modals,
          componentIdMap,
          selectedComponentId,
          removedComponent,
          sourceContextKey,
          sourceParentId,
        );

        if (removalResult.backendIdsToRemove.size > 0) {
          setDeletedComponentIds((prevDeleted) => {
            const updated = new Set(prevDeleted);
            removalResult.backendIdsToRemove.forEach((backendId) =>
              updated.add(backendId),
            );
            return updated;
          });
        }

        if (removalResult.nextModals !== modals) {
          setModals(removalResult.nextModals);
        }

        if (removalResult.shouldClearSelection) {
          setSelectedComponentId(null);
        }

        return removalResult.nextContexts;
      });
    },
    [
      componentOwnershipIndexes.parentByChildId,
      selectedComponentId,
      componentIdMap,
      modals,
    ],
  );

  const removeComponentWithTab = useCallback(
    (componentId: string, options?: RemoveComponentOptions) => {
      const component = findComponent(componentId);
      if (component?.type === ComponentType.Modal) {
        const modalTabId = `modal-${componentId}`;
        closeTabRef.current(modalTabId);
      }

      removeComponent(componentId, options);
    },
    [findComponent, removeComponent, closeTabRef],
  );

  const moveComponent = useCallback(
    (
      componentId: string,
      target: {
        contextKey: string;
        parentId?: string;
        childIndex?: number;
        tabIndex?: number;
      },
    ) => {
      setComponentContexts((prev) => {
        const sourceContextKey =
          componentOwnershipIndexes.ownerContextByComponentId[componentId];
        const sourceParentId =
          componentOwnershipIndexes.parentByChildId[componentId];

        if (!sourceContextKey) {
          return prev;
        }

        if (
          !prev[sourceContextKey]?.some(
            (component) => component.id === componentId,
          )
        ) {
          return prev;
        }

        const result = moveComponentInContexts(
          componentId,
          prev,
          modals,
          {
            contextKey: sourceContextKey,
            parentId: sourceParentId,
          },
          target,
          selectedComponentId,
          componentIdMap,
        );

        if (result.nextModals !== modals) {
          setModals(result.nextModals);
        }

        return result.nextContexts;
      });
    },
    [
      componentIdMap,
      componentOwnershipIndexes.ownerContextByComponentId,
      componentOwnershipIndexes.parentByChildId,
      modals,
      selectedComponentId,
      setModals,
    ],
  );

  // Add modal handler - modals get added to modals list and create their own context
  const handleAddModal = useCallback(
    (modal: VdabComponent) => {
      const existingComponents = [
        ...Object.values(componentContexts).flat(),
        ...modals,
      ];
      const modalWithCodeName = assignCodeNameOnCreate(
        modal,
        existingComponents,
      );

      setModals((prev) => [...prev, modalWithCodeName]);
      setComponentContexts((prev) => ({
        ...prev,
        [getModalContextKey(modalWithCodeName.id)]: [],
      }));
    },
    [componentContexts, modals],
  );

  // Delete modal and all its child components
  const handleDeleteModal = useCallback(
    (modalId: string) => {
      removeComponentWithTab(modalId, { mode: "deleteSubtree" });
    },
    [removeComponentWithTab],
  );

  const removeTabFromTabsComponent = useCallback(
    (tabsComponentId: string, tabIndex: number) => {
      setComponentContexts((previousContexts) => {
        let locatedContextKey: string | null = null;
        let locatedTabsComponent: VdabComponent | null = null;

        for (const [contextKey, contextComponents] of Object.entries(
          previousContexts,
        )) {
          const candidate = contextComponents.find(
            (component) => component.id === tabsComponentId,
          );

          if (candidate?.type === ComponentType.Tabs) {
            locatedContextKey = contextKey;
            locatedTabsComponent = candidate;
            break;
          }
        }

        if (!locatedContextKey || !locatedTabsComponent) {
          return previousContexts;
        }

        const tabsValue = Array.isArray(locatedTabsComponent.props?.tabs)
          ? locatedTabsComponent.props.tabs.map((tabName) => String(tabName))
          : [];

        if (
          tabsValue.length <= 1 ||
          tabIndex < 0 ||
          tabIndex >= tabsValue.length
        ) {
          return previousContexts;
        }

        const contextComponents = previousContexts[locatedContextKey] || [];
        const componentMap = new Map<string, VdabComponent>(
          contextComponents.map((component) => [component.id, component]),
        );

        const tabChildRootIds = getNormalizedChildren(
          locatedTabsComponent.children,
        ).filter((childId) => {
          const child = componentMap.get(childId);
          return !!child && (getLayoutTabIndex(child.layout) ?? 0) === tabIndex;
        });

        const idsToDelete = new Set<string>();
        tabChildRootIds.forEach((childId) => {
          idsToDelete.add(childId);
          const descendants = collectDescendantIds(childId, componentMap);
          descendants.forEach((descendantId) => idsToDelete.add(descendantId));
        });

        const remainingTabNames = tabsValue.filter(
          (_, idx) => idx !== tabIndex,
        );
        const remainingTabChildren = getNormalizedChildren(
          locatedTabsComponent.children,
        ).filter((childId) => !idsToDelete.has(childId));
        const remainingTabChildSet = new Set(remainingTabChildren);

        let nextContextComponents = contextComponents
          .filter((component) => !idsToDelete.has(component.id))
          .map((component) => {
            if (component.id === tabsComponentId) {
              return {
                ...component,
                props: {
                  ...component.props,
                  tabs: remainingTabNames,
                },
                children: remainingTabChildren,
              };
            }

            if (!remainingTabChildSet.has(component.id)) {
              return component;
            }

            const existingTabIndex = getLayoutTabIndex(component.layout);
            if (
              typeof existingTabIndex === "number" &&
              existingTabIndex > tabIndex
            ) {
              return {
                ...component,
                layout: createTabChildLayout(
                  existingTabIndex - 1,
                  getLayoutY(component.layout),
                ),
              };
            }

            return component;
          });

        const nextContextsBase = {
          ...previousContexts,
          [locatedContextKey]: nextContextComponents,
        };

        const updatedTabsParent = nextContextComponents.find(
          (component) => component.id === tabsComponentId,
        );

        if (updatedTabsParent) {
          nextContextComponents = updateOrderedChildLayouts(
            nextContextsBase,
            modals,
            locatedContextKey,
            updatedTabsParent,
          )[locatedContextKey];
        }

        if (idsToDelete.size > 0) {
          setDeletedComponentIds((previousDeleted) => {
            const nextDeleted = new Set(previousDeleted);
            idsToDelete.forEach((deletedId) => {
              const backendId = componentIdMap.get(deletedId);
              if (backendId) {
                nextDeleted.add(backendId);
              }
            });
            return nextDeleted;
          });
        }

        if (selectedComponentId && idsToDelete.has(selectedComponentId)) {
          setSelectedComponentId(null);
        }

        return {
          ...previousContexts,
          [locatedContextKey]: nextContextComponents,
        };
      });
    },
    [componentIdMap, modals, selectedComponentId],
  );

  return {
    componentContexts,
    setComponentContexts,
    modals,
    setModals,
    componentIdMap,
    setComponentIdMap,
    deletedComponentIds,
    setDeletedComponentIds,
    selectedComponentId,
    setSelectedComponentId,
    getAllComponents,
    componentOwnershipIndexes,
    findComponent,
    updateComponent,
    addComponent,
    removeComponent,
    removeComponentWithTab,
    moveComponent,
    removeTabFromTabsComponent,
    handleAddModal,
    handleDeleteModal,
  };
};
