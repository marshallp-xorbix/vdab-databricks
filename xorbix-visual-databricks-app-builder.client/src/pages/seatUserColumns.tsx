import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "../components/ui/button";
import { Chip } from "../components/ui/chip";
import SeatRowActionsMenu from "../components/SeatRowActionsMenu";
import {
  DataTableColumnHeader,
  selectFilterFn,
} from "../components/ui/data-table";
import type { SeatUserColumnActions, SeatUserRow } from "../types/seatTable";

function formatSeatDate(date?: Date): string {
  if (!date) return "";
  return date.toLocaleDateString();
}

export function getSeatUserColumns(
  actions: SeatUserColumnActions,
): ColumnDef<SeatUserRow>[] {
  return [
    {
      id: "seatNumber",
      accessorFn: (row) => row.seatNumber,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Seat #" />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">
          {row.original.seatNumber}
        </span>
      ),
    },
    {
      id: "user",
      accessorFn: (row) => {
        if (row.user) {
          return `${row.user.fullName ?? ""} ${row.user.email} ${row.user.userName ?? ""}`;
        }
        return row.seat.userEmail ?? row.seat.userDisplayName ?? "";
      },
      meta: { filterType: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: ({ row }) => {
        const { user, seat } = row.original;
        const displayName =
          user?.fullName || user?.userName || seat.userDisplayName;
        const email = user?.email || seat.userEmail;

        if (!displayName && !email) {
          return <span className="text-xs text-muted-foreground">Unassigned</span>;
        }

        const initials = (() => {
          if (user?.firstName || user?.lastName) {
            return `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`;
          }
          return (email ?? "??").slice(0, 2).toUpperCase();
        })();

        const isOwner = !!actions.ownerId && seat.userId === actions.ownerId;

        return (
          <div className="flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 ring-1 ring-blue-200/70">
              {initials}
            </div>
            <div className="ml-4">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-foreground">
                  {displayName ?? email}
                </div>
                {isOwner ? (
                  <Chip
                    variant="default"
                    className="bg-warning-subtle text-warning-foreground"
                  >
                    Owner
                  </Chip>
                ) : null}
              </div>
              {displayName && email ? (
                <div className="text-sm text-muted-foreground">{email}</div>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      accessorFn: (row) => {
        const { user } = row;
        if (!user) return "Unassigned";
        if (!user.isActive) return "Inactive";
        if (user.emailConfirmed) return "Active";
        return "Unconfirmed";
      },
      meta: { filterType: "select" },
      filterFn: selectFilterFn,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const { user } = row.original;
        if (!user) return <Chip variant="default">Unassigned</Chip>;
        if (!user.isActive) return <Chip variant="destructive">Inactive</Chip>;
        if (user.emailConfirmed) return <Chip variant="success">Active</Chip>;
        return <Chip variant="warning">Unconfirmed</Chip>;
      },
    },
    {
      id: "seatSubscription",
      accessorFn: (row) => row.seat.status,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Seat Subscription" />
      ),
      cell: ({ row }) => {
        const { seat, isSyntheticSeat } = row.original;
        if (isSyntheticSeat) {
          return <span className="text-sm text-muted-foreground">No seat</span>;
        }
        if (seat.status === "PendingCancellation") {
          return (
            <span className="text-sm text-warning-foreground">
              Ends {formatSeatDate(seat.seatEndDate)}
            </span>
          );
        }
        return <span className="text-sm text-muted-foreground">In sync</span>;
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => (
        <span className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Actions
        </span>
      ),
      cell: ({ row }) => {
        const { user } = row.original;
        return (
          <div
            className="inline-flex items-center gap-2"
            data-row-double-click="ignore"
          >
            {user ? (
              <Button
                variant="link"
                onClick={() => actions.onView(user.id)}
                className="px-0 text-foreground"
              >
                View
              </Button>
            ) : null}
            <SeatRowActionsMenu row={row.original} actions={actions} />
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
