import { RefreshCw, Server } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { usePlatformStatus } from "../hooks/usePlatformStatus";

function getStatusColor(status: string) {
  switch (status) {
    case "Operational":
      return "text-success";

    case "Degraded":
      return "text-warning";

    default:
      return "text-destructive";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "Operational":
      return "bg-success-subtle text-success-foreground";

    case "Degraded":
      return "bg-warning-subtle text-warning-foreground";

    default:
      return "bg-destructive-subtle text-destructive-foreground";
  }
}

function getServiceName(name: string) {
  const names: Record<string, string> = {
    paymentsAvailable: "Payments",
    aiAvailable: "AI",
  };

  return names[name] ?? name;
}

export default function StatusPage() {
  const { data, isLoading, error, refetch } = usePlatformStatus();

  if (isLoading) {
    return (
      <section className="min-h-full p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
            Loading status...
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <h1 className="text-2xl font-bold">Platform Status</h1>

        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive-subtle p-4 text-destructive-foreground">
          We couldn't retrieve the current platform status. Please try again in
          a few moments.
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Platform Status
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Current availability for payments and AI services.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void refetch();
            }}
            className="inline-flex items-center gap-2 border-border bg-card text-foreground hover:bg-muted/60"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </header>

        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground">
              <Server className="h-6 w-6" />
            </div>

            <div>
              <div className="text-sm text-muted-foreground">
                Overall Platform Status
              </div>
              <div
                className={`text-2xl font-bold ${getStatusColor(
                  data?.platformStatus ?? "Unknown",
                )}`}
              >
                {data?.platformStatus ?? "Unknown"}
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Service Availability
          </h2>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {(["paymentsAvailable", "aiAvailable"] as const).map(
              (serviceKey) => {
                const available = data?.[serviceKey] ?? false;
                return (
                  <Card
                    key={serviceKey}
                    className="shadow-sm"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-foreground">
                          {getServiceName(serviceKey)}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            available
                              ? "bg-success-subtle text-success-foreground"
                              : "bg-destructive-subtle text-destructive-foreground"
                          }`}
                        >
                          {available ? "Available" : "Unavailable"}
                        </span>
                      </div>

                      <div className="mt-3 text-sm text-muted-foreground">
                        {available
                          ? `${getServiceName(serviceKey)} is operating normally.`
                          : `${getServiceName(serviceKey)} is currently unavailable.`}
                      </div>
                    </CardContent>
                  </Card>
                );
              },
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
