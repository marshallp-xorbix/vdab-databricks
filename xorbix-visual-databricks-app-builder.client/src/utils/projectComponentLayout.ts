import type {
  IProjectComponent,
  ProjectJsonObject,
} from "../models/ProjectComponents";

/** Reads the configured number of child slots for a Columns or Rows component. */
export function readLayoutSlotCount(
  componentType: "Columns" | "Rows",
  properties: ProjectJsonObject,
): number {
  const slotCount =
    componentType === "Columns" ? properties.columnCount : properties.rowCount;
  return typeof slotCount === "number" && Number.isSafeInteger(slotCount)
    ? slotCount
    : 2;
}

/** Reads tab labels, using the default labels when stored values are invalid. */
export function readTabNames(value: unknown): string[] {
  return Array.isArray(value) && value.every((tab) => typeof tab === "string")
    ? value
    : ["Tab 1", "Tab 2"];
}

/** Reads a valid selected tab index or returns the first tab. */
export function readDefaultTabIndex(value: unknown, tabCount: number): number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < tabCount
    ? value
    : 0;
}

/** Reads a non-negative tab index from a child layout. */
export function readTabIndex(layout: ProjectJsonObject | null): number | null {
  const tabIndex = layout?.tabIndex;
  return typeof tabIndex === "number" &&
    Number.isSafeInteger(tabIndex) &&
    tabIndex >= 0
    ? tabIndex
    : null;
}

/** Finds the next vertical position in the selected tab. */
export function readNextTabChildY(
  tabs: IProjectComponent,
  components: IProjectComponent[],
  tabIndex: number | undefined,
): number {
  if (tabIndex === undefined) {
    return 0;
  }

  const existingPositions = tabs.children.flatMap((key) => {
    const child = components.find((candidate) => candidate.key === key);
    const childTabIndex = readTabIndex(child?.layout ?? null);
    const position = child?.layout?.y;
    return childTabIndex === tabIndex &&
      typeof position === "number" &&
      Number.isFinite(position)
      ? [position]
      : [];
  });
  return existingPositions.length === 0
    ? 0
    : Math.max(...existingPositions) + 1;
}
