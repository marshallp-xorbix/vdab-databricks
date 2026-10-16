import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  RESOURCE_FIELD_LABEL_CLASS,
  WORKSPACE_CONNECTION_MISSING_MESSAGE,
} from "../../constants/databricksAppResourcesUi";
import { useReportWorkspacePickerIssue } from "../../hooks/useReportWorkspacePickerIssue";
import {
  databricksDataConnectorApi,
  type DatabricksServingEndpointListItem,
} from "../../providers/DatabricksDataConnectorApi";
import { cn } from "../../lib/utils";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";

interface DatabricksServingEndpointSelectorEditorProps {
  value?: string;
  onChange: (endpointName: string) => void;
  workspaceConnectionId?: number;
  showFieldLabel?: boolean;
  onWorkspaceFetchIssue?: (message: string | null) => void;
  id?: string;
}

export const DatabricksServingEndpointSelectorEditor: FC<
  DatabricksServingEndpointSelectorEditorProps
> = ({
  value,
  onChange,
  workspaceConnectionId,
  showFieldLabel = true,
  onWorkspaceFetchIssue,
  id,
}) => {
  const [endpoints, setEndpoints] = useState<DatabricksServingEndpointListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const workspaceMissing =
    !workspaceConnectionId || workspaceConnectionId <= 0
      ? WORKSPACE_CONNECTION_MISSING_MESSAGE
      : null;

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      if (workspaceMissing) {
        setEndpoints([]);
        setLoading(false);
        return;
      }
      try {
        const data = await databricksDataConnectorApi.getServingEndpoints(
          workspaceConnectionId!,
        );
        setEndpoints(data || []);
      } catch (err) {
        setEndpoints([]);
        setError(formatApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [workspaceConnectionId, workspaceMissing]);

  const optionRows = useMemo(() => {
    const base = [...endpoints];
    const trimmedValue = value?.trim();
    if (trimmedValue && !base.some((endpoint) => endpoint.name === trimmedValue)) {
      base.push({ name: trimmedValue });
    }
    return base.sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
  }, [endpoints, value]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return optionRows;
    }
    return optionRows.filter((endpoint) =>
      endpoint.name.toLowerCase().includes(query),
    );
  }, [optionRows, searchQuery]);

  const rowIssue = workspaceMissing ?? error;
  useReportWorkspacePickerIssue(rowIssue, onWorkspaceFetchIssue);

  const selectedValue = value?.trim() || "";
  const blockingMessage = workspaceMissing ?? error;
  const triggerId = id ?? "serving-endpoint-selector";

  return (
    <div className="space-y-1">
      {showFieldLabel ? (
        <Label htmlFor={triggerId} className={RESOURCE_FIELD_LABEL_CLASS}>
          Serving endpoint
        </Label>
      ) : null}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearchQuery("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={triggerId}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={loading || Boolean(workspaceMissing)}
            className="h-9 w-full justify-between font-normal"
          >
            <span className="truncate">
              {selectedValue ||
                (loading ? "Loading endpoints…" : "Select a serving endpoint")}
            </span>
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="border-b p-2">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search endpoints…"
              aria-label="Search serving endpoints"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {blockingMessage ? (
              <p className="px-2 py-3 text-sm text-destructive">{blockingMessage}</p>
            ) : loading ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Loading endpoints…</p>
            ) : filteredRows.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                {optionRows.length === 0
                  ? "No serving endpoints found"
                  : "No endpoints match your search"}
              </p>
            ) : (
              filteredRows.map((endpoint) => {
                const isSelected = endpoint.name === selectedValue;
                return (
                  <button
                    key={endpoint.name}
                    type="button"
                    onClick={() => {
                      onChange(endpoint.name);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted",
                      isSelected && "bg-muted",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{endpoint.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
