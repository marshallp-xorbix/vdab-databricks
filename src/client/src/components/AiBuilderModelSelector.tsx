import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import type { IWorkspaceServingEndpoint } from "../models/WorkspaceServingEndpoint";

interface IAiBuilderModelSelectorProps {
  endpoints: readonly IWorkspaceServingEndpoint[];
  value: string;
  disabled: boolean;
  isLoading?: boolean;
  onChange: (endpointName: string) => void;
}

/** Chooses a ready workspace chat endpoint for AI Builder. */
function AiBuilderModelSelector({
  endpoints,
  value,
  disabled,
  isLoading = false,
  onChange,
}: Readonly<IAiBuilderModelSelectorProps>) {
  const [open, setOpen] = useState(false);
  const selected = endpoints.find((endpoint) => endpoint.name === value);
  const selectedDisplayName = selected?.name ?? "Select a chat model";

  function handleSelect(endpointName: string): void {
    onChange(endpointName);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLoading || endpoints.length === 0}
          aria-label="Select AI model"
          className="h-7 max-w-[180px] justify-between gap-1 px-2 text-xs font-normal"
        >
          <span className="truncate">{selectedDisplayName}</span>
          {isLoading ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div className="max-h-64 overflow-y-auto">
          {endpoints.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No ready chat models are available in this workspace.
            </p>
          ) : (
            endpoints.map((endpoint) => {
              const isSelected = endpoint.name === value;
              const isConfigured =
                endpoint.readiness === "ready" &&
                (endpoint.permissionLevel === "CAN_QUERY" ||
                  endpoint.permissionLevel === "CAN_MANAGE");
              return (
                <button
                  key={endpoint.name}
                  type="button"
                  disabled={!isConfigured}
                  onClick={() => handleSelect(endpoint.name)}
                  className={`flex w-full flex-col items-start rounded-md px-2 py-2 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected ? "bg-muted font-medium" : ""
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{endpoint.name}</span>
                    {isSelected ? (
                      <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {endpoint.name}
                    {endpoint.task ? ` · ${endpoint.task}` : ""}
                  </span>
                  {!isConfigured ? (
                    <span className="text-[11px] text-warning-foreground">Not configured</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AiBuilderModelSelector;
