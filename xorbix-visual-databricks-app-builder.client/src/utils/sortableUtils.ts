import type { VdabComponent } from "../types/components";
import { ComponentType } from "../types/components/componentTypes";
import { getLayoutY, getTopLevelComponents } from "./layoutUtils";

export type PointerPosition = {
  x: number;
  y: number;
};

export type RectLike = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

export type SortableRect = {
  id: string;
  rect: RectLike;
};

export type SortableModel = {
  orderedIds: string[];
  idToIndex: Map<string, number>;
};

export const getInsertionIndexFromPointer = (
  items: SortableRect[],
  pointer: PointerPosition,
): number => {
  if (items.length === 0) return 0;

  const sorted = [...items].sort((a, b) => a.rect.top - b.rect.top);
  for (let i = 0; i < sorted.length; i += 1) {
    const item = sorted[i];
    const mid = item.rect.top + item.rect.height / 2;
    if (pointer.y <= mid) return i;
  }
  return sorted.length;
};

export const buildSortableModelForTopLevel = (
  components: VdabComponent[],
): SortableModel => {
  const topLevel = getTopLevelComponents(components);
  const ordered = [...topLevel].sort(
    (a, b) => getLayoutY(a.layout) - getLayoutY(b.layout),
  );
  const orderedIds = ordered.map((component) => component.id);
  const idToIndex = new Map<string, number>();
  orderedIds.forEach((id, index) => idToIndex.set(id, index));
  return { orderedIds, idToIndex };
};

export const buildSortableModelForParent = (
  parent: VdabComponent,
  allComponents: VdabComponent[],
): SortableModel => {
  const children = parent.children || [];
  const idToIndex = new Map<string, number>();

  if (
    parent.type === ComponentType.Rows ||
    parent.type === ComponentType.Columns
  ) {
    children.forEach((childId, index) => {
      if (childId && childId.trim()) {
        idToIndex.set(childId, index);
      }
    });
    const orderedIds = children.filter((childId) => childId && childId.trim());
    return { orderedIds, idToIndex };
  }

  if (
    parent.type === ComponentType.Form ||
    parent.type === ComponentType.Expander
  ) {
    const allComponentsById = new Map(
      allComponents.map((component) => [component.id, component]),
    );
    const childComponents = children
      .filter((childId) => childId && childId.trim())
      .map((childId) => allComponentsById.get(childId))
      .filter((c): c is VdabComponent => c !== undefined)
      .sort((a, b) => getLayoutY(a.layout) - getLayoutY(b.layout));
    const orderedIds = childComponents.map((component) => component.id);
    orderedIds.forEach((id, index) => idToIndex.set(id, index));
    return { orderedIds, idToIndex };
  }

  const orderedIds = children.filter((childId) => childId && childId.trim());
  orderedIds.forEach((id, index) => idToIndex.set(id, index));
  return { orderedIds, idToIndex };
};
