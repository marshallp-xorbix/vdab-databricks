import { useMemo, type FC } from "react";
import { ComponentType } from "../../../types/components/componentTypes";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { InvalidLayoutDropOverlay } from "../helpers";
import { FixedSlotLayoutDropZone } from "./FixedSlotLayoutDropZone";

interface ColumnsProps {
  columnCount?: number;
}

const ColumnsRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  allComponents = [],
  selectedComponentId,
  onSelect = () => {},
  renderChild,
  dropIndicator,
  layoutDropBlocked,
}) => {
  const props = component.props as ColumnsProps;
  const columnCount = props.columnCount || 2;
  const childrenIds = component.children || [];
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

  const columns = Array.from({ length: columnCount }, (_, i) => i);

  const isParentLayoutBlocked =
    !!layoutDropBlocked &&
    layoutDropBlocked.parentId === component.id &&
    layoutDropBlocked.layoutType === ComponentType.Columns;

  return (
    <div className="border border-border rounded-lg p-2">
      <div className="text-xs text-muted-foreground mb-2">{columnCount} columns</div>
      <div
        className={
          isParentLayoutBlocked
            ? "relative grid gap-2 overflow-hidden rounded-md border border-dashed border-destructive/50 bg-destructive/[0.06]"
            : "relative grid gap-2"
        }
        style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
        data-drop-scope="layout"
        data-layout-type={ComponentType.Columns}
        data-parent-id={component.id}
      >
        {isParentLayoutBlocked ? (
          <InvalidLayoutDropOverlay className="rounded-md" />
        ) : null}
        {columns.map((columnIndex) => {
          const childId = childrenIds[columnIndex];
          const childComponent = childId
            ? allComponentsById.get(childId)
            : undefined;

          return (
            <FixedSlotLayoutDropZone
              key={columnIndex}
              slotIndex={columnIndex}
              parentId={component.id}
              droppableIdPrefix="columns"
              layoutType={ComponentType.Columns}
              childComponent={childComponent}
              selectedComponentId={selectedComponentId}
              onSelect={onSelect}
              renderChild={renderChild}
              dropIndicator={dropIndicator}
              parentLayoutDropBlocked={isParentLayoutBlocked}
              emptySlotLabel={`Column ${columnIndex + 1}`}
              minHeightClassName="min-h-[100px]"
            />
          );
        })}
      </div>
    </div>
  );
};

export default ColumnsRenderer;
