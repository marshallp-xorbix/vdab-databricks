import type { ReactNode } from "react";
import type { AuditLogDto } from "../../models/AuditLog";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

export interface ISecurityEventsCardProps {
  events: AuditLogDto[];
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  onViewAll: () => void;
}

const SecurityEventsCard = ({
  events,
  loading,
  isError,
  onRetry,
  onViewAll,
}: Readonly<ISecurityEventsCardProps>) => {
  let content: ReactNode;

  if (loading) {
    content = (
      <div className="flex justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-border border-t-primary"></div>
      </div>
    );
  } else if (isError) {
    content = (
      <div className="space-y-2 text-sm text-destructive-foreground">
        <p>Failed to load security events.</p>
        <Button variant="link" className="h-auto p-0 text-sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  } else if (events.length === 0) {
    content = (
      <p className="text-sm text-muted-foreground">
        No recent security events for this user.
      </p>
    );
  } else {
    content = (
      <ul className="space-y-2">
        {events.map((event) => (
          <li
            key={event.auditLogId}
            className="rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">
                {event.actionType}
              </span>
              <span
                className="text-[11px] text-muted-foreground"
                title={event.timestamp.toLocaleString()}
              >
                {event.timestamp.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {event.ipAddress ? `IP: ${event.ipAddress}` : "IP unavailable"}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card className="rounded-xl border border-dashed border-border bg-muted/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">
          Security Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {content}
        <Button
          variant="link"
          className="h-auto p-0 text-sm text-primary"
          onClick={onViewAll}
        >
          View all activity
        </Button>
      </CardContent>
    </Card>
  );
};

export default SecurityEventsCard;
