import { Info } from "lucide-react";
import { ADD_AI_BUILDER_MODELS_HELP_URL } from "../../constants/helpLinks";
import { formatTokenCount } from "../../utils/formatTokenCount";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface IPlatformAiUsageInfoTooltipProps {
  tokenLimit: number;
}

function PlatformAiUsageInfoTooltip({
  tokenLimit,
}: Readonly<IPlatformAiUsageInfoTooltipProps>) {
  const formattedLimit = formatTokenCount(tokenLimit);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 shrink-0"
            aria-label="VDAB Default token usage information"
          >
            <Info className="h-3 w-3 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={4}
          className="max-w-xs px-3 py-2 text-xs"
        >
          <p>
            The VDAB Default model includes{" "}
            <span className="font-semibold">{formattedLimit}</span> tokens per
            user each month. Usage resets at the start of each month.
          </p>
          <p className="mt-1.5">
            You can register your own Databricks models for AI Builder.{" "}
            <a
              href={ADD_AI_BUILDER_MODELS_HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              Click here to learn more.
            </a>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default PlatformAiUsageInfoTooltip;
