import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import type { IWorkspaceServingEndpoint } from "../models/WorkspaceServingEndpoint";

interface IAiBuilderModelSelectorProps {
  endpoints: readonly IWorkspaceServingEndpoint[];
  value: string;
  disabled: boolean;
  onChange: (endpointName: string) => void;
}

/** Chooses a ready workspace chat endpoint for AI Builder. */
function AiBuilderModelSelector({
  endpoints,
  value,
  disabled,
  onChange,
}: Readonly<IAiBuilderModelSelectorProps>) {
  const selected = endpoints.find((endpoint) => endpoint.name === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || endpoints.length === 0}
          aria-label="Serving endpoint"
          className="h-7 max-w-64 justify-between px-2 text-xs"
        >
          <span className="truncate">{selected?.name ?? "Select a chat model"}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <ul aria-label="Chat models" className="max-h-64 overflow-y-auto">
          {endpoints.map((endpoint) => (
            <li key={endpoint.name}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                onClick={() => onChange(endpoint.name)}
              >
                <Check className={`mt-0.5 h-4 w-4 ${endpoint.name === value ? "opacity-100" : "opacity-0"}`} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{endpoint.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{endpoint.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export default AiBuilderModelSelector;
