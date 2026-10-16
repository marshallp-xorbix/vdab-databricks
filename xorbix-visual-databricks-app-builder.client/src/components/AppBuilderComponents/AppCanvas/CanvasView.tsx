import { Fragment, useCallback, useMemo, type FC } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { VdabComponent } from "../../../types/components";
import { ComponentCategory as Category } from "../../../types/components/componentTypes";
import type { RemoveComponentOptions } from "../../../types/components/componentRemoval";
import { AppComponent } from "./AppComponent";
import { getLayoutY } from "../../../utils/layoutUtils";
import { PAGE_WIDTH_DEFAULT } from "../../../utils/pageWidthDefaults";
import type {
  DropTargetData,
  DropIndicator,
  LayoutDropBlocked,
} from "../../../types/dnd";
import SortableItemWrapper from "../../dnd/SortableItemWrapper";
import { getCanvasSortableContainerId } from "../../../utils/sortableContainerIds";
import { useSortableDragState } from "../../../hooks/useSortableDragState";
import { resolveAppThemeBackground } from "../AppSettingsTab/themeDefaults";
import { useTheme } from "../../../context/ThemeContext";

interface CanvasViewProps {
  contextComponents: VdabComponent[];
  formComponents: VdabComponent[];
  theme: Record<string, string>;
  selectedComponentId: string | null;
  onSelectComponent?: (id: string | null) => void;
  onRemoveComponent: (
    componentId: string,
    options?: RemoveComponentOptions,
  ) => void;
  dropIndicator?: DropIndicator | null;
  layoutDropBlocked?: LayoutDropBlocked | null;
  contextKey: string;
  workspaceUrl?: string | null;
  /** Max content width in pixels for Main Page WYSIWYG framing; omit for modal canvas. */
  pageWidth?: number;
}

const CanvasView: FC<CanvasViewProps> = ({
  contextComponents,
  formComponents,
  theme,
  selectedComponentId,
  onSelectComponent,
  onRemoveComponent,
  dropIndicator,
  layoutDropBlocked,
  contextKey,
  workspaceUrl = null,
  pageWidth,
}) => {
  const { theme: productTheme } = useTheme();
  const { isOver, setNodeRef } = useDroppable({
    id: "canvas-root",
    data: {
      dropType: "canvas",
    } satisfies DropTargetData,
  });

  const topLevelComponents = useMemo(() => {
    return contextComponents
      .filter((comp) => {
        if (comp.category === Category.Page) {
          return false;
        }

        const isChild = contextComponents.some((parent) =>
          parent.children?.includes(comp.id),
        );
        return !isChild;
      })
      .sort((a, b) => getLayoutY(a.layout) - getLayoutY(b.layout));
  }, [contextComponents]);

  const canvasSortableContainerId = getCanvasSortableContainerId(contextKey);
  const indicatorIndex =
    dropIndicator?.dropType === "canvas" &&
    dropIndicator.contextKey === contextKey
      ? dropIndicator.index
      : null;
  const { activeSortableContainerId, isSameContainerDrag: isSameCanvasSortableDrag } =
    useSortableDragState(canvasSortableContainerId);
  const isNestedSortableDrag =
    activeSortableContainerId !== null && !isSameCanvasSortableDrag;
  const showCanvasInsertionIndicator =
    indicatorIndex !== null && !isSameCanvasSortableDrag && !isNestedSortableDrag;
  const hasActiveLayoutTarget =
    dropIndicator?.dropType === "layout" && dropIndicator.contextKey === contextKey;

  const blockedForThisCanvas =
    layoutDropBlocked?.contextKey === contextKey ? layoutDropBlocked : null;
  const removeChildFromLayout = useCallback(
    (_parentId: string, childId: string) => {
      onRemoveComponent(childId);

      if (selectedComponentId === childId) {
        onSelectComponent?.(null);
      }
    },
    [onRemoveComponent, onSelectComponent, selectedComponentId],
  );

  const removeComponent = useCallback(
    (componentId: string) => {
      onRemoveComponent(componentId);
    },
    [onRemoveComponent],
  );
  const handleClearSelection = useCallback(() => {
    onSelectComponent?.(null);
  }, [onSelectComponent]);

  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        onSelectComponent?.(null);
      }
    },
    [onSelectComponent],
  );

  const isPageContext = pageWidth !== undefined;
  const contentMaxWidth = pageWidth ?? PAGE_WIDTH_DEFAULT;
  const isPageSelected = isPageContext && selectedComponentId === null;
  const canvasBackground = resolveAppThemeBackground(theme, productTheme);

  return (
    <div
      ref={setNodeRef}
      className={`relative h-full min-h-0 flex-1 border-t border-[var(--builder-chrome-border)] p-2 transition-colors overflow-y-auto overscroll-none scrollbar-hide ${
        isOver && !hasActiveLayoutTarget
          ? "border-t border-primary bg-primary/5"
          : ""
      }`}
      data-drop-scope="canvas"
      data-context-key={contextKey}
      role="grid"
      aria-label="Canvas drop zone"
      tabIndex={0}
      style={{
        backgroundColor: isOver && !hasActiveLayoutTarget
          ? canvasBackground + "0D"
          : canvasBackground,
        scrollbarGutter: "auto",
        scrollbarWidth: "thin",
        overscrollBehaviorY: "none",
      }}
      onKeyDown={handleCanvasKeyDown}
    >
      <button
        type="button"
        aria-label="Clear selection"
        className="absolute inset-0 z-0 cursor-default"
        onClick={handleClearSelection}
      />
      <div
        className={
          isPageContext
            ? `relative z-10 mx-auto w-full rounded-sm border border-dashed transition-shadow ${
                isPageSelected
                  ? "border-primary/50 ring-1 ring-primary/30"
                  : "border-border/80"
              }`
            : "relative z-10"
        }
        style={isPageContext ? { maxWidth: contentMaxWidth } : undefined}
      >
        {contextComponents.length === 0 ? (
          <div className="h-full flex items-center justify-center"></div>
        ) : (
          <SortableContext
            id={canvasSortableContainerId}
            items={topLevelComponents.map((component) => component.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4 p-2">
              {topLevelComponents.map((component, index) => (
                <Fragment key={component.id}>
                  {showCanvasInsertionIndicator && indicatorIndex === index && (
                    <div className="h-2 rounded-md border border-primary/40 bg-primary/20" />
                  )}
                  <SortableItemWrapper
                    component={component}
                    sortableParent="canvas"
                  >
                    {({ sortableHandle, disableInternalDrag }) => (
                      <AppComponent
                        component={component}
                        theme={theme}
                        onRemove={() => removeComponent(component.id)}
                        onSelect={onSelectComponent || (() => {})}
                        isSelected={selectedComponentId === component.id}
                        selectedComponentId={selectedComponentId ?? undefined}
                        allComponents={formComponents}
                        onRemoveChildFromLayout={removeChildFromLayout}
                        dropIndicator={dropIndicator}
                        layoutDropBlocked={blockedForThisCanvas}
                        sortableHandle={sortableHandle}
                        disableInternalDrag={disableInternalDrag}
                        workspaceUrl={workspaceUrl}
                      />
                    )}
                  </SortableItemWrapper>
                </Fragment>
              ))}
              {showCanvasInsertionIndicator &&
                indicatorIndex === topLevelComponents.length && (
                <div className="h-2 rounded-md border border-primary/40 bg-primary/20" />
                )}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
};

export default CanvasView;
