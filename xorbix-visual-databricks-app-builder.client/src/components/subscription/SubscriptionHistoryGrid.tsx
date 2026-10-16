import { useMemo, useState } from "react";
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "../ui/data-table";
import { billingApi } from "../../providers/BillingApi";
import { getSubscriptionHistoryColumns } from "./subscriptionHistoryColumns";

interface ISubscriptionHistoryGridProps {
  tenantId: string;
}

const DEFAULT_SORT: SortingState = [{ id: "eventDate", desc: true }];

const SubscriptionHistoryGrid = ({
  tenantId,
}: Readonly<ISubscriptionHistoryGridProps>) => {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORT);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const query = useQuery({
    queryKey: ["tenant", tenantId, "subscriptionHistory"],
    queryFn: () => billingApi.getSubscriptionHistoryForTenant(tenantId),
    enabled: !!tenantId,
  });

  const columns = useMemo(() => getSubscriptionHistoryColumns(), []);
  const rows = query.data ?? [];

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {query.isError ? (
        <div className="rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
          {query.error instanceof Error
            ? query.error.message
            : "Failed to load subscription history."}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={pagination}
        onPaginationChange={setPagination}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
      />
    </div>
  );
};

export default SubscriptionHistoryGrid;
