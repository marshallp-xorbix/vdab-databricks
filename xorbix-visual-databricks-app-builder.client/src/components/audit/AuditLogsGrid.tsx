import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { useAuditLogsQuery } from "../../hooks/useAuditLogsQuery";
import { useLogger } from "../../logger/useLogger";
import { toast } from "../ui/use-toast";
import { auditApi } from "../../api/AuditApi";
import { getAuditLogColumns } from "./auditLogColumns";
import AuditLogsToolbar from "./AuditLogsToolbar";
import type { AuditLogDto } from "../../models/AuditLog";
import type {
  AuditActionType,
  AuditScope,
  AuditSeverity,
} from "../../types/auditLog";

interface IAuditLogsGridProps {
  scope: AuditScope;
  /** Page size requested from the server. Defaults to 10. */
  pageSize?: number;
  /** Hide the toolbar entirely (e.g., compact embedded uses). */
  hideToolbar?: boolean;
}

const DEFAULT_SORT: SortingState = [{ id: "timestamp", desc: true }];

/**
 * Cursor-paginated audit log grid driven by `useAuditLogsQuery` (`useInfiniteQuery`).
 *
 * UI model: a single "current page" view with Prev / Next controls. Prev walks back
 * through pages already in memory; Next either advances within memory or fetches the
 * next page via `fetchNextPage` if not yet loaded. No total-count required — we just
 * know whether there's a `nextCursor` waiting.
 */
function AuditLogsGrid({
  scope,
  pageSize = 10,
  hideToolbar = false,
}: Readonly<IAuditLogsGridProps>) {
  const logger = useLogger("AuditLogsGrid");
  const [actionTypes, setActionTypes] = useState<AuditActionType[]>([]);
  const [severities, setSeverities] = useState<AuditSeverity[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [userIdFilter, setUserIdFilter] = useState<string | undefined>(undefined);
  const [tenantIdFilter, setTenantIdFilter] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORT);
  const [pageIndex, setPageIndex] = useState(0);

  const filters = useMemo(
    () => ({
      actionTypes: actionTypes.length > 0 ? actionTypes : undefined,
      severities: severities.length > 0 ? severities : undefined,
      startDate,
      endDate,
      userId: userIdFilter,
      tenantId: tenantIdFilter,
    }),
    [actionTypes, severities, startDate, endDate, userIdFilter, tenantIdFilter],
  );

  const query = useAuditLogsQuery({
    scope,
    filters,
    take: pageSize,
  });

  const pages = query.data?.pages ?? [];
  const currentPage = pages[pageIndex];
  const items: AuditLogDto[] = currentPage?.parsedItems ?? [];

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const needle = searchTerm.toLowerCase();
    return items.filter((row) => {
      return (
        row.description.toLowerCase().includes(needle) ||
        row.actionType.toLowerCase().includes(needle) ||
        (row.userFullName?.toLowerCase().includes(needle) ?? false) ||
        (row.userEmail?.toLowerCase().includes(needle) ?? false) ||
        (row.tenantDisplayName?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [items, searchTerm]);

  const columns = useMemo(() => getAuditLogColumns({ scope }), [scope]);

  const table = useReactTable({
    data: filteredItems,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const canGoPrev = pageIndex > 0;
  const hasLoadedNext = pageIndex < pages.length - 1;
  const canGoNext = hasLoadedNext || query.hasNextPage;
  const isFetchingNext = query.isFetchingNextPage;

  const resetPagination = () => setPageIndex(0);

  const handleClearFilters = () => {
    setActionTypes([]);
    setSeverities([]);
    setStartDate(undefined);
    setEndDate(undefined);
    setUserIdFilter(undefined);
    setTenantIdFilter(undefined);
    setSearchTerm("");
    resetPagination();
  };

  const wrapFilterSetter = <T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setter(value);
      resetPagination();
    };
  };

  const handleNext = async () => {
    if (hasLoadedNext) {
      setPageIndex((prev) => prev + 1);
      return;
    }
    if (!query.hasNextPage) return;
    const result = await query.fetchNextPage();
    if (result.data) {
      // Advance only after the new page is in cache.
      setPageIndex(result.data.pages.length - 1);
    }
  };

  const handlePrev = () => {
    if (!canGoPrev) return;
    setPageIndex((prev) => prev - 1);
  };

  const handleArchiveDateRange =
    scope.kind === "all"
      ? async (start: Date, end: Date) => {
          if (scope.kind !== "all") return;
          // The archive endpoint is per-tenant on the server today; we use the
          // current row set's tenant when there's exactly one. This is a stop-gap
          // until the archive endpoint is migrated to the new query shape.
          const tenantIds = new Set(
            items
              .map((item) => item.tenantId)
              .filter((id): id is string => !!id),
          );
          if (tenantIds.size !== 1) {
            toast({
              title: "Cannot archive multi-tenant range",
              description:
                "Filter to a single tenant before archiving, or use the per-tenant archive view.",
              variant: "destructive",
            });
            return;
          }
          const [tenantId] = tenantIds;
          try {
            await auditApi.archiveAuditLogs(
              tenantId,
              start.toISOString(),
              end.toISOString(),
            );
            toast({ title: "Archive request submitted" });
            await query.refetch();
          } catch (err) {
            logger.UI.error("Failed to archive audit logs", err);
            toast({
              title: "Failed to archive",
              description:
                err instanceof Error ? err.message : "Please try again.",
              variant: "destructive",
            });
          }
        }
      : undefined;

  return (
    <div className="space-y-0">
      {!hideToolbar && (
        <AuditLogsToolbar
          scope={scope}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          actionTypes={actionTypes}
          onActionTypesChange={wrapFilterSetter(setActionTypes)}
          severities={severities}
          onSeveritiesChange={wrapFilterSetter(setSeverities)}
          userIdFilter={userIdFilter}
          onUserIdFilterChange={wrapFilterSetter(setUserIdFilter)}
          tenantIdFilter={tenantIdFilter}
          onTenantIdFilterChange={wrapFilterSetter(setTenantIdFilter)}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={wrapFilterSetter(setStartDate)}
          onEndDateChange={wrapFilterSetter(setEndDate)}
          onArchiveDateRange={handleArchiveDateRange}
          onClearFilters={handleClearFilters}
        />
      )}

      {query.isError && (
        <div className="mb-4 rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
          Failed to load audit logs.{" "}
          <button
            type="button"
            onClick={() => query.refetch()}
            className="font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted">
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
            {query.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  <div className="flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center italic text-muted-foreground"
                >
                  No audit log entries.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="transition-colors hover:bg-muted/80"
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
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <div>
            Page {pageIndex + 1}
            {filteredItems.length > 0 && (
              <>
                {" "}
                · {filteredItems.length} {filteredItems.length === 1 ? "row" : "rows"}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={!canGoPrev || isFetchingNext}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={!canGoNext || isFetchingNext}
            >
              {isFetchingNext ? "Loading..." : "Next"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditLogsGrid;
