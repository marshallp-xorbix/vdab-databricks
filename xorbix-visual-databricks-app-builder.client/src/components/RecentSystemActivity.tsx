import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useRecentAuditActivity } from "../hooks/useAuditLogsQuery";
import type { AuditLogDto } from "../models/AuditLog";
import { Button } from "./ui/button";
import type { AuditScope } from "../types/auditLog";

interface IRecentSystemActivityProps {
  /** Scope to pull recent entries for. Defaults to `{ kind: "all" }`. */
  scope?: AuditScope;
  /** Header text; defaults to "Recent System Activity". */
  title?: string;
  /** Where the "View All" link points. Defaults to the global audit log page. */
  viewAllHref?: string;
  /** How many recent entries to show. Defaults to 5. */
  take?: number;
}

function severityClass(severity: string): string {
  switch (severity) {
    case "Warning":
      return "bg-warning-subtle text-warning-foreground";
    case "Error":
    case "Critical":
      return "bg-destructive-subtle text-destructive-foreground";
    case "Info":
    default:
      return "bg-success-subtle text-success-foreground";
  }
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function renderRows(items: AuditLogDto[]): ReactNode {
  if (items.length === 0) {
    return (
      <tr>
        <td colSpan={4} className="px-6 py-6 text-center italic text-muted-foreground">
          No recent activity.
        </td>
      </tr>
    );
  }

  return items.map((log) => (
    <tr key={log.auditLogId} className="bg-card hover:bg-muted/60">
      <td className="px-6 py-4 font-medium text-foreground">
        {log.actionType}
        <div className="text-xs font-normal text-muted-foreground">
          {log.description}
        </div>
      </td>
      <td className="px-6 py-4">
        {log.userFullName ?? log.userEmail ?? (
          <span className="text-xs text-muted-foreground">System</span>
        )}
      </td>
      <td className="px-6 py-4">
        <span
          className={`rounded px-2.5 py-0.5 text-xs font-medium ${severityClass(log.severity)}`}
        >
          {log.severity}
        </span>
      </td>
      <td
        className="px-6 py-4 text-muted-foreground"
        title={log.timestamp.toLocaleString()}
      >
        {formatRelative(log.timestamp)}
      </td>
    </tr>
  ));
}

function renderBody(
  items: AuditLogDto[],
  isLoading: boolean,
  isError: boolean,
  onRetry: () => void,
): ReactNode {
  if (isLoading) {
    return (
      <tr>
        <td colSpan={4} className="px-6 py-6 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-border border-t-primary" />
        </td>
      </tr>
    );
  }

  if (isError) {
    return (
      <tr>
        <td colSpan={4} className="px-6 py-6 text-center">
          <span className="text-destructive-foreground">Failed to load recent activity.</span>
          <button
            type="button"
            onClick={onRetry}
            className="ml-2 font-medium text-destructive-foreground underline"
          >
            Retry
          </button>
        </td>
      </tr>
    );
  }

  return renderRows(items);
}

export function RecentSystemActivity({
  scope = { kind: "all" },
  title = "Recent System Activity",
  viewAllHref = "/administration/auditlogs",
  take = 5,
}: Readonly<IRecentSystemActivityProps>) {
  const { items, isLoading, isError, refetch } = useRecentAuditActivity({
    scope,
    take,
  });

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <Button variant="link" asChild className="text-sm text-primary">
          <Link to={viewAllHref}>View All</Link>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-muted-foreground">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Event</th>
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-6 py-3 font-medium">Severity</th>
              <th className="px-6 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {renderBody(items, isLoading, isError, () => refetch())}
          </tbody>
        </table>
      </div>
    </section>
  );
}
