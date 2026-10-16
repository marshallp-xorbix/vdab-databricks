import { useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import type { DatabricksAppNamesLoadState } from "../../../hooks/useDatabricksAppNames";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { cn } from "../../../lib/utils";

const DISABLED_HELP = "Select a Workspace connection to load Databricks Apps.";
const EMPTY_MESSAGE = "No Databricks Apps found in this workspace.";

interface DatabricksAppNameComboboxProps {
  /** Used by settings parent for context; combobox enables from workspace id alone (create flow passes null). */
  appId: number | null;
  workspaceConnectionId: string;
  value: string;
  onChange: (name: string) => void;
  appNames: string[];
  loadState: DatabricksAppNamesLoadState;
  errorMessage: string | null;
}

export default function DatabricksAppNameCombobox({
  appId: _appId,
  workspaceConnectionId,
  value,
  onChange,
  appNames,
  loadState,
  errorMessage,
}: DatabricksAppNameComboboxProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const parsedConnectionId = useMemo(() => {
    const n = parseInt(workspaceConnectionId, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [workspaceConnectionId]);

  const hasWorkspace = parsedConnectionId !== null;

  const filteredNames = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return appNames;
    return appNames.filter((n) => n.toLowerCase().includes(q));
  }, [appNames, filter]);

  const showUnavailableWarning =
    loadState === "success" &&
    value.trim().length > 0 &&
    !appNames.includes(value.trim());

  const triggerLabel =
    value.trim().length > 0 ? value : "Select a Databricks App…";

  return (
    <div>
      <Label
        className="text-sm text-foreground"
        htmlFor="databricks-app-trigger"
      >
        Databricks App Name
      </Label>

      {!hasWorkspace ? (
        <div className="mt-1">
          <Button
            id="databricks-app-trigger"
            type="button"
            variant="outline"
            disabled
            className="h-9 w-full justify-between rounded-md border-border bg-muted text-left font-normal text-muted-foreground"
          >
            <span className="truncate">—</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">{DISABLED_HELP}</p>
        </div>
      ) : (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setFilter("");
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              id="databricks-app-trigger"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={loadState === "loading"}
              className={cn(
                "mt-1 h-9 w-full justify-between rounded-md border-border bg-card font-normal",
                loadState === "loading" && "text-muted-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-2 truncate">
                {loadState === "loading" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                )}
                <span className="truncate">
                  {loadState === "loading" ? "Loading apps…" : triggerLabel}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0"
            align="start"
          >
            <div className="border-b border-border p-2">
              <Input
                placeholder="Search app names…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {loadState === "success" && appNames.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  {EMPTY_MESSAGE}
                </p>
              )}
              {loadState === "success" &&
                appNames.length > 0 &&
                filteredNames.length === 0 && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    No matching app names.
                  </p>
                )}
              {filteredNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={cn(
                    "w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                    name === value && "bg-muted font-medium",
                  )}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    setFilter("");
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {hasWorkspace && loadState === "error" && errorMessage && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      )}

      {hasWorkspace && loadState === "success" && appNames.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{EMPTY_MESSAGE}</p>
      )}

      {showUnavailableWarning && (
        <div
          className="mt-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-foreground"
          role="status"
        >
          The saved Databricks App Name is not in this workspace&apos;s app
          list. It may have been renamed or removed. Select a valid app below
          before saving.
        </div>
      )}
    </div>
  );
}
