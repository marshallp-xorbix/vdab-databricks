import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Laptop,
  Loader2,
  MapPin,
  Monitor,
  RotateCcw,
  Smartphone,
  Tablet,
  XCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Chip } from "./ui/chip";
import { toast } from "./ui/use-toast";
import { useIdentity } from "../context/IdentityContext";
import { userApi } from "../providers/UserApi";
import type { IUserSession, IUserSessionsResponse } from "../models";

interface Props {
  userId?: string;
  isSelfService?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getDeviceIcon(deviceType?: string) {
  switch (deviceType?.toLowerCase()) {
    case "mobile":
      return <Smartphone className="h-4 w-4" />;
    case "tablet":
      return <Tablet className="h-4 w-4" />;
    case "desktop":
      return <Laptop className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
}

function getStatusChip(session: IUserSession) {
  if (session.isRevoked) {
    return <Chip variant="destructive">Revoked</Chip>;
  }
  if (session.isExpired) {
    return <Chip variant="warning">Expired</Chip>;
  }
  if (session.isActive) {
    return <Chip variant="success">Active</Chip>;
  }
  return <Chip variant="secondary">Inactive</Chip>;
}

function formatLocation(session: IUserSession): string {
  const parts: string[] = [];
  if (session.city) parts.push(session.city);
  if (session.region) parts.push(session.region);
  if (session.country) parts.push(session.country);
  return parts.length > 0 ? parts.join(", ") : "Unknown location";
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function UserSessionsTab({ userId, isSelfService }: Props) {
  const { user: identityUser, clearLocalSession } = useIdentity();
  const resolvedUserId = isSelfService ? identityUser?.userId : userId;

  const [sessions, setSessions] = useState<IUserSession[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<{
    open: boolean;
    session: IUserSession | null;
  }>({ open: false, session: null });
  const [revoking, setRevoking] = useState(false);

  const loadSessions = useCallback(
    async (skip: number, take: number, append: boolean) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const response: IUserSessionsResponse = await userApi.getUserSessions(
          resolvedUserId!,
          skip,
          take,
          activeOnly,
        );
        setSessions((prev) =>
          append ? [...prev, ...response.sessions] : response.sessions,
        );
        setTotalCount(response.totalCount);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load sessions.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [resolvedUserId, activeOnly],
  );

  useEffect(() => {
    if (resolvedUserId) loadSessions(0, pageSize, false);
  }, [resolvedUserId, loadSessions, pageSize, activeOnly]);

  const handleLoadMore = () => {
    loadSessions(sessions.length, pageSize, true);
  };

  const handleRevokeClick = (session: IUserSession) => {
    setRevokeConfirm({ open: true, session });
  };

  const confirmRevoke = async () => {
    if (!revokeConfirm.session) return;
    setRevoking(true);
    try {
      const response = await userApi.revokeSession(
        resolvedUserId!,
        revokeConfirm.session.id,
      );
      if (response.revokedCurrentSession) {
        toast({
          title: "Session revoked",
          description: "This session was revoked. Signing you out.",
        });
        clearLocalSession({ redirectTo: "/login" });
        return;
      }
      toast({
        title: "Session revoked",
        description: "The session has been terminated.",
      });
      loadSessions(0, sessions.length, false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to revoke session.",
        variant: "destructive",
      });
    } finally {
      setRevoking(false);
      setRevokeConfirm({ open: false, session: null });
    }
  };

  const hasMore = sessions.length < totalCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading sessions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {sessions.length} of {totalCount} sessions
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="active-only-toggle"
              checked={activeOnly}
              onCheckedChange={setActiveOnly}
            />
            <Label
              htmlFor="active-only-toggle"
              className="text-xs text-muted-foreground"
            >
              Active only
            </Label>
          </div>
          <span className="text-xs text-muted-foreground">Per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => setPageSize(Number(val))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Refresh sessions"
            onClick={() => loadSessions(0, pageSize, false)}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-border bg-muted/60">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Monitor className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No sessions found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={session.sessionId}
              className="rounded-xl border border-border bg-card shadow-sm"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {getDeviceIcon(session.deviceType)}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {session.browser ?? "Unknown Browser"}
                        </span>
                        {session.isCurrentSession && (
                          <Chip variant="secondary">This device</Chip>
                        )}
                        <span className="text-xs text-muted-foreground">on</span>
                        <span className="text-sm text-foreground">
                          {session.operatingSystem ?? "Unknown OS"}
                        </span>
                        {getStatusChip(session)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {formatLocation(session)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {session.ipAddress ?? "Unknown IP"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                        <span>Started: {formatDate(session.firstSeenAt)}</span>
                        <span>
                          Last activity: {formatDate(session.lastActivityAt)}
                        </span>
                        <span>Expires: {formatDate(session.expiresAt)}</span>
                        {session.isRevoked && session.revokedAt && (
                          <span className="text-destructive">
                            Revoked: {formatDate(session.revokedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {session.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive hover:bg-destructive-subtle hover:text-destructive-foreground"
                      onClick={() => handleRevokeClick(session)}
                      title="Revoke this session"
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Revoke
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              `Load More (${totalCount - sessions.length} remaining)`
            )}
          </Button>
        </div>
      )}

      <Dialog
        open={revokeConfirm.open}
        onOpenChange={(open) => {
          if (!open) setRevokeConfirm({ open: false, session: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this session? The user will be
              logged out of this device immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeConfirm({ open: false, session: null })}
              disabled={revoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRevoke}
              disabled={revoking}
            >
              {revoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Session"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
