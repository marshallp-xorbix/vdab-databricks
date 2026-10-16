import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, MoreVertical } from "lucide-react";
import type { Tenant } from "../models";
import { Chip, type ChipProps } from "../components/ui/chip";
import { Button } from "../components/ui/button";
import {
  DataTableColumnHeader,
  dateRangeFilterFn,
  selectFilterFn,
} from "../components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

interface ITenantColumnActions {
  onView: (tenant: Tenant) => void;
  onDeactivate: (tenant: Tenant) => void;
  onReactivate: (tenant: Tenant) => void;
}

function formatCreatedDate(createdOn: Date | string | undefined): string {
  if (!createdOn) {
    return "-";
  }

  const date = createdOn instanceof Date ? createdOn : new Date(createdOn);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString();
}

function getUsersSummary(tenant: Tenant): string {
  if (typeof tenant.userCount === "number") {
    return `${tenant.userCount} / ${tenant.maxUsers}`;
  }

  const currentUsers = tenant.users?.length;
  if (typeof currentUsers === "number") {
    return `${currentUsers} / ${tenant.maxUsers}`;
  }

  return `- / ${tenant.maxUsers}`;
}

function getAppsSummary(tenant: Tenant): string {
  if (typeof tenant.appCount === "number") {
    return `${tenant.appCount} / ${tenant.maxPublishedApps}`;
  }

  return `- / ${tenant.maxPublishedApps}`;
}

const stripeCustomerUrl = (id: string): string =>
  `https://dashboard.stripe.com/customers/${id}`;

function getSubscriptionStatusChipVariant(
  status: string | undefined,
): ChipProps["variant"] {
  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "trialing":
      return "success";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "warning";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "destructive";
    default:
      return "outline";
  }
}

function formatSubscriptionStatusLabel(status: string | undefined): string {
  const value = (status ?? "").trim();
  if (!value) return "None";
  return value
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function getTenantColumns(
  actions: ITenantColumnActions,
): ColumnDef<Tenant>[] {
  return [
    {
      id: "tenant",
      accessorFn: (row) => `${row.displayName} ${row.tenantName}`,
      meta: { filterType: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenant" />
      ),
      cell: ({ row }) => {
        const tenant = row.original;

        return (
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground">
              {tenant.displayName}
            </div>
            <div className="text-xs text-muted-foreground">{tenant.tenantName}</div>
          </div>
        );
      },
    },
    {
      id: "subscriptionTier",
      accessorFn: (row) => row.subscriptionTier,
      meta: { filterType: "select" },
      filterFn: selectFilterFn,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subscription Tier" />
      ),
      cell: ({ row }) => {
        const tenant = row.original;
        const billingCustomerId = tenant.billingCustomerId;

        return (
          <div className="space-y-1">
            <div className="text-sm text-foreground">
              {tenant.subscriptionTier || "N/A"}{" "}
              <Chip
                variant={getSubscriptionStatusChipVariant(
                  tenant.subscriptionStatus,
                )}
              >
                {formatSubscriptionStatusLabel(tenant.subscriptionStatus)}
              </Chip>
            </div>

            {billingCustomerId ? (
              <a
                href={stripeCustomerUrl(billingCustomerId)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                title={`View customer ${billingCustomerId} in Stripe Dashboard`}
                className="inline-flex max-w-[200px] items-center gap-1 truncate font-mono text-xs text-primary hover:underline"
              >
                <span className="truncate">{billingCustomerId}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <div className="font-mono text-xs text-muted-foreground">
                No Stripe customer
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "users",
      accessorFn: (row) => getUsersSummary(row),
      meta: { filterType: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Users" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {getUsersSummary(row.original)}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "apps",
      accessorFn: (row) => getAppsSummary(row),
      meta: { filterType: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Apps" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {getAppsSummary(row.original)}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "status",
      accessorFn: (row) => (row.isActive ? "active" : "inactive"),
      meta: { filterType: "select" },
      filterFn: selectFilterFn,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) =>
        row.original.isActive ? (
          <Chip variant="success">Active</Chip>
        ) : (
          <Chip variant="destructive">Inactive</Chip>
        ),
    },
    {
      id: "created",
      accessorFn: (row) => row.createdOn,
      meta: { filterType: "date" },
      filterFn: dateRangeFilterFn,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {formatCreatedDate(row.original.createdOn)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => (
        <span className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Actions
        </span>
      ),
      cell: ({ row }) => {
        const tenant = row.original;

        return (
          <div
            className="inline-flex items-center gap-2"
            data-row-double-click="ignore"
          >
            <Button
              variant="link"
              onClick={() => actions.onView(tenant)}
              className="px-0 text-foreground"
            >
              View
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open actions menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tenant.isActive ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => actions.onDeactivate(tenant)}
                  >
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => actions.onReactivate(tenant)}
                  >
                    Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
