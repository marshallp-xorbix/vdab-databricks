import { RefreshCw, Server } from "lucide-react";
import { useIdentity } from "../context/IdentityContext";
import { useHealthStatus } from "../hooks/useHealthStatus";
import { isGlobalAdministrator } from "../utils/roles";
import { Button } from "../components/ui/button";
import { HEALTH_STATUS } from "../types/HealthStatus";

function getStatusColor(status: string) {
  switch (status) {
    case HEALTH_STATUS.Healthy:
      return "text-success";

    case HEALTH_STATUS.Degraded:
      return "text-warning";

    default:
      return "text-destructive";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case HEALTH_STATUS.Healthy:
      return "bg-success-subtle text-success-foreground";

    case HEALTH_STATUS.Degraded:
      return "bg-warning-subtle text-warning-foreground";

    default:
      return "bg-destructive-subtle text-destructive-foreground";
  }
}

function getServiceName(name: string) {
  const names: Record<string, string> = {
    self: "API",
    Postgres: "PostgreSQL",
    EmailService: "Email Service",
    Stripe: "Stripe",
    DatabricksAi: "Databricks AI",
  };

  return names[name] ?? name;
}

export default function HealthPage() {
  const { user } = useIdentity();
  const { data, isLoading, refetch, error } = useHealthStatus();
  const isAdmin = isGlobalAdministrator(user);
  const overallStatus = data?.status ?? "Unknown";
  const checks = data?.checks ?? [];

  if (!user) {
    return <div className="p-6">Please sign in to view this page.</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          Only global administrators can view system health.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6">Loading health status...</div>;
  }

  if (error && !data) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">System Health</h1>
            <p className="text-muted-foreground">
              Real-time platform and dependency monitoring
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              void refetch();
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>

        <div className="rounded-xl border-2 border-border/40 bg-card p-6">
          <div className="flex items-center gap-4">
            <Server className="h-10 w-10" />

            <div>
              <div className="text-sm text-muted-foreground">
                Overall Platform Status
              </div>

              <div className="text-2xl font-bold text-destructive">Unknown</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">
            Unable to load system health
          </h2>
          <p className="mt-2 text-muted-foreground">
            The health service is unavailable right now. Try refreshing to
            retry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>

          <p className="text-muted-foreground">
            Real-time platform and dependency monitoring
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            void refetch();
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>
      {/* Overall Status */}
      <div className="rounded-xl border-2 border-border/40 bg-card p-6">
        <div className="flex items-center gap-4">
          <Server className="h-10 w-10" />

          <div>
            <div className="text-sm text-muted-foreground">
              Overall Platform Status
            </div>

            <div
              className={`text-2xl font-bold ${getStatusColor(overallStatus)}`}
            >
              {overallStatus}
            </div>
          </div>
        </div>
      </div>
      {/* Service Cards */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Service Health</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => (
            <div
              key={check.name}
              className="rounded-xl border-2 border-border/40 bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {getServiceName(check.name)}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(
                    check.status,
                  )}`}
                >
                  {check.status}
                </span>
              </div>

              <div className="mt-3 text-sm text-muted-foreground">
                {check.description ?? "No status description available"}
              </div>

              <div className="mt-4 text-xs text-muted-foreground">
                Response Time: {Math.round(check.durationMs)}ms
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* TODO: Finish implementing an actual historical table to replace the placeholder below*/}
      {/* Historical Health Section */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Historical Health</h2>

        <div className="rounded-xl border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 text-left">Timestamp</th>
                <th className="p-4 text-left">Service</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Duration</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td
                  colSpan={4}
                  className="p-8 text-center text-muted-foreground"
                >
                  Historical health monitoring has not been configured yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
