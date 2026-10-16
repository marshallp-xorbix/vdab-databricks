import type { FC, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import type { VdabComponent } from "../../types/components/vdabComponent";
import { humanizeComponentType } from "../../types/components/componentTypes";
import type { ComponentDragData, SortableHandleBindings } from "../../types/dnd";

interface SortableItemWrapperProps {
  component: VdabComponent;
  sortableParent: string;
  children: (args: {
    sortableHandle: SortableHandleBindings;
    disableInternalDrag: boolean;
  }) => ReactNode;
}

const SortableItemWrapper: FC<SortableItemWrapperProps> = ({
  component,
  sortableParent,
  children,
}) => {
  const dragData: ComponentDragData = {
    dragType: "existing",
    componentId: component.id,
    type: component.type,
    label: humanizeComponentType(component.type),
    category: component.category,
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useSortable({
    id: component.id,
    data: dragData,
  });

  return (
    <div
      ref={setNodeRef}
      data-sortable-id={component.id}
      data-sortable-parent={sortableParent}
    >
      {children({
        sortableHandle: {
          attributes,
          listeners,
          setActivatorNodeRef,
          isDragging,
        },
        disableInternalDrag: true,
      })}
    </div>
  );
};

export default SortableItemWrapper;
