import { useMemo, useState, type FC } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableItemWrapper from "../../dnd/SortableItemWrapper";
import type { VdabComponent } from "../../../types/components/vdabComponent";
import { ComponentType } from "../../../types/components/componentTypes";
import type { ChildRenderOptions, DropTargetData } from "../../../types/dnd";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import {
  getLayoutTabIndex,
  sortComponentsByLayout,
} from "../../../utils/layoutUtils";
import { getTabsSortableContainerId } from "../../../utils/sortableContainerIds";
import { InvalidLayoutDropOverlay } from "../helpers";
import { useSortableDragState } from "../../../hooks/useSortableDragState";

interface TabsProps {
  tabs?: string[];
  defaultTabIndex?: number;
}

interface TabPaneDropZoneProps {
  tabIndex: number;
  parentId: string;
  childComponents: VdabComponent[];
  selectedComponentId?: string;
  onSelect: (id: string) => void;
  renderChild?: (
    component: VdabComponent,
    options?: ChildRenderOptions,
  ) => React.ReactNode;
  dropIndicator?: VdabCanvasRendererProps["dropIndicator"];
  layoutDropBlocked?: VdabCanvasRendererProps["layoutDropBlocked"];
}

const TabPaneDropZone: FC<TabPaneDropZoneProps> = ({
  tabIndex,
  parentId,
  childComponents,
  selectedComponentId,
  onSelect,
  renderChild,
  dropIndicator,
  layoutDropBlocked,
}) => {
  const sortedChildren = sortComponentsByLayout(childComponents);
  const sortableContainerId = getTabsSortableContainerId(parentId, tabIndex);

  const { isOver, setNodeRef } = useDroppable({
    id: `tabs-pane-${parentId}-${tabIndex}`,
    data: {
      dropType: "layout",
      parentId,
      index: sortedChildren.length,
      layoutType: ComponentType.Tabs,
      tabIndex,
    } satisfies DropTargetData,
  });
  const indicatorIndex =
    dropIndicator?.dropType === "layout" &&
    dropIndicator.parentId === parentId &&
    dropIndicator.layoutType === ComponentType.Tabs &&
    dropIndicator.tabIndex === tabIndex
      ? dropIndicator.index
      : null;
  const { isSameContainerDrag: isSameTabsSortableDrag } =
    useSortableDragState(sortableContainerId);
  const showTabInsertionIndicator =
    indicatorIndex !== null && !isSameTabsSortableDrag;
  const isLayoutBlocked =
    !!layoutDropBlocked &&
    layoutDropBlocked.parentId === parentId &&
    layoutDropBlocked.layoutType === ComponentType.Tabs;
  const showTabTargetHighlight =
    !!isLayoutBlocked ||
    (dropIndicator?.dropType === "layout" &&
      dropIndicator.parentId === parentId &&
      dropIndicator.layoutType === ComponentType.Tabs &&
      dropIndicator.tabIndex === tabIndex);

  return (
    <div
      ref={setNodeRef}
      className={`relative space-y-3 min-h-[100px] p-3 border border-dashed rounded-lg transition-colors ${
        isLayoutBlocked
          ? "overflow-hidden border-destructive/50 bg-destructive/[0.06]"
          : showTabTargetHighlight || isOver
            ? "border-primary/50 bg-primary/10"
            : "border-input"
      }`}
      data-drop-scope="layout"
      data-layout-type={ComponentType.Tabs}
      data-parent-id={parentId}
      data-tab-index={tabIndex}
    >
      {isLayoutBlocked ? (
        <InvalidLayoutDropOverlay className="rounded-lg" />
      ) : null}
      {sortedChildren.length === 0 ? (
        <>
          {showTabInsertionIndicator && indicatorIndex === 0 ? (
            <div className="h-2 rounded-md border border-primary/40 bg-primary/20" />
          ) : null}
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm gap-2">
            Drop components here
          </div>
        </>
      ) : (
        <SortableContext
          id={sortableContainerId}
          items={sortedChildren.map((child) => child.id)}
          strategy={verticalListSortingStrategy}
        >
          <>
            {sortedChildren.map((child, index) => (
              <div key={child.id}>
                {showTabInsertionIndicator && indicatorIndex === index ? (
                  <div className="mb-2 h-2 rounded-md border border-primary/40 bg-primary/20" />
                ) : null}
                <SortableItemWrapper
                  component={child}
                  sortableParent={`${parentId}-tab-${tabIndex}`}
                >
                  {({ sortableHandle, disableInternalDrag }) => (
                    <div
                      className={`relative cursor-pointer transition-all ${
                        selectedComponentId === child.id
                          ? "ring-2 ring-primary ring-offset-2"
                          : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(child.id);
                      }}
                    >
                      {renderChild
                        ? renderChild(child, {
                            sortableHandle,
                            disableInternalDrag,
                          })
                        : null}
                    </div>
                  )}
                </SortableItemWrapper>
              </div>
            ))}
            {showTabInsertionIndicator &&
            indicatorIndex === sortedChildren.length ? (
              <div className="h-2 rounded-md border border-primary/40 bg-primary/20" />
            ) : null}
          </>
        </SortableContext>
      )}
    </div>
  );
};

const TabsRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme = {},
  allComponents = [],
  selectedComponentId,
  onSelect = () => {},
  renderChild,
  dropIndicator,
  layoutDropBlocked,
}) => {
  const primaryColor = theme.primaryColor || "var(--primary)";
  const textColor = theme.textColor || "#6b7280";
  const props = component.props as TabsProps;
  const tabLabels: string[] =
    Array.isArray(props.tabs) && props.tabs.length > 0
      ? props.tabs
      : ["Tab 1", "Tab 2"];
  const [activeTabIndex, setActiveTabIndex] = useState<number>(
    props.defaultTabIndex ?? 0,
  );

  const allChildIds = component.children || [];
  const componentsById = useMemo(
    () =>
      new Map(
        allComponents.map((childComponent) => [
          childComponent.id,
          childComponent,
        ]),
      ),
    [allComponents],
  );

  const childrenByTabIndex = useMemo(() => {
    const groupedChildren = new Map<number, VdabComponent[]>();

    allChildIds.forEach((childId) => {
      const childComponent = componentsById.get(childId);
      if (!childComponent) {
        return;
      }

      const tabIdx = getLayoutTabIndex(childComponent.layout) ?? 0;
      const tabChildren = groupedChildren.get(tabIdx);
      if (tabChildren) {
        tabChildren.push(childComponent);
      } else {
        groupedChildren.set(tabIdx, [childComponent]);
      }
    });

    return groupedChildren;
  }, [allChildIds, componentsById]);

  const getChildrenForTab = (tabIdx: number): VdabComponent[] =>
    childrenByTabIndex.get(tabIdx) ?? [];

  return (
    <div className="border border-border rounded-lg p-2">
      <div className="flex border-b border-input mb-3">
        {tabLabels.map((label, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveTabIndex(idx)}
            className="px-4 pb-2 pt-1 text-sm font-normal bg-transparent -mb-px"
            style={{
              color: idx === activeTabIndex ? primaryColor : textColor,
              borderBottom: `2px solid ${
                idx === activeTabIndex ? primaryColor : "transparent"
              }`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <TabPaneDropZone
        key={`${component.id}-tab-${activeTabIndex}`}
        tabIndex={activeTabIndex}
        parentId={component.id}
        childComponents={getChildrenForTab(activeTabIndex)}
        selectedComponentId={selectedComponentId}
        onSelect={onSelect}
        renderChild={renderChild}
        dropIndicator={dropIndicator}
        layoutDropBlocked={layoutDropBlocked}
      />
    </div>
  );
};

export default TabsRenderer;
