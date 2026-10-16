import type { ComponentType } from "../types/components";
import type {
  ComponentDragData,
  ExistingComponentDragData,
  NewComponentDragData,
} from "../types/dnd";
import {
  toCanonicalComponentCategory,
  toCanonicalComponentType,
} from "./componentEnumGuards";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Reads dnd-kit sortable state merged onto draggable/droppable `data.current`.
 */
export function readSortableIndexData(
  data: unknown,
): { containerId: string; index: number } | null {
  if (!isRecord(data)) {
    return null;
  }
  const sortable = data["sortable"];
  if (!isRecord(sortable)) {
    return null;
  }
  const containerId = sortable["containerId"];
  const index = sortable["index"];
  if (
    (typeof containerId === "string" || typeof containerId === "number") &&
    typeof index === "number" &&
    Number.isFinite(index)
  ) {
    return { containerId: String(containerId), index };
  }
  return null;
}

function readExistingDragData(
  data: Record<string, unknown>,
): ExistingComponentDragData | undefined {
  const componentId = data["componentId"];
  const type = data["type"];
  const category = data["category"];

  if (
    typeof componentId !== "string" ||
    typeof type !== "string" ||
    typeof category !== "string"
  ) {
    return undefined;
  }

  const canonicalType = toCanonicalComponentType(type);
  const canonicalCategory = toCanonicalComponentCategory(category);
  if (canonicalType == null || canonicalCategory == null) {
    return undefined;
  }

  const label = data["label"];
  return {
    dragType: "existing",
    componentId,
    type: canonicalType,
    category: canonicalCategory,
    ...(typeof label === "string" ? { label } : {}),
  };
}

function readNewDragData(
  data: Record<string, unknown>,
): NewComponentDragData | undefined {
  const type = data["type"];
  const label = data["label"];
  const category = data["category"];

  if (
    type === undefined ||
    type === null ||
    typeof label !== "string" ||
    typeof category !== "string"
  ) {
    return undefined;
  }

  return {
    dragType: "new",
    type: String(type),
    label,
    category,
  };
}

/**
 * Validates `active.data.current` / palette draggable payload shape.
 */
export function readComponentDragData(
  data: unknown,
): ComponentDragData | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const dragType = data["dragType"];
  if (dragType === "existing") {
    return readExistingDragData(data);
  }
  if (dragType === "new") {
    return readNewDragData(data);
  }
  return undefined;
}

/**
 * Component type used for Streamlit layout drop rules.
 * New palette drags must resolve to a known {@link ComponentType}.
 */
export function getDraggedTypeForLayoutRules(
  dragData: ComponentDragData,
): ComponentType | null {
  return toCanonicalComponentType(String(dragData.type));
}
