import { useMemo } from "react";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { appApi } from "../../providers/AppApi";
import {
  ExportBundleType,
  type IAppExport,
  type IImportConnectionOption,
  type IImportOwnerOption,
} from "../../models";
import { useStagedImport } from "../../hooks/useStagedImport";
import JsonDropZone from "./JsonDropZone";
import RowStatusLabel, { type ImportRowStatus } from "./RowStatusLabel";

interface IAppRow {
  key: string;
  app: IAppExport;
  appName: string;
  workspaceConnectionId: string;
  ownerId: string;
  status: ImportRowStatus;
  message?: string;
}

interface IImportAppsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connections: IImportConnectionOption[];
  owners: IImportOwnerOption[];
  defaultOwnerId: string;
  /** Called after at least one element was imported successfully. */
  onImported: () => void;
}

function normalizeUrl(url: string | undefined): string {
  return (url ?? "").trim().toLowerCase().replace(/\/+$/, "");
}

/**
 * Staged app-import dialog. Parses an export bundle into individual editable rows,
 * each requiring a target connection and owner, and imports them one at a time or
 * all at once. Global administrator use only.
 */
export default function ImportAppsDialog({
  open,
  onOpenChange,
  connections,
  owners,
  defaultOwnerId,
  onImported,
}: Readonly<IImportAppsDialogProps>) {
  const connectionByUrl = useMemo(() => {
    const map = new Map<string, number>();
    for (const connection of connections) {
      map.set(normalizeUrl(connection.workspaceUrl), connection.pkId);
    }
    return map;
  }, [connections]);

  const {
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
  } = useStagedImport<IAppRow>({
    expectedType: ExportBundleType.Apps,
    emptyMessage: "The bundle does not contain any apps.",
    conflictMessage: "Skipped: an app with this name already exists.",
    onImported,
    onOpenChange,
    buildRows: (bundle) =>
      (bundle.apps ?? []).map((app, index) => {
        const matchedConnectionId = connectionByUrl.get(
          normalizeUrl(app.workspaceUrl),
        );
        return {
          key: `${app.appName}-${index}`,
          app,
          appName: app.appName,
          workspaceConnectionId: matchedConnectionId
            ? matchedConnectionId.toString()
            : "",
          ownerId: defaultOwnerId,
          status: "pending" as ImportRowStatus,
        };
      }),
    validateRow: (row) =>
      !row.workspaceConnectionId || !row.ownerId
        ? "Select a connection and owner first."
        : undefined,
    performImport: (row) =>
      appApi.importApp({
        app: { ...row.app, appName: row.appName.trim() },
        workspaceConnectionId: Number(row.workspaceConnectionId),
        ownerId: row.ownerId,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card p-6 rounded-xl shadow-xl sm:max-w-4xl w-full border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Import Apps
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Paste or drop an export bundle, then assign a connection and owner
            to each app before importing.
          </DialogDescription>
        </DialogHeader>

        <JsonDropZone
          value={rawText}
          onChange={setRawText}
          onReject={setParseError}
        />
        <div className="flex items-center justify-between">
          {parseError ? (
            <span className="text-sm text-destructive">{parseError}</span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {rows.length > 0 ? `${rows.length} app(s) detected` : ""}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleParse}>
            Parse JSON
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="max-h-[40vh] space-y-3 overflow-auto pr-1">
            {rows.map((row) => (
              <div
                key={row.key}
                className="rounded-lg border border-border p-3"
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">App name</Label>
                    <Input
                      value={row.appName}
                      onChange={(e) =>
                        updateRow(row.key, { appName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Connection</Label>
                    <Select
                      value={row.workspaceConnectionId}
                      onValueChange={(value) =>
                        updateRow(row.key, { workspaceConnectionId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select connection…" />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map((connection) => (
                          <SelectItem
                            key={connection.pkId}
                            value={connection.pkId.toString()}
                          >
                            {connection.workspaceDisplayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Owner</Label>
                    <Select
                      value={row.ownerId}
                      onValueChange={(value) =>
                        updateRow(row.key, { ownerId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select owner…" />
                      </SelectTrigger>
                      <SelectContent>
                        {owners.map((owner) => (
                          <SelectItem key={owner.userId} value={owner.userId}>
                            {owner.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <RowStatusLabel status={row.status} message={row.message} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      row.status === "importing" || row.status === "done"
                    }
                    onClick={() => importRow(row)}
                  >
                    {row.status === "done" ? "Imported" : "Import"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex justify-end gap-3 mt-2">
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Close
          </Button>
          <Button
            onClick={handleImportAll}
            disabled={pendingCount === 0}
            className="rounded-lg shadow-md hover:opacity-90"
          >
            <Upload className="mr-2 h-4 w-4" /> Import all ({pendingCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
