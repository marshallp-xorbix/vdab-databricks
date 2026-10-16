import type { FC } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useDraggedExistingComponentId } from "../../../hooks/useDraggedExistingComponentId";
import type { VdabComponent } from "../../../types/components/vdabComponent";
import { ComponentType } from "../../../types/components/componentTypes";
import type {
  ChildRenderOptions,
  DropIndicator,
  DropTargetData,
} from "../../../types/dnd";

type SlotLayoutType = typeof ComponentType.Rows | typeof ComponentType.Columns;

export interface FixedSlotLayoutDropZoneProps {
  slotIndex: number;
  parentId: string;
  droppableIdPrefix: "rows" | "columns";
  layoutType: SlotLayoutType;
  childComponent?: VdabComponent;
  selectedComponentId?: string;
  onSelect: (id: string) => void;
  renderChild?: (
    component: VdabComponent,
    options?: ChildRenderOptions,
  ) => React.ReactNode;
  dropIndicator?: DropIndicator | null;
  parentLayoutDropBlocked: boolean;
  emptySlotLabel: string;
  minHeightClassName: string;
}

export const FixedSlotLayoutDropZone: FC<FixedSlotLayoutDropZoneProps> = ({
  slotIndex,
  parentId,
  droppableIdPrefix,
  layoutType,
  childComponent,
  selectedComponentId,
  onSelect,
  renderChild,
  dropIndicator,
  parentLayoutDropBlocked,
  emptySlotLabel,
  minHeightClassName,
}) => {
  const draggedExistingComponentId = useDraggedExistingComponentId();
  const isOccupied = !!childComponent;
  const slotActsAsEmpty =
    !isOccupied ||
    (draggedExistingComponentId != null &&
      childComponent?.id === draggedExistingComponentId);

  const { isOver, setNodeRef } = useDroppable({
    id: `${droppableIdPrefix}-${parentId}-${slotIndex}`,
    disabled: !slotActsAsEmpty,
    data: {
      dropType: "layout",
      parentId,
      index: slotIndex,
      layoutType,
    } satisfies DropTargetData,
  });

  const isDropTarget =
    slotActsAsEmpty &&
    dropIndicator?.dropType === "layout" &&
    dropIndicator.parentId === parentId &&
    dropIndicator.layoutType === layoutType &&
    dropIndicator.index === slotIndex;

  const showValidHover = isOver && !parentLayoutDropBlocked;

  const slotBorderClass = showValidHover
    ? "border-primary/50 bg-primary/10"
    : parentLayoutDropBlocked
      ? "border-destructive/45 bg-destructive/[0.05]"
      : "border-input";

  return (
    <div
      ref={setNodeRef}
      className={`border border-dashed rounded-lg p-2 transition-colors ${minHeightClassName} ${slotBorderClass}`}
      data-layout-slot="true"
      data-slot-index={slotIndex}
      data-slot-empty={slotActsAsEmpty ? "true" : "false"}
    >
      {isDropTarget && (
        <div className="h-1 w-full rounded-full bg-primary mb-2" />
      )}
      {childComponent ? (
        <div
          className={`relative group cursor-pointer transition-all ${
            selectedComponentId === childComponent.id
              ? "ring-2 ring-primary ring-offset-2"
              : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(childComponent.id);
          }}
        >
          {renderChild ? renderChild(childComponent) : null}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          {emptySlotLabel}
        </div>
      )}
    </div>
  );
};
