import { useMemo, type FC } from "react";
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
import { InvalidLayoutDropOverlay } from "../helpers";
import { getFormSortableContainerId } from "../../../utils/sortableContainerIds";
import { useSortableDragState } from "../../../hooks/useSortableDragState";

interface FormProps {
  submitButtonText?: string;
  border?: boolean;
  width?: "stretch" | "content";
}

const FormRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme = {},
  allComponents = [],
  selectedComponentId,
  onSelect = () => {},
  renderChild,
  dropIndicator,
  layoutDropBlocked,
}) => {
  const props = component.props as FormProps;
  const submitButtonText = props.submitButtonText || "Submit";
  const showOuterBorder = props.border ?? true;
  const widthMode: "stretch" | "content" = props.width ?? "stretch";
  const textColor = theme.textColor || "#334155";
  const outlineColor = getOutlineColor(textColor);
  const children = component.children || [];
  const allComponentsById = useMemo(
    () =>
      new Map(
        allComponents.map((childComponent) => [
          childComponent.id,
          childComponent,
        ]),
      ),
    [allComponents],
  );
  const sortedChildren = useMemo(() => {
    const childComponents = children
      .map((childId) => allComponentsById.get(childId))
      .filter(
        (childComponent): childComponent is VdabComponent =>
          childComponent !== undefined,
      );

    return sortComponentsByLayout(childComponents);
  }, [allComponentsById, children]);

  const { isOver, setNodeRef } = useDroppable({
    id: `form-${component.id}`,
    data: {
      dropType: "layout",
      parentId: component.id,
      index: children.length,
      layoutType: ComponentType.Form,
    } satisfies DropTargetData,
  });

  const sortableContainerId = getFormSortableContainerId(component.id);

  const isLayoutBlocked =
    !!layoutDropBlocked &&
    layoutDropBlocked.parentId === component.id &&
    layoutDropBlocked.layoutType === ComponentType.Form;
  const indicatorIndex =
    dropIndicator?.dropType === "layout" &&
    dropIndicator.parentId === component.id &&
    dropIndicator.layoutType === ComponentType.Form
      ? dropIndicator.index
      : null;
  const { isSameContainerDrag: isSameFormSortableDrag } =
    useSortableDragState(sortableContainerId);
  const showFormInsertionIndicator =
    indicatorIndex !== null && !isSameFormSortableDrag;
  const showFormTargetHighlight =
    !!isLayoutBlocked ||
    (dropIndicator?.dropType === "layout" &&
      dropIndicator.parentId === component.id &&
      dropIndicator.layoutType === ComponentType.Form);

  return (
    <div
      className={`rounded-lg p-2 bg-transparent ${
        widthMode === "content" ? "inline-flex max-w-full flex-col" : "w-full"
      } ${showOuterBorder ? "border" : ""}`}
      style={showOuterBorder ? { borderColor: outlineColor } : undefined}
    >
      <div
        className={`relative min-h-[100px] p-3 border border-dashed rounded-lg transition-colors ${
          isLayoutBlocked
            ? "overflow-hidden border-destructive/50 bg-destructive/[0.06]"
            : showFormTargetHighlight || isOver
              ? "border-primary/50 bg-primary/10"
              : "border-input"
        }`}
        ref={setNodeRef}
        data-drop-scope="layout"
        data-layout-type={ComponentType.Form}
        data-parent-id={component.id}
      >
        {isLayoutBlocked ? (
          <InvalidLayoutDropOverlay className="rounded-lg" />
        ) : null}
        <div className="relative z-[1] space-y-3">
          {children.length === 0 ? (
            <>
              {showFormInsertionIndicator && indicatorIndex === 0 ? (
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
                    {showFormInsertionIndicator && indicatorIndex === index ? (
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
                {showFormInsertionIndicator &&
                indicatorIndex === sortedChildren.length ? (
                  <div className="h-2 rounded-md border border-primary/40 bg-primary/20" />
                ) : null}
              </>
            </SortableContext>
          )}
        </div>
      </div>

      <div className="mt-2 flex justify-start">
        <button
          className="px-3 py-1.5 bg-card text-foreground rounded-md text-sm font-normal hover:bg-muted transition-colors border border-border"
          style={{ border: "1px solid rgb(203 213 225)" }}
          disabled
        >
          {submitButtonText}
        </button>
      </div>
    </div>
  );
};

export default FormRenderer;
