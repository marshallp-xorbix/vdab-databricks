import { useDndContext } from "@dnd-kit/core";
import { readComponentDragData } from "../utils/dndPayload";

/**
 * While dragging an on-canvas component, returns its id; otherwise null (e.g. palette "new" drag).
 */
export function useDraggedExistingComponentId(): string | null {
  const { active } = useDndContext();
  const data = readComponentDragData(active?.data.current);
  if (data?.dragType === "existing") {
    return data.componentId;
  }
  return null;
}
