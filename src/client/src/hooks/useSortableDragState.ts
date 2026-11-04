import { useDndContext } from "@dnd-kit/core";
import { readSortableIndexData } from "../utils/dndPayload";

interface SortableDragState {
  activeSortableContainerId: string | null;
  isSameContainerDrag: boolean;
}

export function useSortableDragState(
  sortableContainerId: string,
): SortableDragState {
  const { active } = useDndContext();
  const activeSortableContainerId =
    readSortableIndexData(active?.data.current)?.containerId ?? null;

  return {
    activeSortableContainerId,
    isSameContainerDrag: activeSortableContainerId === sortableContainerId,
  };
}
