import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { ManagementPageHeader } from "../components/ManagementPageHeader";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "../components/ui/use-toast";
import { managementApi } from "../providers/ManagementApi";
import { useLogger } from "../logger/useLogger";
import type { IStripeEventLogDto } from "../models/StripeEventLog";

const PAGE_SIZE = 25;

function StripeEventHistory() {
  const logger = useLogger("StripeEventHistory");
  const [logs, setLogs] = useState<IStripeEventLogDto[]>([]);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const loadPage = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setIsError(false);
      try {
        const response = await managementApi.getStripeEventLogs(
          nextPage,
          PAGE_SIZE,
        );
        setLogs(response.logs);
        setTotalCount(response.totalCount);
        setPageNumber(response.pageNumber);
      } catch (err) {
        logger.UI.error("Failed to load Stripe event logs", err);
        setIsError(true);
        toast({
          title: "Failed to load Stripe events",
          description:
            err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [logger],
  );

  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canPrev = pageNumber > 1 && !isLoading;
  const canNext = pageNumber < totalPages && !isLoading;

  return (
    <section className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <ManagementPageHeader
          title="Stripe Event History"
          description="Recent Stripe webhook events processed by the platform."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadPage(pageNumber)}
              disabled={isLoading}
            >
              Refresh
            </Button>
          }
        />

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead>Status</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Stripe Event ID</TableHead>
                <TableHead>Processed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-border border-t-primary" />
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && isError ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-destructive-foreground"
                  >
                    Failed to load Stripe events.{" "}
                    <button
                      type="button"
                      onClick={() => void loadPage(pageNumber)}
                      className="font-medium underline"
                    >
                      Retry
                    </button>
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && !isError && logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center italic text-muted-foreground"
                  >
                    No Stripe events have been logged yet.
                  </TableCell>
                </TableRow>
              ) : null}

              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.success ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-foreground"
                        title="Success"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Success
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-destructive-subtle px-2 py-0.5 text-xs font-medium text-destructive-foreground"
                        title={log.errorMessage ?? "Failed"}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Failed
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {log.eventType}
                  </TableCell>
                  <TableCell className="max-w-[28rem] whitespace-normal text-muted-foreground">
                    {log.detailSummary ?? log.errorMessage ?? (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.customerId ?? (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.stripeEventId}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={new Date(log.processedAt).toLocaleString()}
                  >
                    {new Date(log.processedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            <div>
              {totalCount === 0
                ? "0 events"
                : `Page ${pageNumber} of ${totalPages} — ${totalCount.toLocaleString()} event${totalCount === 1 ? "" : "s"}`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadPage(pageNumber - 1)}
                disabled={!canPrev}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadPage(pageNumber + 1)}
                disabled={!canNext}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StripeEventHistory;
