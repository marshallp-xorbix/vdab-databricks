import { useCallback, useRef, useState } from "react";
import type {
  Active,
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  Over,
} from "@dnd-kit/core";
import type { ComponentRegistryResponse } from "../providers/CanvasApi";
import type { ComponentCategory, VdabComponent } from "../types/components";
import { type CanvasContextType } from "../types/editor";
import { ComponentType } from "../types/components/componentTypes";
import type { AddComponentOptions } from "../types/components/componentOperations";
import type {
  ComponentDragData,
  DropIndicator,
  LayoutDropBlocked,
} from "../types/dnd";
import { toast } from "../components/ui/use-toast";
import {
  createLayout,
  createTabChildLayout,
  getTopLevelComponents,
} from "../utils/layoutUtils";
import { getLayoutDropError } from "../utils/dndLayoutRules";
import { buildVdabComponentFromRegistryEntry } from "../utils/dndComponentFactory";
import {
  isSameIndicator,
  isSameLayoutDropBlocked,
} from "../utils/dndIndicatorEquality";
import {
  getComponentsForContext,
  getContextKeyForCanvas,
} from "../utils/componentOrganization";
import {
  toCanonicalComponentCategory,
  toCanonicalComponentType,
} from "../utils/componentEnumGuards";
import {
  getDraggedTypeForLayoutRules,
  readComponentDragData,
  readSortableIndexData,
} from "../utils/dndPayload";
import { getRegistryDefinitionType } from "../utils/registryComponentUtils";
import {
  getCanvasSortableContainerId,
  getExpanderSortableContainerId,
  getFormSortableContainerId,
  getTabsSortableContainerId,
  parseSortableContainerId,
} from "../utils/sortableContainerIds";
import { useLogger } from "../logger/useLogger";

function showInvalidLayoutDropToast(description: string): void {
  toast({
    variant: "destructive",
    title: "Cannot drop here",
    description,
    duration: 5000,
  });
}

interface UseComponentDragDropOptions {
  registry: ComponentRegistryResponse | null;
  formComponents: VdabComponent[];
  contextType: CanvasContextType;
  modalId?: string;
  isEnabled?: boolean;
  onMoveComponent: (
    componentId: string,
    target: {
      contextKey: string;
      parentId?: string;
      childIndex?: number;
      tabIndex?: number;
    },
  ) => void;
  onAddComponent: (
    component: VdabComponent,
    contextType: CanvasContextType,
    modalId?: string,
    options?: AddComponentOptions,
  ) => void;
}

export const useComponentDragDrop = ({
  registry,
  formComponents,
  contextType,
  modalId,
  isEnabled = true,
  onMoveComponent,
  onAddComponent,
}: UseComponentDragDropOptions) => {
  const logger = useLogger("useComponentDragDrop");
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null,
  );
  const [layoutDropBlocked, setLayoutDropBlocked] =
    useState<LayoutDropBlocked | null>(null);
  const lastIndicatorRef = useRef<DropIndicator | null>(null);
  const lastLayoutDropBlockedRef = useRef<LayoutDropBlocked | null>(null);

  const clearDragVisualState = useCallback(() => {
    if (lastIndicatorRef.current) {
      lastIndicatorRef.current = null;
      setDropIndicator(null);
    }
    if (lastLayoutDropBlockedRef.current) {
      lastLayoutDropBlockedRef.current = null;
      setLayoutDropBlocked(null);
    }
  }, []);

  const finalizeDrag = useCallback(() => {
    clearDragVisualState();
  }, [clearDragVisualState]);

  const getRegistryComponent = useCallback(
    (componentType: string): VdabComponent | undefined => {
      if (!registry?.components) {
        return undefined;
      }
      const wanted = toCanonicalComponentType(componentType);
      if (wanted == null) {
        return undefined;
      }
      return registry.components.find(
        (entry) =>
          toCanonicalComponentType(getRegistryDefinitionType(entry)) === wanted,
      );
    },
    [registry],
  );

  const addComponentToCanvas = useCallback(
    (data: ComponentDragData, targetIndex?: number) => {
      if (data.dragType !== "new") {
        return;
      }
      const typeString = String(data.type);
      const categoryString = String(data.category);
      const type = toCanonicalComponentType(typeString);
      const category = toCanonicalComponentCategory(categoryString);
      if (type == null || category == null) {
        showInvalidLayoutDropToast(
          "Invalid component type or category from palette.",
        );
        return;
      }
      const registryEntry = getRegistryComponent(type);

      const newComponent = buildVdabComponentFromRegistryEntry({
        type,
        category,
        registryEntry,
      });

      const options: AddComponentOptions | undefined =
        typeof targetIndex === "number"
          ? { childIndex: targetIndex }
          : undefined;
      onAddComponent(newComponent, contextType, modalId, options);
    },
    [contextType, getRegistryComponent, modalId, onAddComponent],
  );

  const handleDropInLayout = useCallback(
    (
      parentId: string,
      index: number,
      droppedData: ComponentDragData,
      tabIndex?: number,
    ) => {
      let typeForInsert: ComponentType;
      let categoryForInsert: ComponentCategory;

      if (droppedData.dragType === "new") {
        const typeString = String(droppedData.type);
        const categoryString = String(droppedData.category);
        const type = toCanonicalComponentType(typeString);
        const category = toCanonicalComponentCategory(categoryString);
        if (type == null || category == null) {
          showInvalidLayoutDropToast(
            "Invalid component type or category from palette.",
          );
          return;
        }
        typeForInsert = type;
        categoryForInsert = category;
      } else {
        typeForInsert = droppedData.type;
        categoryForInsert = droppedData.category;
      }

      const registryEntry = getRegistryComponent(typeForInsert);

      const parentComponent = formComponents.find(
        (comp) => comp.id === parentId,
      );

      if (!parentComponent) {
        logger.UI.error(
          "[useComponentDragDrop] Parent component not found:",
          parentId,
        );
        return;
      }

      let childLayout: string | undefined = undefined;

      if (
        parentComponent.type === ComponentType.Form ||
        parentComponent.type === ComponentType.Expander
      ) {
        childLayout = createLayout(index - 0.5);
      } else if (
        parentComponent.type === ComponentType.Rows ||
        parentComponent.type === ComponentType.Columns
      ) {
        childLayout = createLayout(index);
      } else if (parentComponent.type === ComponentType.Tabs) {
        const tabIdx = typeof tabIndex === "number" ? tabIndex : 0;
        childLayout = createTabChildLayout(tabIdx, index - 0.5);
      }

      const newComponent = buildVdabComponentFromRegistryEntry({
        type: typeForInsert,
        category: categoryForInsert,
        registryEntry,
        layout: childLayout,
      });

      onAddComponent(newComponent, contextType, modalId, {
        parentId,
        childIndex: index,
        tabIndex,
      });
    },
    [
      contextType,
      formComponents,
      getRegistryComponent,
      logger,
      modalId,
      onAddComponent,
    ],
  );

  // NOTE: indicator equality helpers are imported from `utils/dndIndicatorEquality`.

  const getCanvasDropEndIndex = useCallback((): number => {
    const contextComponents = getComponentsForContext(
      formComponents,
      contextType,
      modalId,
    );
    return getTopLevelComponents(contextComponents).length;
  }, [contextType, formComponents, modalId]);

  const resolveDropStateFromOver = useCallback(
    (
      over: Over | null,
      dragData: ComponentDragData,
      active?: Active,
    ): {
      indicator: DropIndicator | null;
      layoutDropBlocked: LayoutDropBlocked | null;
    } => {
      if (!over) {
        return { indicator: null, layoutDropBlocked: null };
      }

      const targetContextKey = getContextKeyForCanvas(contextType, modalId);
      const draggedType = getDraggedTypeForLayoutRules(dragData);
      const overData = over.data.current;
      const overSortable = readSortableIndexData(overData);
      const activeCenterY =
        active?.rect.current.translated != null
          ? active.rect.current.translated.top +
            active.rect.current.translated.height / 2
          : null;

      const getContextCanvasElement = (): HTMLElement | null => {
        const canvases = document.querySelectorAll<HTMLElement>(
          "[data-drop-scope='canvas']",
        );
        for (const canvas of canvases) {
          if (canvas.dataset.contextKey === targetContextKey) {
            return canvas;
          }
        }
        return null;
      };

      const getSortableElementsForContainer = (
        containerId: string,
      ): HTMLElement[] => {
        const parsed = parseSortableContainerId(containerId);
        if (!parsed) {
          return [];
        }
        const contextCanvas = getContextCanvasElement();
        const scope: ParentNode = contextCanvas ?? document;
        if (parsed.type === "canvas") {
          return Array.from(
            scope.querySelectorAll<HTMLElement>("[data-sortable-parent='canvas']"),
          );
        }
        if (parsed.type === "tabs") {
          return Array.from(
            scope.querySelectorAll<HTMLElement>(
              `[data-sortable-parent='${parsed.parentId}-tab-${parsed.tabIndex}']`,
            ),
          );
        }
        return Array.from(
          scope.querySelectorAll<HTMLElement>(
            `[data-sortable-parent='${parsed.parentId}']`,
          ),
        );
      };

      const computeInsertionIndexFromMidpoint = (
        containerId: string,
        fallbackIndex: number,
      ): number => {
        if (activeCenterY == null) {
          return fallbackIndex;
        }
        const elements = getSortableElementsForContainer(containerId);
        if (elements.length === 0) {
          return 0;
        }

        const sorted = elements
          .map((element) => {
            const sortableId = element.dataset.sortableId ?? "";
            return { sortableId, rect: element.getBoundingClientRect() };
          })
          .filter(({ sortableId }) => {
            if (!sortableId) return false;
            return !(
              dragData.dragType === "existing" &&
              sortableId === dragData.componentId
            );
          })
          .sort((left, right) => left.rect.top - right.rect.top);

        if (sorted.length === 0) {
          return 0;
        }

        for (let index = 0; index < sorted.length; index += 1) {
          const rect = sorted[index].rect;
          const midpoint = rect.top + rect.height / 2;
          if (activeCenterY <= midpoint) {
            return index;
          }
        }

        return sorted.length;
      };

      if (overSortable) {
        const parsed = parseSortableContainerId(overSortable.containerId);
        if (!parsed) {
          return { indicator: null, layoutDropBlocked: null };
        }
        const insertionIndex =
          dragData.dragType === "existing"
            ? overSortable.index
            : computeInsertionIndexFromMidpoint(
                overSortable.containerId,
                overSortable.index,
              );

        if (parsed.type === "canvas") {
          if (parsed.contextKey !== targetContextKey) {
            return { indicator: null, layoutDropBlocked: null };
          }
          return {
            indicator: {
              dropType: "canvas",
              contextKey: targetContextKey,
              index: insertionIndex,
            },
            layoutDropBlocked: null,
          };
        }

        const layoutType =
          parsed.type === "form"
            ? ComponentType.Form
            : parsed.type === "expander"
              ? ComponentType.Expander
              : ComponentType.Tabs;

        const dropError =
          draggedType != null ? getLayoutDropError(layoutType, draggedType) : null;
        if (dropError) {
          return {
            indicator: null,
            layoutDropBlocked: {
              contextKey: targetContextKey,
              parentId: parsed.parentId,
              layoutType,
            },
          };
        }

        if (parsed.type === "tabs") {
          return {
            indicator: {
              dropType: "layout",
              contextKey: targetContextKey,
              parentId: parsed.parentId,
              index: insertionIndex,
              layoutType: ComponentType.Tabs,
              tabIndex: parsed.tabIndex,
            },
            layoutDropBlocked: null,
          };
        }

        return {
          indicator: {
            dropType: "layout",
            contextKey: targetContextKey,
            parentId: parsed.parentId,
            index: insertionIndex,
            layoutType,
          },
          layoutDropBlocked: null,
        };
      }

      const overDropData = overData as Partial<{
        dropType: "canvas" | "layout";
        parentId: string;
        index: number;
        layoutType: ComponentType;
        tabIndex?: number;
      }>;

      if (overDropData.dropType === "canvas") {
        const canvasContainerId = getCanvasSortableContainerId(targetContextKey);
        return {
          indicator: {
            dropType: "canvas",
            contextKey: targetContextKey,
            index: computeInsertionIndexFromMidpoint(
              canvasContainerId,
              getCanvasDropEndIndex(),
            ),
          },
          layoutDropBlocked: null,
        };
      }

      if (
        overDropData.dropType === "layout" &&
        typeof overDropData.parentId === "string" &&
        typeof overDropData.index === "number" &&
        overDropData.layoutType !== undefined
      ) {
        const layoutContainerId =
          overDropData.layoutType === ComponentType.Form
            ? getFormSortableContainerId(overDropData.parentId)
            : overDropData.layoutType === ComponentType.Expander
              ? getExpanderSortableContainerId(overDropData.parentId)
              : overDropData.layoutType === ComponentType.Tabs &&
                  typeof overDropData.tabIndex === "number"
                ? getTabsSortableContainerId(
                    overDropData.parentId,
                    overDropData.tabIndex,
                  )
                : null;
        const insertionIndex =
          layoutContainerId != null
            ? computeInsertionIndexFromMidpoint(
                layoutContainerId,
                overDropData.index,
              )
            : overDropData.index;

        const dropError =
          draggedType != null
            ? getLayoutDropError(overDropData.layoutType, draggedType)
            : null;
        if (dropError) {
          return {
            indicator: null,
            layoutDropBlocked: {
              contextKey: targetContextKey,
              parentId: overDropData.parentId,
              layoutType: overDropData.layoutType,
            },
          };
        }

        if (overDropData.layoutType === ComponentType.Tabs) {
          return {
            indicator:
              typeof overDropData.tabIndex === "number"
                ? {
                    dropType: "layout",
                    contextKey: targetContextKey,
                    parentId: overDropData.parentId,
                    index: insertionIndex,
                    layoutType: ComponentType.Tabs,
                    tabIndex: overDropData.tabIndex,
                  }
                : null,
            layoutDropBlocked: null,
          };
        }

        return {
          indicator: {
            dropType: "layout",
            contextKey: targetContextKey,
            parentId: overDropData.parentId,
            index: insertionIndex,
            layoutType: overDropData.layoutType,
          },
          layoutDropBlocked: null,
        };
      }

      return { indicator: null, layoutDropBlocked: null };
    },
    [contextType, getCanvasDropEndIndex, modalId],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!isEnabled) return;
      clearDragVisualState();

      const dragData = readComponentDragData(event.active.data.current);
      if (!dragData) {
        return;
      }
      const next = resolveDropStateFromOver(event.over, dragData, event.active);
      lastIndicatorRef.current = next.indicator;
      setDropIndicator(next.indicator);
      lastLayoutDropBlockedRef.current = next.layoutDropBlocked;
      setLayoutDropBlocked(next.layoutDropBlocked);
    },
    [
      clearDragVisualState,
      isEnabled,
      resolveDropStateFromOver,
    ],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!isEnabled) return;

      const dragData = readComponentDragData(event.active.data.current);
      if (!dragData) {
        return;
      }

      const next = resolveDropStateFromOver(event.over, dragData, event.active);

      if (!isSameIndicator(next.indicator, lastIndicatorRef.current)) {
        lastIndicatorRef.current = next.indicator;
        setDropIndicator(next.indicator);
      }

      if (
        !isSameLayoutDropBlocked(
          next.layoutDropBlocked,
          lastLayoutDropBlockedRef.current,
        )
      ) {
        lastLayoutDropBlockedRef.current = next.layoutDropBlocked;
        setLayoutDropBlocked(next.layoutDropBlocked);
      }
    },
    [isEnabled, resolveDropStateFromOver],
  );

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      finalizeDrag();
    },
    [finalizeDrag],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!isEnabled) return;

      const dragData = readComponentDragData(event.active.data.current);

      if (!dragData) {
        finalizeDrag();
        return;
      }

      const draggedType = getDraggedTypeForLayoutRules(dragData);
      if (draggedType == null) {
        showInvalidLayoutDropToast(
          "Unable to resolve dragged component type for this drop.",
        );
        finalizeDrag();
        return;
      }

      const next = resolveDropStateFromOver(event.over, dragData, event.active);

      const targetContextKey = getContextKeyForCanvas(contextType, modalId);

      // Sortable is authoritative for same-container reorders, but only when
      // pointer-based DOM targeting is NOT resolving to an explicit layout slot/container target.
      if (
        dragData.dragType === "existing" &&
        event.over &&
        next.indicator?.dropType !== "layout"
      ) {
        const activeSortable = readSortableIndexData(event.active.data.current);
        const overSortable = readSortableIndexData(event.over.data.current);

        if (
          activeSortable &&
          overSortable &&
          activeSortable.containerId === overSortable.containerId &&
          activeSortable.index !== overSortable.index
        ) {
          const parsedContainer = parseSortableContainerId(
            activeSortable.containerId,
          );

          if (parsedContainer) {
            if (parsedContainer.type === "canvas") {
              onMoveComponent(dragData.componentId, {
                contextKey: targetContextKey,
                childIndex: overSortable.index,
              });
              finalizeDrag();
              return;
            }

            if (
              parsedContainer.type === "form" ||
              parsedContainer.type === "expander"
            ) {
              onMoveComponent(dragData.componentId, {
                contextKey: targetContextKey,
                parentId: parsedContainer.parentId,
                childIndex: overSortable.index,
              });
              finalizeDrag();
              return;
            }

            if (parsedContainer.type === "tabs") {
              onMoveComponent(dragData.componentId, {
                contextKey: targetContextKey,
                parentId: parsedContainer.parentId,
                childIndex: overSortable.index,
                tabIndex: parsedContainer.tabIndex,
              });
              finalizeDrag();
              return;
            }
          }
        }
      }

      const blockedForCanvas =
        next.layoutDropBlocked?.contextKey === targetContextKey
          ? next.layoutDropBlocked
          : null;

      const blockedDropError =
        blockedForCanvas != null
          ? getLayoutDropError(blockedForCanvas.layoutType, draggedType)
          : null;

      const abortIfDropError = (error: string | null): boolean => {
        if (!error) return false;
        showInvalidLayoutDropToast(error);
        finalizeDrag();
        return true;
      };

      if (blockedForCanvas && abortIfDropError(blockedDropError)) return;

      const resolvedIndicator =
        next.indicator && next.indicator.contextKey === targetContextKey
          ? next.indicator
          : null;

      if (dragData.dragType === "existing") {
        if (resolvedIndicator?.dropType === "canvas") {
          onMoveComponent(dragData.componentId, {
            contextKey: targetContextKey,
            childIndex: resolvedIndicator.index,
          });
          finalizeDrag();
          return;
        }

        if (resolvedIndicator?.dropType === "layout") {
          const dropError = getLayoutDropError(
            resolvedIndicator.layoutType,
            draggedType,
          );
          if (abortIfDropError(dropError)) return;

          onMoveComponent(dragData.componentId, {
            contextKey: targetContextKey,
            parentId: resolvedIndicator.parentId,
            childIndex: resolvedIndicator.index,
            tabIndex:
              resolvedIndicator.layoutType === ComponentType.Tabs
                ? resolvedIndicator.tabIndex
                : undefined,
          });
          finalizeDrag();
          return;
        }
        finalizeDrag();
        return;
      }

      if (resolvedIndicator?.dropType === "canvas") {
        addComponentToCanvas(dragData, resolvedIndicator.index);
        finalizeDrag();
        return;
      }

      if (resolvedIndicator?.dropType === "layout") {
        const dropError = getLayoutDropError(
          resolvedIndicator.layoutType,
          draggedType,
        );
        if (abortIfDropError(dropError)) return;

        handleDropInLayout(
          resolvedIndicator.parentId,
          resolvedIndicator.index,
          dragData,
          resolvedIndicator.layoutType === ComponentType.Tabs
            ? resolvedIndicator.tabIndex
            : undefined,
        );
        finalizeDrag();
        return;
      }

      finalizeDrag();
    },
    [
      addComponentToCanvas,
      contextType,
      finalizeDrag,
      handleDropInLayout,
      isEnabled,
      modalId,
      onMoveComponent,
      resolveDropStateFromOver,
    ],
  );

  return {
    dropIndicator,
    layoutDropBlocked,
    handleDragStart,
    handleDragMove,
    handleDragCancel,
    handleDragEnd,
  };
};
