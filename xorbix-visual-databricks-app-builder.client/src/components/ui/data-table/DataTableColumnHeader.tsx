import type { Column } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  EyeOff,
  ListFilter,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { DataTableColumnFilter } from "./DataTableColumnFilter";
import type { ColumnFilterMeta } from "./dataTableFilterFns";

interface DataTableColumnHeaderProps<
  TData,
  TValue,
> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

function getSortIcon<TData, TValue>(column: Column<TData, TValue>) {
  if (column.getIsSorted() === "desc") {
    return <ArrowDown className="ml-2 h-4 w-4" />;
  }
  if (column.getIsSorted() === "asc") {
    return <ArrowUp className="ml-2 h-4 w-4" />;
  }
  return <ChevronsUpDown className="ml-2 h-4 w-4" />;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: Readonly<DataTableColumnHeaderProps<TData, TValue>>) {
  const meta = column.columnDef.meta as ColumnFilterMeta | undefined;
  const hasFilter = !!meta?.filterType;
  const isFiltered = column.getIsFiltered();

  if (!column.getCanSort() && !hasFilter) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
          >
            <span>{title}</span>
            {isFiltered && (
              <ListFilter className="ml-1 h-3.5 w-3.5 text-primary" />
            )}
            {column.getCanSort() && getSortIcon(column)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {column.getCanSort() && (
            <>
              <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Asc
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Desc
              </DropdownMenuItem>
            </>
          )}
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Hide
              </DropdownMenuItem>
            </>
          )}
          <DataTableColumnFilter column={column} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
