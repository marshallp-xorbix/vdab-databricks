import { Loader2 } from "lucide-react";

import type {
  AppSettingsWarning,
  NormalizedAppResource,
} from "../../../models/DatabricksAppModels";
import { buildAppSettingsResourceTableRow } from "../../../utils/appSettingsResourceRow";
import AppSettingsResourceWarnings from "./AppSettingsResourceWarnings";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

export interface AppSettingsResourcesTableProps {
  resources: NormalizedAppResource[];
  warnings: AppSettingsWarning[];
  loading: boolean;
  error: string | null;
  /** Optional read-only line below the table */
  computeSize?: string;
}

export default function AppSettingsResourcesTable({
  resources,
  warnings,
  loading,
  error,
  computeSize,
}: AppSettingsResourcesTableProps) {
  return (
    <div className="space-y-4">
      <AppSettingsResourceWarnings warnings={warnings} />

      {error && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive-foreground"
          role="alert"
          tabIndex={0}
        >
          <p className="font-medium">Could not load resources</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {loading && (
        <div
          className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/80"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <span className="text-sm text-muted-foreground">Loading resources…</span>
        </div>
      )}

      {!loading && !error && resources.length === 0 && (
        <div
          className="rounded-lg border border-dashed border-border bg-muted/50 px-6 py-10 text-center"
          role="status"
        >
          <p className="text-sm font-medium text-foreground">
            No resources configured
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            This Databricks app does not have any mapped resources yet, or they
            could not be loaded from the workspace.
          </p>
        </div>
      )}

      {!loading && !error && resources.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead scope="col" className="text-foreground">
                  Key
                </TableHead>
                <TableHead scope="col" className="text-foreground">
                  Type
                </TableHead>
                <TableHead scope="col" className="text-foreground">
                  Details
                </TableHead>
                <TableHead scope="col" className="text-foreground">
                  Permissions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((resource, index) => {
                const row = buildAppSettingsResourceTableRow(resource);
                return (
                  <TableRow key={`${row.key}-${row.typeLabel}-${index}`}>
                    <TableCell className="max-w-[12rem] align-top font-medium text-foreground whitespace-normal">
                      <span className="break-words">{row.key}</span>
                    </TableCell>
                    <TableCell className="align-top text-foreground whitespace-normal">
                      {row.typeLabel}
                    </TableCell>
                    <TableCell className="max-w-xl align-top text-foreground whitespace-normal">
                      <span className="break-words">{row.details}</span>
                    </TableCell>
                    <TableCell className="align-top text-foreground whitespace-normal">
                      <span className="break-words">{row.permissions}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && Boolean(computeSize?.trim()) && (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          <span className="font-medium text-foreground">Compute size: </span>
          <span className="text-foreground">{computeSize}</span>
        </div>
      )}
    </div>
  );
}
