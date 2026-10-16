import type { ColumnDef } from "@tanstack/react-table";
import { Chip } from "../ui/chip";
import { DataTableColumnHeader } from "../ui/data-table";
import { AuditLogDto } from "../../models/AuditLog";
import type { AuditScope } from "../../types/auditLog";

interface BuildAuditLogColumnsOptions {
  /** Drives column visibility — User col hides on `user` scope, Tenant col on `tenant` scope. */
  scope: AuditScope;
}

function severityVariant(
  severity: string,
): "default" | "success" | "warning" | "destructive" {
  switch (severity) {
    case "Warning":
      return "warning";
    case "Error":
    case "Critical":
      return "destructive";
    case "Info":
    default:
      return "default";
  }
}

/**
 * Factory producing the audit log column set for a given scope.
 * - `all` scope: shows both User and Tenant columns.
 * - `user` scope: hides User column (every row is the same user).
 * - `tenant` scope: hides Tenant column (every row is the same tenant).
 */
export function getAuditLogColumns({
  scope,
}: BuildAuditLogColumnsOptions): ColumnDef<AuditLogDto>[] {
  const columns: ColumnDef<AuditLogDto>[] = [
    {
      id: "timestamp",
      accessorFn: (row) => row.timestamp,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="When" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.timestamp.toLocaleString()}
        </span>
      ),
    },
  ];

  if (scope.kind !== "user") {
    columns.push({
      id: "user",
      accessorFn: (row) => row.userFullName ?? row.userEmail ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: ({ row }) => {
        const { userFullName, userEmail } = row.original;
        if (!userFullName && !userEmail) {
          return <span className="text-xs text-muted-foreground">System</span>;
        }
        return (
          <div>
            <div className="text-sm font-medium text-foreground">
              {userFullName || userEmail}
            </div>
            {userFullName && userEmail ? (
              <div className="text-xs text-muted-foreground">{userEmail}</div>
            ) : null}
          </div>
        );
      },
    });
  }

  if (scope.kind !== "tenant") {
    columns.push({
      id: "tenant",
      accessorFn: (row) => row.tenantDisplayName ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenant" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.tenantDisplayName ?? (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </span>
      ),
    });
  }

  columns.push(
    {
      id: "actionType",
      accessorFn: (row) => row.actionType,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Action" />
      ),
      cell: ({ row }) => <Chip variant="default">{row.original.actionType}</Chip>,
    },
    {
      id: "description",
      accessorFn: (row) => row.description,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.description}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "severity",
      accessorFn: (row) => row.severity,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Severity" />
      ),
      cell: ({ row }) => (
        <Chip variant={severityVariant(row.original.severity)}>
          {row.original.severity}
        </Chip>
      ),
    },
  );

  return columns;
}
