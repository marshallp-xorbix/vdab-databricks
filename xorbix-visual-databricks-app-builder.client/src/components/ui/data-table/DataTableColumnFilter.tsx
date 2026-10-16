import type { Column } from "@tanstack/react-table";
import { Filter, X } from "lucide-react";
import { Input } from "../input";
import { Label } from "../label";
import { Button } from "../button";
import { Checkbox } from "../checkbox";
import { DropdownMenuLabel, DropdownMenuSeparator } from "../dropdown-menu";
import type { ColumnFilterMeta } from "./dataTableFilterFns";

export type { ColumnFilterType, ColumnFilterMeta } from "./dataTableFilterFns";

// ── Individual filter components ────────────────────────────────────────

function TextColumnFilter<TData, TValue>({
  column,
}: Readonly<{ column: Column<TData, TValue> }>) {
  const filterValue = (column.getFilterValue() as string) ?? "";
  return (
    <div className="relative px-2 py-1.5">
      <Input
        placeholder="Filter…"
        value={filterValue}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        className="h-8 pr-7 text-sm"
      />
      {filterValue && (
        <button
          type="button"
          onClick={() => column.setFilterValue(undefined)}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function NumberRangeColumnFilter<TData, TValue>({
  column,
}: Readonly<{ column: Column<TData, TValue> }>) {
  const filterValue = (column.getFilterValue() as
    | [number | undefined, number | undefined]
    | undefined) ?? [undefined, undefined];
  return (
    <div className="space-y-1.5 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="Min"
          value={filterValue[0] ?? ""}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : undefined;
            column.setFilterValue([val, filterValue[1]]);
          }}
          className="h-8 w-20 text-sm"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="number"
          placeholder="Max"
          value={filterValue[1] ?? ""}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : undefined;
            column.setFilterValue([filterValue[0], val]);
          }}
          className="h-8 w-20 text-sm"
        />
      </div>
    </div>
  );
}

function DateRangeColumnFilter<TData, TValue>({
  column,
}: Readonly<{ column: Column<TData, TValue> }>) {
  const filterValue = (column.getFilterValue() as
    | [string | undefined, string | undefined]
    | undefined) ?? [undefined, undefined];
  return (
    <div className="space-y-1.5 px-2 py-1.5">
      <div>
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          value={filterValue[0] ?? ""}
          onChange={(e) =>
            column.setFilterValue([e.target.value || undefined, filterValue[1]])
          }
          className="h-8 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          value={filterValue[1] ?? ""}
          onChange={(e) =>
            column.setFilterValue([filterValue[0], e.target.value || undefined])
          }
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

function SelectColumnFilter<TData, TValue>({
  column,
}: Readonly<{ column: Column<TData, TValue> }>) {
  const selectedValues = new Set(
    (column.getFilterValue() as string[] | undefined) ?? [],
  );
  const facetedValues = column.getFacetedUniqueValues();
  const uniqueValues = Array.from(facetedValues.keys())
    .map(String)
    .sort((a, b) => a.localeCompare(b));

  const toggleValue = (value: string) => {
    const next = new Set(selectedValues);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    column.setFilterValue(next.size > 0 ? Array.from(next) : undefined);
  };

  return (
    <div className="max-h-48 space-y-0.5 overflow-y-auto px-2 py-1.5">
      {uniqueValues.map((value) => (
        <label
          key={value}
          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
        >
          <Checkbox
            checked={selectedValues.has(value)}
            onCheckedChange={() => toggleValue(value)}
          />
          <span>{value || "(empty)"}</span>
        </label>
      ))}
    </div>
  );
}

// ── Main filter component ───────────────────────────────────────────────

interface DataTableColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

export function DataTableColumnFilter<TData, TValue>({
  column,
}: Readonly<DataTableColumnFilterProps<TData, TValue>>) {
  const meta = column.columnDef.meta as ColumnFilterMeta | undefined;
  const filterType = meta?.filterType;

  if (!filterType || !column.getCanFilter()) return null;

  const isFiltered = column.getIsFiltered();

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-1.5">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        Filter
      </DropdownMenuLabel>
      {filterType === "text" && <TextColumnFilter column={column} />}
      {filterType === "number" && <NumberRangeColumnFilter column={column} />}
      {filterType === "date" && <DateRangeColumnFilter column={column} />}
      {filterType === "select" && <SelectColumnFilter column={column} />}
      {isFiltered && (
        <div className="px-2 pb-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => column.setFilterValue(undefined)}
          >
            <X className="mr-1 h-3 w-3" />
            Clear filter
          </Button>
        </div>
      )}
    </>
  );
}
