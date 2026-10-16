import type { ColumnDef } from "@tanstack/react-table";
import { Chip } from "../ui/chip";
import { DataTableColumnHeader } from "../ui/data-table";
import { SubscriptionHistory } from "../../models";

function paymentStatusVariant(
  status?: string | null,
): "default" | "success" | "warning" | "destructive" {
  switch (status) {
    case "Completed":
      return "success";
    case "Pending":
      return "warning";
    case "Failed":
    case "Refunded":
      return "destructive";
    default:
      return "default";
  }
}

function formatAmount(
  amount: number | null | undefined,
  currency: string,
): string {
  if (amount === null || amount === undefined) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function getSubscriptionHistoryColumns(): ColumnDef<SubscriptionHistory>[] {
  return [
    {
      id: "eventDate",
      accessorFn: (row) => row.eventDate,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="When" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.eventDate.toLocaleString()}
        </span>
      ),
    },
    {
      id: "eventType",
      accessorFn: (row) => row.eventType,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Event" />
      ),
      cell: ({ row }) => (
        <Chip variant="default">{row.original.eventType}</Chip>
      ),
    },
    {
      id: "subscriptionTier",
      accessorFn: (row) => row.subscriptionTier,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tier" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.subscriptionTier}
        </span>
      ),
    },
    {
      id: "billingCycle",
      accessorFn: (row) => row.billingCycle,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cycle" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.billingCycle}
        </span>
      ),
    },
    {
      id: "amount",
      accessorFn: (row) => row.amount ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {formatAmount(row.original.amount, row.original.currency)}
        </span>
      ),
    },
    {
      id: "paymentStatus",
      accessorFn: (row) => row.paymentStatus ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Payment" />
      ),
      cell: ({ row }) => {
        const status = row.original.paymentStatus;
        if (!status) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return <Chip variant={paymentStatusVariant(status)}>{status}</Chip>;
      },
    },
    {
      id: "notes",
      accessorFn: (row) => row.notes ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Notes" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.notes ?? (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </span>
      ),
      enableSorting: false,
    },
  ];
}
