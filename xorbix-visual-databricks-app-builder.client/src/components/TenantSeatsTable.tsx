import type {
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { DataTable } from "./ui/data-table";
import { getSeatUserColumns } from "../pages/seatUserColumns";
import type { SeatUserRow } from "../types/seatTable";

interface ITenantSeatsTableProps {
  rows: SeatUserRow[];
  loading: boolean;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  onViewUser: (userId: string) => void;
  onRowClick?: (row: SeatUserRow) => void;
  onRemoveUser?: (row: SeatUserRow) => void;
  onRemoveSeat?: (row: SeatUserRow) => void;
  showSeatManagementActions?: boolean;
  /** The current tenant's owner user id, used to flag the owner row. */
  ownerId?: string | null;
  /** Whether the viewer may transfer ownership to another member. */
  canTransferOwnership?: boolean;
  /** Invoked to make the row's user the new tenant owner. */
  onMakeOwner?: (row: SeatUserRow) => void;
  /** Invoked to remove the row's user from the tenant; omit to hide the action. */
  onRemoveFromTenant?: (row: SeatUserRow) => void;
  /** The signed-in user's id; users cannot remove themselves from a tenant. */
  currentUserId?: string;
}

const TenantSeatsTable = ({
  rows,
  loading,
  globalFilter,
  onGlobalFilterChange,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  columnFilters,
  onColumnFiltersChange,
  onViewUser,
  onRowClick,
  onRemoveUser,
  onRemoveSeat,
  showSeatManagementActions = true,
  ownerId,
  canTransferOwnership,
  onMakeOwner,
  onRemoveFromTenant,
  currentUserId,
}: Readonly<ITenantSeatsTableProps>) => {
  const columns = getSeatUserColumns({
    onView: onViewUser,
    onRemoveUser,
    onRemoveSeat,
    showSeatManagementActions,
    ownerId,
    canTransferOwnership,
    onMakeOwner,
    onRemoveFromTenant,
    currentUserId,
  });

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      globalFilter={globalFilter}
      onGlobalFilterChange={onGlobalFilterChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      columnFilters={columnFilters}
      onColumnFiltersChange={onColumnFiltersChange}
      onRowClick={onRowClick}
    />
  );
};

export default TenantSeatsTable;
