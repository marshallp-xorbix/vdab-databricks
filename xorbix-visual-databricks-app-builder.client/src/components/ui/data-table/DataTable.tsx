import { useState, type MouseEvent } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";
import { DataTablePagination } from "./DataTablePagination";

const DEFAULT_ROW_INTERACTION_IGNORE_SELECTOR =
  "button, a, input, select, textarea, [role='menuitem'], [data-row-click='ignore'], [data-row-double-click='ignore']";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  toolbar?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  // Add `data-row-click="ignore"` or `data-row-double-click="ignore"` to skip row click navigation.
  rowDoubleClickIgnoreSelector?: string;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  globalFilter,
  onGlobalFilterChange,
  toolbar,
  onRowClick,
  onRowDoubleClick,
  rowDoubleClickIgnoreSelector,
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  pagination: controlledPagination,
  onPaginationChange: controlledOnPaginationChange,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange: controlledOnColumnFiltersChange,
}: Readonly<DataTableProps<TData, TValue>>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const sorting = controlledSorting ?? internalSorting;
  const onSortingChange = controlledOnSortingChange ?? setInternalSorting;
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const onColumnFiltersChange =
    controlledOnColumnFiltersChange ?? setInternalColumnFilters;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      ...(controlledPagination ? { pagination: controlledPagination } : {}),
    },
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange,
    ...(controlledOnPaginationChange
      ? { onPaginationChange: controlledOnPaginationChange }
      : {}),
    ...(controlledPagination ? { autoResetPageIndex: false } : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const handleRowInteraction = (
    event: MouseEvent<HTMLTableRowElement>,
    row: TData,
    callback?: (row: TData) => void,
  ) => {
    if (!callback) {
      return;
    }

    const ignoreSelector =
      rowDoubleClickIgnoreSelector ?? DEFAULT_ROW_INTERACTION_IGNORE_SELECTOR;
    const target = event.target;
    if (target instanceof Element && target.closest(ignoreSelector)) {
      return;
    }

    callback(row);
  };

  return (
    <div className="space-y-0">
      {toolbar}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`transition-colors hover:bg-muted/60 ${onRowClick || onRowDoubleClick ? "cursor-pointer" : ""}`}
                  onClick={
                    onRowClick
                      ? (event) =>
                          handleRowInteraction(event, row.original, onRowClick)
                      : undefined
                  }
                  onDoubleClick={
                    onRowDoubleClick
                      ? (event) =>
                          handleRowInteraction(
                            event,
                            row.original,
                            onRowDoubleClick,
                          )
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-6 py-4">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center italic text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="border-t border-border">
          <DataTablePagination table={table} />
        </div>
      </div>
    </div>
  );
}
