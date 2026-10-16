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
import { databricksApi } from "../../providers/DatabricksApi";
import {
  ExportBundleType,
  type IDatabricksConnectionExport,
  type IImportOwnerOption,
} from "../../models";
import { useStagedImport } from "../../hooks/useStagedImport";
import JsonDropZone from "./JsonDropZone";
import RowStatusLabel, { type ImportRowStatus } from "./RowStatusLabel";

interface IConnectionRow {
  key: string;
  connection: IDatabricksConnectionExport;
  workspaceDisplayName: string;
  workspaceUrl: string;
  clientId: string;
  clientSecret: string;
  ownerId: string;
  status: ImportRowStatus;
  message?: string;
}

interface IImportConnectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owners: IImportOwnerOption[];
  defaultOwnerId: string;
  /** Called after at least one element was imported successfully. */
  onImported: () => void;
}

/**
 * Staged connection-import dialog. Parses an export bundle into individual editable
 * rows, each requiring an owner (and optionally a client secret), and imports them
 * one at a time or all at once. Connections whose workspace URL already exists are
 * skipped. Global administrator use only.
 */
export default function ImportConnectionsDialog({
  open,
  onOpenChange,
  owners,
  defaultOwnerId,
  onImported,
}: Readonly<IImportConnectionsDialogProps>) {
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
  } = useStagedImport<IConnectionRow>({
    expectedType: ExportBundleType.Connections,
    emptyMessage: "The bundle does not contain any connections.",
    conflictMessage: "Skipped: this workspace URL already exists.",
    onImported,
    onOpenChange,
    buildRows: (bundle) =>
      (bundle.connections ?? []).map((connection, index) => ({
        key: `${connection.workspaceUrl}-${index}`,
        connection,
        workspaceDisplayName: connection.workspaceDisplayName,
        workspaceUrl: connection.workspaceUrl,
        clientId: connection.clientId ?? "",
        clientSecret: "",
        ownerId: defaultOwnerId,
        status: "pending" as ImportRowStatus,
      })),
    validateRow: (row) =>
      !row.ownerId ||
      !row.workspaceUrl.trim() ||
      !row.workspaceDisplayName.trim()
        ? "Display name, URL, and owner are required."
        : undefined,
    performImport: (row) =>
      databricksApi.importConnection({
        connection: {
          ...row.connection,
          workspaceDisplayName: row.workspaceDisplayName.trim(),
          workspaceUrl: row.workspaceUrl.trim(),
          clientId: row.clientId.trim() || undefined,
        },
        ownerId: row.ownerId,
        clientSecret: row.clientSecret.trim() || undefined,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card p-6 rounded-xl shadow-xl sm:max-w-4xl w-full border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Import Connections
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Paste or drop an export bundle, then assign an owner to each
            connection. Client secrets are never exported; add one to authorize
            immediately, or leave blank to authorize later.
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
              {rows.length > 0 ? `${rows.length} connection(s) detected` : ""}
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
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Display name
                    </Label>
                    <Input
                      value={row.workspaceDisplayName}
                      onChange={(e) =>
                        updateRow(row.key, {
                          workspaceDisplayName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Workspace URL
                    </Label>
                    <Input
                      value={row.workspaceUrl}
                      onChange={(e) =>
                        updateRow(row.key, { workspaceUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Client ID</Label>
                    <Input
                      value={row.clientId}
                      onChange={(e) =>
                        updateRow(row.key, { clientId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Client secret (optional)
                    </Label>
                    <Input
                      type="password"
                      value={row.clientSecret}
                      onChange={(e) =>
                        updateRow(row.key, { clientSecret: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
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
