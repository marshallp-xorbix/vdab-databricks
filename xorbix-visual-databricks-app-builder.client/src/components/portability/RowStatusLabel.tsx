import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";

/** Lifecycle status of a single import row. */
export type ImportRowStatus =
  | "pending"
  | "importing"
  | "done"
  | "skipped"
  | "error";

interface IRowStatusLabelProps {
  status: ImportRowStatus;
  message?: string;
}

/**
 * Renders the per-row outcome label for a staged import (ready, importing, done,
 * skipped, or error).
 */
export default function RowStatusLabel({
  status,
  message,
}: Readonly<IRowStatusLabelProps>) {
  if (status === "done") {
    return (
      <span className="flex items-center gap-1 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" /> {message}
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex items-center gap-1 text-sm text-warning">
        <CircleSlash className="h-4 w-4" /> {message}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-sm text-destructive">
        <XCircle className="h-4 w-4" /> {message}
      </span>
    );
  }
  if (status === "importing") {
    return <span className="text-sm text-muted-foreground">Importing…</span>;
  }
  return <span className="text-sm text-muted-foreground">Ready to import</span>;
}
