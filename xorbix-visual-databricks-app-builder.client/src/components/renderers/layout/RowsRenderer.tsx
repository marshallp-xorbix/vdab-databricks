import { useMemo, type FC } from "react";
import { ComponentType } from "../../../types/components/componentTypes";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { InvalidLayoutDropOverlay } from "../helpers";
import { FixedSlotLayoutDropZone } from "./FixedSlotLayoutDropZone";

interface RowsProps {
  rowCount?: number;
}

const RowsRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  allComponents = [],
  selectedComponentId,
  onSelect = () => {},
  renderChild,
  dropIndicator,
  layoutDropBlocked,
}) => {
  const props = component.props as RowsProps;
  const rowCount = props.rowCount || 2;
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

  const rows = Array.from({ length: rowCount }, (_, i) => i);

  const isParentLayoutBlocked =
    !!layoutDropBlocked &&
    layoutDropBlocked.parentId === component.id &&
    layoutDropBlocked.layoutType === ComponentType.Rows;

  return (
    <div className="border border-border rounded-lg p-2">
      <div className="text-xs text-muted-foreground mb-2">{rowCount} rows</div>
      <div
        className={
          isParentLayoutBlocked
            ? "relative flex flex-col gap-2 overflow-hidden rounded-md border border-dashed border-destructive/50 bg-destructive/[0.06]"
            : "relative flex flex-col gap-2"
        }
        data-drop-scope="layout"
        data-layout-type={ComponentType.Rows}
        data-parent-id={component.id}
      >
        {isParentLayoutBlocked ? (
          <InvalidLayoutDropOverlay className="rounded-md" />
        ) : null}
        {rows.map((rowIndex) => {
          const childId = childrenIds[rowIndex];
          const childComponent = childId
            ? allComponentsById.get(childId)
            : undefined;

          return (
            <FixedSlotLayoutDropZone
              key={rowIndex}
              slotIndex={rowIndex}
              parentId={component.id}
              droppableIdPrefix="rows"
              layoutType={ComponentType.Rows}
              childComponent={childComponent}
              selectedComponentId={selectedComponentId}
              onSelect={onSelect}
              renderChild={renderChild}
              dropIndicator={dropIndicator}
              parentLayoutDropBlocked={isParentLayoutBlocked}
              emptySlotLabel={`Row ${rowIndex + 1}`}
              minHeightClassName="min-h-[60px]"
            />
          );
        })}
      </div>
    </div>
  );
};

export default RowsRenderer;
