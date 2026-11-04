export const getCanvasSortableContainerId = (contextKey: string): string =>
  `canvas:${contextKey}`;

export const getFormSortableContainerId = (parentId: string): string =>
  `form:${parentId}`;

export const getExpanderSortableContainerId = (parentId: string): string =>
  `expander:${parentId}`;

export const getTabsSortableContainerId = (
  parentId: string,
  tabIndex: number,
): string => `tabs:${parentId}:${tabIndex}`;

export type ParsedSortableContainer =
  | { type: "canvas"; contextKey: string }
  | { type: "form"; parentId: string }
  | { type: "expander"; parentId: string }
  | { type: "tabs"; parentId: string; tabIndex: number }
  | null;

export const parseSortableContainerId = (
  containerId: string,
): ParsedSortableContainer => {
  if (containerId.startsWith("canvas:")) {
    return { type: "canvas", contextKey: containerId.replace("canvas:", "") };
  }
  if (containerId.startsWith("form:")) {
    return { type: "form", parentId: containerId.replace("form:", "") };
  }
  if (containerId.startsWith("expander:")) {
    return {
      type: "expander",
      parentId: containerId.replace("expander:", ""),
    };
  }
  if (containerId.startsWith("tabs:")) {
    const parts = containerId.split(":");
    const parentId = parts[1];
    const tabIndex = Number(parts[2]);
    if (!parentId || Number.isNaN(tabIndex)) {
      return null;
    }
    return { type: "tabs", parentId, tabIndex };
  }
  return null;
};
