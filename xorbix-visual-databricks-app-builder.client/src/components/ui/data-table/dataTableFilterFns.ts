import type { FilterFn } from "@tanstack/react-table";

// ── Column filter type metadata ─────────────────────────────────────────

export type ColumnFilterType = "text" | "select" | "date" | "number";

export interface ColumnFilterMeta {
  filterType?: ColumnFilterType;
}

// ── Custom filter functions ─────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export const selectFilterFn: FilterFn<any> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue || filterValue.length === 0) return true;
  const cellValue = String(row.getValue(columnId) ?? "");
  return filterValue.includes(cellValue);
};
selectFilterFn.autoRemove = (val) =>
  !val || (Array.isArray(val) && val.length === 0);

export const numberRangeFilterFn: FilterFn<any> = (
  row,
  columnId,
  filterValue: [number | undefined, number | undefined],
) => {
  const value = row.getValue<number>(columnId);
  if (value == null) return false;
  const [min, max] = filterValue;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
};
numberRangeFilterFn.autoRemove = (val) =>
  !val || (Array.isArray(val) && val[0] == null && val[1] == null);

export const dateRangeFilterFn: FilterFn<any> = (
  row,
  columnId,
  filterValue: [string | undefined, string | undefined],
) => {
  const raw = row.getValue(columnId);
  if (!raw) return false;
  const date = new Date(raw as string | number | Date);
  if (Number.isNaN(date.getTime())) return false;
  const [from, to] = filterValue;
  if (from && date < new Date(from)) return false;
  if (to && date > new Date(to + "T23:59:59.999")) return false;
  return true;
};
dateRangeFilterFn.autoRemove = (val) =>
  !val || (Array.isArray(val) && val[0] == null && val[1] == null);
/* eslint-enable @typescript-eslint/no-explicit-any */
