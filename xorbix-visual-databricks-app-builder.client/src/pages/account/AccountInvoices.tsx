import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { billingApi } from "../../providers/BillingApi";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useSubscription } from "../../hooks/useSubscription";
import type { Invoice } from "../../models";
import {
  ACCOUNT_PAGE_CONTAINER_CLASS,
  ACCOUNT_PAGE_SECTION_CLASS,
  ACCOUNT_PAGE_SUBTITLE_CLASS,
  ACCOUNT_PAGE_TITLE_CLASS,
} from "./accountPageStyles.ts";

const PAGE_SIZE = 25;

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

function formatCreatedDateTime(created: string | Date): string {
  return new Date(created).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AccountInvoices() {
  const { loading: subscriptionLoading, hasStripeCustomer } = useSubscription();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (subscriptionLoading) {
      return;
    }

    // Manually provisioned tenants have no Stripe customer and therefore no
    // invoices to retrieve.
    if (!hasStripeCustomer) {
      setLoading(false);
      return;
    }

    async function loadInvoices() {
      try {
        const response = await billingApi.getInvoices(0, PAGE_SIZE);
        setInvoices(response.invoices);
        setHasMore(response.hasMore);
      } catch {
        // No invoices or error
      } finally {
        setLoading(false);
      }
    }

    void loadInvoices();
  }, [subscriptionLoading, hasStripeCustomer]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const response = await billingApi.getInvoices(invoices.length, PAGE_SIZE);
      setInvoices((prev) => [...prev, ...response.invoices]);
      setHasMore(response.hasMore);
    } catch {
      // Error loading more
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading || subscriptionLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Manually provisioned tenants have no Stripe billing account, so there are
  // no invoices to display.
  if (!hasStripeCustomer) {
    return (
      <section className={ACCOUNT_PAGE_SECTION_CLASS}>
        <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
          <header>
            <h1 className={ACCOUNT_PAGE_TITLE_CLASS}>Invoices</h1>
            <p className={ACCOUNT_PAGE_SUBTITLE_CLASS}>
              View and download your billing invoices.
            </p>
          </header>

          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>No billing account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your plan was provisioned directly by an administrator and is not
                linked to a self-service billing account, so there are no
                invoices to display.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className={ACCOUNT_PAGE_SECTION_CLASS}>
      <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
        <header>
          <h1 className={ACCOUNT_PAGE_TITLE_CLASS}>Invoices</h1>
          <p className={ACCOUNT_PAGE_SUBTITLE_CLASS}>
            View and download your billing invoices.
          </p>
        </header>

        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No invoices found.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_100px_100px_auto] gap-4 border-b border-border pb-2 text-xs font-medium uppercase text-muted-foreground">
                  <span>Invoice</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>

                {/* Invoice Rows */}
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="grid grid-cols-[1fr_100px_100px_auto] items-center gap-4 border-b border-border py-3 text-sm last:border-0"
                  >
                    <div className="min-w-0">
                      <span className="block text-foreground">
                        {formatCreatedDateTime(invoice.created)}
                      </span>
                      <span
                        className="block truncate font-mono text-xs text-muted-foreground"
                        title={invoice.id}
                      >
                        {invoice.id}
                      </span>
                    </div>
                    <span className="font-medium text-foreground">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </span>
                    <span>
                      <StatusBadge status={invoice.status} />
                    </span>
                    <div className="flex justify-end gap-2">
                      {invoice.pdfUrl && (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {invoice.hostedInvoiceUrl && (
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          title="View Invoice"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {/* Load More */}
                {hasMore && (
                  <div className="pt-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const colorMap: Record<string, string> = {
    paid: "bg-success-subtle text-success-foreground",
    open: "bg-warning-subtle text-warning-foreground",
    draft: "bg-muted text-muted-foreground",
    void: "bg-destructive-subtle text-destructive-foreground",
    uncollectible: "bg-destructive-subtle text-destructive-foreground",
  };

  const colorClass = colorMap[status] ?? "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colorClass}`}
    >
      {status}
    </span>
  );
}

export default AccountInvoices;
