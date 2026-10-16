import type { ColumnDef } from "@tanstack/react-table";
import { Download, ExternalLink } from "lucide-react";
import { Chip } from "../ui/chip";
import { DataTableColumnHeader } from "../ui/data-table";
import { Invoice } from "../../models";

function statusVariant(
  status: string,
): "default" | "success" | "warning" | "destructive" {
  switch (status) {
    case "paid":
      return "success";
    case "open":
    case "draft":
      return "warning";
    case "void":
    case "uncollectible":
      return "destructive";
    default:
      return "default";
  }
}

// Backend already converts Stripe's smallest-currency-unit amounts into the major unit.
function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function getInvoiceColumns(): ColumnDef<Invoice>[] {
  return [
    {
      id: "created",
      accessorFn: (row) => row.created,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.created.toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "id",
      accessorFn: (row) => row.id,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.id}
        </span>
      ),
    },
    {
      id: "amount",
      accessorFn: (row) => row.amount,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">
          {formatAmount(row.original.amount, row.original.currency)}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Chip variant={statusVariant(row.original.status)}>
          {row.original.status}
        </Chip>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {row.original.pdfUrl ? (
            <a
              href={row.original.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              title="Download PDF"
            >
              <Download className="h-4 w-4" />
            </a>
          ) : null}
          {row.original.hostedInvoiceUrl ? (
            <a
              href={row.original.hostedInvoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              title="View invoice"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      ),
    },
  ];
}
