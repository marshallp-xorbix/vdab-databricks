import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import type { IAiBuilderModelOption } from "../../models/AiBuilderModels";

interface IAiBuilderModelSelectorProps {
  availableModels: IAiBuilderModelOption[];
  selectedModelId: number | null;
  selectedDisplayName: string;
  disabled?: boolean;
  isLoading?: boolean;
  onSelect: (modelId: number | null) => void;
}

function AiBuilderModelSelector({
  availableModels,
  selectedModelId,
  selectedDisplayName,
  disabled = false,
  isLoading = false,
  onSelect,
}: Readonly<IAiBuilderModelSelectorProps>) {
  const [open, setOpen] = useState(false);

  const handleSelect = (modelId: number | null) => {
    onSelect(modelId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLoading}
          className="h-7 max-w-[180px] justify-between gap-1 px-2 text-xs font-normal"
          aria-label="Select AI model"
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
          {availableModels.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No models available. Add tenant AI models in Databricks Connections.
            </p>
          ) : (
            availableModels.map((model) => {
              const modelKey = model.id ?? "platform";
              const isSelected = (model.id ?? null) === selectedModelId;

              return (
                <button
                  key={modelKey}
                  type="button"
                  disabled={!model.isConfigured}
                  onClick={() => handleSelect(model.id)}
                  className={`flex w-full flex-col items-start rounded-md px-2 py-2 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected ? "bg-muted font-medium" : ""
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>{model.displayName}</span>
                    {isSelected && (
                      <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {model.endpointName}
                    {model.connectionDisplayName
                      ? ` · ${model.connectionDisplayName}`
                      : ""}
                  </span>
                  {!model.isConfigured && (
                    <span className="text-[11px] text-warning-foreground">
                      Not configured
                    </span>
                  )}
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
