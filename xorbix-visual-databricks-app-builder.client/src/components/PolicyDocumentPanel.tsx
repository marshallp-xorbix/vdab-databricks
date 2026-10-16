import { ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { useLegalPage } from "../hooks/useLegalPage";
import { authSpinnerClassName } from "../constants/authBranding";

interface IPolicyDocumentPanelProps {
  title: string;
  slug: string;
  externalUrl: string;
  versionDate: string;
  /** Taller viewport when only one policy is shown. */
  isSingle: boolean;
}

/** Typography for sanitized WordPress HTML inside the scrollable panel. */
const LEGAL_PAGE_HTML_CLASS_NAME =
  "max-w-none text-sm leading-relaxed text-foreground " +
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline " +
  "[&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-foreground " +
  "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground " +
  "[&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold " +
  "[&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse " +
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 " +
  "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5";

/**
 * Scrollable panel that renders sanitized legal HTML for one policy document.
 */
export default function PolicyDocumentPanel({
  title,
  slug,
  externalUrl,
  versionDate,
  isSingle,
}: Readonly<IPolicyDocumentPanelProps>) {
  const pageQuery = useLegalPage({ slug });
  const panelHeightClassName = isSingle ? "h-[65vh]" : "h-[50vh]";

  return (
    <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <CardHeader className="flex flex-col gap-1 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Version {versionDate}</span>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open in new tab
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className={`${panelHeightClassName} overflow-y-auto px-4 py-3`}>
          {pageQuery.isPending && (
            <div className="flex h-full items-center justify-center">
              <Loader2
                className={`h-8 w-8 animate-spin ${authSpinnerClassName}`}
                aria-label={`Loading ${title}`}
              />
            </div>
          )}

          {pageQuery.isError && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                We couldn&apos;t load this document. You can open it in a new tab
                instead.
              </p>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => void pageQuery.refetch()}
              >
                Try again
              </button>
            </div>
          )}

          {pageQuery.isSuccess &&
            (pageQuery.data.htmlContent.trim() ? (
              <div
                className={LEGAL_PAGE_HTML_CLASS_NAME}
                dangerouslySetInnerHTML={{
                  __html: pageQuery.data.htmlContent,
                }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  This document has no content to display. You can open it in a
                  new tab instead.
                </p>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
