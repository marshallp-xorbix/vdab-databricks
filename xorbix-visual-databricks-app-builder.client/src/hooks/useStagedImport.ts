import { useState } from "react";
import {
  ApiError,
  ExportBundleType,
  type IExportBundle,
  type IImportElementResult,
} from "../models";
import { parseExportBundle } from "../utils/parseExportBundle";
import type { ImportRowStatus } from "../components/portability/RowStatusLabel";

/** Common fields every staged-import row must expose. */
export interface IStagedImportRow {
  key: string;
  status: ImportRowStatus;
  message?: string;
}

interface IUseStagedImportOptions<TRow extends IStagedImportRow> {
  /** The bundle type this dialog can import. */
  expectedType: ExportBundleType;
  /** Builds editable rows from a successfully parsed bundle. */
  buildRows: (bundle: IExportBundle) => TRow[];
  /** Message shown when the bundle parses but contains no importable elements. */
  emptyMessage: string;
  /** Validates a row before import; returns an error message when invalid. */
  validateRow: (row: TRow) => string | undefined;
  /** Performs the import for a single row. Throws to fail; returns the element result. */
  performImport: (row: TRow) => Promise<IImportElementResult>;
  /** Status message shown when an element is skipped due to a 409 conflict. */
  conflictMessage: string;
  /** Called once after at least one element was imported successfully. */
  onImported: () => void;
  /** Forwarded dialog open-state setter. */
  onOpenChange: (open: boolean) => void;
}

/** Everything a staged-import dialog needs to render and drive its rows. */
export interface IUseStagedImportResult<TRow extends IStagedImportRow> {
  rawText: string;
  setRawText: (value: string) => void;
  parseError: string | undefined;
  setParseError: (value: string | undefined) => void;
  rows: TRow[];
  updateRow: (key: string, patch: Partial<TRow>) => void;
  handleParse: () => void;
  importRow: (row: TRow) => Promise<void>;
  handleImportAll: () => Promise<void>;
  pendingCount: number;
  handleClose: (next: boolean) => void;
}

/**
 * Encapsulates the shared staged-import workflow used by the app and connection
 * import dialogs: parsing a bundle into editable rows, importing rows one at a time
 * or all at once, tracking per-row status, mapping 409 conflicts to "skipped", and
 * resetting/notifying on close.
 */
export function useStagedImport<TRow extends IStagedImportRow>({
  expectedType,
  buildRows,
  emptyMessage,
  validateRow,
  performImport,
  conflictMessage,
  onImported,
  onOpenChange,
}: IUseStagedImportOptions<TRow>): IUseStagedImportResult<TRow> {
  const [rawText, setRawText] = useState("");
  const [parseError, setParseError] = useState<string | undefined>();
  const [rows, setRows] = useState<TRow[]>([]);
  const [importedAny, setImportedAny] = useState(false);

  const updateRow = (key: string, patch: Partial<TRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const handleParse = () => {
    const result = parseExportBundle(rawText, expectedType);
    if (result.error || !result.bundle) {
      setParseError(result.error ?? "Unable to read the bundle.");
      setRows([]);
      return;
    }

    const built = buildRows(result.bundle);
    if (built.length === 0) {
      setParseError(emptyMessage);
      setRows([]);
      return;
    }

    setParseError(undefined);
    setImportedAny(false);
    setRows(built);
  };

  const importRow = async (row: TRow): Promise<void> => {
    const validationMessage = validateRow(row);
    if (validationMessage) {
      updateRow(row.key, {
        status: "error",
        message: validationMessage,
      } as Partial<TRow>);
      return;
    }

    updateRow(row.key, {
      status: "importing",
      message: undefined,
    } as Partial<TRow>);
    try {
      const result = await performImport(row);
      setImportedAny(true);
      updateRow(row.key, {
        status: "done",
        message: result.renamed
          ? `Imported as "${result.name}" (renamed)`
          : `Imported as "${result.name}"`,
      } as Partial<TRow>);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        updateRow(row.key, {
          status: "skipped",
          message: conflictMessage,
        } as Partial<TRow>);
        return;
      }
      updateRow(row.key, {
        status: "error",
        message: error instanceof Error ? error.message : "Import failed.",
      } as Partial<TRow>);
    }
  };

  const handleImportAll = async () => {
    for (const row of rows) {
      if (row.status === "pending" || row.status === "error") {
        await importRow(row);
      }
    }
  };

  const pendingCount = rows.filter(
    (r) => r.status === "pending" || r.status === "error",
  ).length;

  const handleClose = (next: boolean) => {
    if (!next) {
      setRawText("");
      setParseError(undefined);
      setRows([]);
      if (importedAny) {
        onImported();
      }
    }
    onOpenChange(next);
  };

  return {
    rawText,
    setRawText,
    parseError,
    setParseError,
    rows,
    updateRow,
    handleParse,
    importRow,
    handleImportAll,
    pendingCount,
    handleClose,
  };
}
