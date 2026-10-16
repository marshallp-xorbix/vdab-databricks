import type { ColumnDef } from "@tanstack/react-table";
import { MoreVertical } from "lucide-react";
import type { ApplicationUser } from "../models";
import { Button } from "../components/ui/button";
import { Chip } from "../components/ui/chip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  DataTableColumnHeader,
  selectFilterFn,
  dateRangeFilterFn,
} from "../components/ui/data-table";

interface UserColumnActions {
  onView: (userId: string) => void;
  onDeactivate: (user: ApplicationUser) => void;
  onReactivate: (userId: string) => void;
}

export type UserStatusLabel =
  | "Removed"
  | "Inactive"
  | "Suspended in this workspace"
  | "Active"
  | "Unconfirmed";

/**
 * Account Status column: account states outrank membership suspension; Suspended
 * is only shown for the caller's current tenant (not other orgs).
 */
export function resolveUserStatus(
  user: ApplicationUser,
  currentTenantId?: string | null,
): UserStatusLabel {
  if (user.deletedOn) return "Removed";
  if (!user.isActive) return "Inactive";

  if (currentTenantId) {
    const membershipInCurrentTenant = (user.tenantMembershipsSummary ?? []).find(
      (membership) => membership.tenantId === currentTenantId,
    );
    if (membershipInCurrentTenant?.status === "Suspended") {
      return "Suspended in this workspace";
    }
  }

  if (user.emailConfirmed) return "Active";
  return "Unconfirmed";
}

function getSortedMemberships(user: ApplicationUser) {
  return [...(user.tenantMembershipsSummary ?? [])].sort((a, b) =>
    a.tenantDisplayName.localeCompare(b.tenantDisplayName),
  );
}

function getPrimaryTenantDisplayName(user: ApplicationUser): string {
  const memberships = user.tenantMembershipsSummary ?? [];
  if (memberships.length === 0) {
    return "";
  }

  const primaryMembership = memberships.find(
    (membership) => membership.isPrimary,
  );
  if (primaryMembership) {
    return primaryMembership.tenantDisplayName;
  }

  const defaultMembership = memberships.find(
    (membership) => membership.isDefault,
  );
  if (defaultMembership) {
    return defaultMembership.tenantDisplayName;
  }

  const [firstMembership] = getSortedMemberships(user);
  return firstMembership?.tenantDisplayName ?? "";
}

export function getUserColumns(
  actions: UserColumnActions,
  currentTenantId?: string | null,
): ColumnDef<ApplicationUser>[] {
  return [
    {
      id: "user",
      accessorFn: (row) => `${row.fullName} ${row.email} ${row.userName}`,
      meta: { filterType: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-1 ring-primary/25">
              {`${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` ||
                user.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-foreground">
                {user.fullName || user.userName}
              </div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: "roles",
      accessorFn: (row) => row.roles?.join(", ") ?? "",
      meta: { filterType: "select" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Roles" />
      ),
      cell: ({ row }) => {
        const roles = row.original.roles;
        return (
          <div className="flex flex-wrap gap-1">
            {roles && roles.length > 0 ? (
              roles.map((role) => (
                <Chip key={`${row.original.id}-${role}`} variant="default">
                  {role}
                </Chip>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No roles</span>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "tenants",
      accessorFn: (row) => getPrimaryTenantDisplayName(row),
      meta: { filterType: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenants" />
      ),
      cell: ({ row }) => {
        const memberships = row.original.tenantMembershipsSummary ?? [];
        if (memberships.length === 0) {
          return <span className="text-sm text-muted-foreground">No tenant</span>;
        }

        if (memberships.length === 1) {
          return (
            <span className="text-sm font-medium text-foreground">
              {memberships[0].tenantDisplayName}
            </span>
          );
        }

        const sortedMemberships = getSortedMemberships(row.original);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-sm font-medium text-foreground underline decoration-dotted underline-offset-2">
                {`${memberships.length} tenants`}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs px-3 py-2">
              <div className="space-y-1">
                {sortedMemberships.map((membership) => (
                  <div
                    key={`${row.original.id}-${membership.tenantId}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-background">
                      {membership.tenantDisplayName}
                    </span>
                    {membership.isPrimary && (
                      <span className="rounded bg-background/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-background">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "status",
      accessorFn: (row) => resolveUserStatus(row, currentTenantId),
      meta: { filterType: "select" },
      filterFn: selectFilterFn,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = resolveUserStatus(row.original, currentTenantId);
        if (status === "Suspended in this workspace") {
          return <Chip variant="warning">{status}</Chip>;
        }
        if (status === "Removed") {
          return <Chip variant="destructive">Removed</Chip>;
        }
        if (status === "Inactive") {
          return <Chip variant="destructive">Inactive</Chip>;
        }
        if (status === "Active") {
          return <Chip variant="success">Active</Chip>;
        }
        return <Chip variant="warning">Unconfirmed</Chip>;
      },
    },
    {
      id: "lastLogin",
      accessorFn: (row) => row.lastLoginAt ?? null,
      meta: { filterType: "date" },
      filterFn: dateRangeFilterFn,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Login" />
      ),
      cell: ({ row }) => {
        const lastLogin = row.original.lastLoginAt;
        return (
          <span className="text-sm text-muted-foreground">
            {lastLogin ? new Date(lastLogin).toLocaleString() : "Never"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => (
        <span className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Actions
        </span>
      ),
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div
            className="inline-flex items-center gap-2"
            data-row-double-click="ignore"
          >
            <Button
              variant="link"
              onClick={() => actions.onView(user.id)}
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
                {user.deletedOn ? (
                  <DropdownMenuItem
                    onClick={() => actions.onReactivate(user.id)}
                  >
                    Restore
                  </DropdownMenuItem>
                ) : user.isActive ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => actions.onDeactivate(user)}
                  >
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => actions.onReactivate(user.id)}
                  >
                    Restore
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
