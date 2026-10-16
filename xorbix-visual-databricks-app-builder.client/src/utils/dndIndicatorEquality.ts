import type { DropIndicator, LayoutDropBlocked } from "../types/dnd";
import { ComponentType } from "../types/components/componentTypes";

export function isSameIndicator(
  a: DropIndicator | null,
  b: DropIndicator | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.dropType !== b.dropType) return false;
  if (a.contextKey !== b.contextKey) return false;
  if (a.index !== b.index) return false;

  if (a.dropType === "layout" && b.dropType === "layout") {
    if (a.parentId !== b.parentId || a.layoutType !== b.layoutType) return false;

    // For Tabs, both variants must be narrowed before accessing tabIndex.
    if (
      a.layoutType === ComponentType.Tabs &&
      b.layoutType === ComponentType.Tabs
    ) {
      return a.tabIndex === b.tabIndex;
    }

    return true;
  }

  return true;
}

export function isSameLayoutDropBlocked(
  a: LayoutDropBlocked | null,
  b: LayoutDropBlocked | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.contextKey === b.contextKey &&
    a.parentId === b.parentId &&
    a.layoutType === b.layoutType
  );
}

