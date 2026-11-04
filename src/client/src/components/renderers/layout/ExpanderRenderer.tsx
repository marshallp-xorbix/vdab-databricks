import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState, type FC } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableItemWrapper from "../../dnd/SortableItemWrapper";
import type { VdabComponent } from "../../../types/components/vdabComponent";
import { ComponentType } from "../../../types/components/componentTypes";
import type { DropTargetData } from "../../../types/dnd";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { sortComponentsByLayout } from "../../../utils/layoutUtils";
import { getOutlineColor } from "../../../utils/themeUtils";
import { getExpanderSortableContainerId } from "../../../utils/sortableContainerIds";
import { InvalidLayoutDropOverlay } from "../helpers";
import { useSortableDragState } from "../../../hooks/useSortableDragState";

interface ExpanderProps {
  sectionTitle?: string;
  defaultExpanded?: boolean;
}

const ExpanderRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme = {},
  allComponents = [],
  selectedComponentId,
  onSelect = () => {},
  renderChild,
  dropIndicator,
  layoutDropBlocked,
}) => {
  const props = component.props as ExpanderProps;
  const sectionTitle = props.sectionTitle || "Section";
  const primaryColor = theme.primaryColor || "var(--primary)";
  const textColor = theme.textColor || "#334155";
  const backgroundColor = theme.backgroundColor || "transparent";
  const outlineColor = getOutlineColor(textColor);
  const children = component.children || [];
  const [isExpanded, setIsExpanded] = useState<boolean>(
    props.defaultExpanded ?? false,
  );
  const [isHeaderHovered, setIsHeaderHovered] = useState<boolean>(false);

  useEffect(() => {
    setIsExpanded(props.defaultExpanded ?? false);
  }, [props.defaultExpanded]);

  const allComponentsById = useMemo(
    () => new Map(allComponents.map((child) => [child.id, child])),
    [allComponents],
  );

  const sortedChildren = useMemo(() => {
    const childComponents = children
      .map((childId) => allComponentsById.get(childId))
      .filter((child): child is VdabComponent => child !== undefined);

    return sortComponentsByLayout(childComponents);
  }, [allComponentsById, children]);

  const { isOver, setNodeRef } = useDroppable({
    id: `expander-${component.id}`,
    data: {
      dropType: "layout",
      parentId: component.id,
      index: children.length,
      layoutType: ComponentType.Expander,
    } satisfies DropTargetData,
  });

  const sortableContainerId = getExpanderSortableContainerId(component.id);
  const indicatorIndex =
    dropIndicator?.dropType === "layout" &&
    dropIndicator.parentId === component.id &&
    dropIndicator.layoutType === ComponentType.Expander
      ? dropIndicator.index
      : null;
  const { isSameContainerDrag: isSameExpanderSortableDrag } =
    useSortableDragState(sortableContainerId);
  const showExpanderInsertionIndicator =
    indicatorIndex !== null && !isSameExpanderSortableDrag;
  const isLayoutBlocked =
    !!layoutDropBlocked &&
    layoutDropBlocked.parentId === component.id &&
    layoutDropBlocked.layoutType === ComponentType.Expander;
  const showExpanderTargetHighlight =
    !!isLayoutBlocked ||
    (dropIndicator?.dropType === "layout" &&
      dropIndicator.parentId === component.id &&
      dropIndicator.layoutType === ComponentType.Expander);

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ backgroundColor, borderColor: outlineColor }}
    >
      <button
        type="button"
        className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-muted ${
          isExpanded ? "border-b" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(component.id);
          setIsExpanded((prev) => !prev);
        }}
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        style={
          isExpanded
            ? { backgroundColor, borderBottomColor: outlineColor }
            : { backgroundColor }
        }
      >
        <span
          className="text-sm font-medium transition-colors"
          style={{ color: isHeaderHovered ? primaryColor : textColor }}
        >
          {sectionTitle}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform transition-colors ${
            isExpanded ? "rotate-180" : "rotate-0"
          }`}
          style={{ color: isHeaderHovered ? primaryColor : textColor }}
        />
      </button>

      {isExpanded && (
        <div
          className={`relative m-2 space-y-3 min-h-[100px] p-3 border border-dashed rounded-lg transition-colors ${
            isLayoutBlocked
              ? "overflow-hidden border-destructive/50 bg-destructive/[0.06]"
              : showExpanderTargetHighlight || isOver
                ? "border-primary/50 bg-primary/10"
                : "border-input"
          }`}
          ref={setNodeRef}
          data-drop-scope="layout"
          data-layout-type={ComponentType.Expander}
          data-parent-id={component.id}
          style={isOver ? undefined : { backgroundColor }}
        >
          {isLayoutBlocked ? (
            <InvalidLayoutDropOverlay className="rounded-lg" />
          ) : null}
          {children.length === 0 ? (
            <>
              {showExpanderInsertionIndicator && indicatorIndex === 0 ? (
                <div className="h-2 rounded-md border border-primary/40 bg-primary/20" />
              ) : null}
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm gap-2">
                Drag components here
              </div>
            </>
          ) : (
            <SortableContext
              id={sortableContainerId}
              items={sortedChildren.map((childComponent) => childComponent.id)}
              strategy={verticalListSortingStrategy}
            >
              <>
                {sortedChildren.map((childComponent, index) => (
                  <div key={childComponent.id}>
                    {showExpanderInsertionIndicator &&
                    indicatorIndex === index ? (
                      <div className="mb-2 h-2 rounded-md border border-primary/40 bg-primary/20" />
                    ) : null}
                    <SortableItemWrapper
                      component={childComponent}
                      sortableParent={component.id}
                    >
                      {({ sortableHandle, disableInternalDrag }) => (
                        <div
                          className={`relative cursor-pointer transition-all ${
                            selectedComponentId === childComponent.id
                              ? "ring-2 ring-primary ring-offset-2"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(childComponent.id);
                          }}
                        >
                          {renderChild
                            ? renderChild(childComponent, {
                                sortableHandle,
                                disableInternalDrag,
                              })
                            : null}
                        </div>
                      )}
                    </SortableItemWrapper>
                  </div>
                ))}
                {showExpanderInsertionIndicator &&
                indicatorIndex === sortedChildren.length ? (
                  <div className="h-2 rounded-md border border-primary/40 bg-primary/20" />
                ) : null}
              </>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpanderRenderer;
