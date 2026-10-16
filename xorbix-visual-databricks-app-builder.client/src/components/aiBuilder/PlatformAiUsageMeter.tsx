import { RefreshCw } from "lucide-react";
import type { IPlatformAiUsage } from "../../models/AiBuilderModels";
import { formatTokenCount } from "../../utils/formatTokenCount";
import {
  formatPlatformAiResetDate,
  getPlatformAiUsageProgressClass,
} from "../../utils/platformAiUsageFormatting";
import { Progress } from "../ui/progress";
import { Button } from "../ui/button";
import PlatformAiUsageInfoTooltip from "./PlatformAiUsageInfoTooltip";

interface IPlatformAiUsageMeterProps {
  usage: IPlatformAiUsage | undefined;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

function PlatformAiUsageMeter({
  usage,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  compact = false,
}: Readonly<IPlatformAiUsageMeterProps>) {
  if (isLoading && !usage) {
    return (
      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        Loading token usage...
      </p>
    );
  }

  if (!usage) {
    return null;
  }

  const fillClass = getPlatformAiUsageProgressClass(usage.percentUsed);
  const usageLabel = `${formatTokenCount(usage.tokensUsed)} / ${formatTokenCount(usage.tokenLimit)}`;

  return (
    <div
      className={compact ? "space-y-1" : "space-y-2 rounded-lg border border-border bg-muted p-4"}
      aria-label="VDAB Default monthly token usage"
    >
      {!compact && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">VDAB Default</h3>
          <p className="text-xs text-muted-foreground">
            Included with your account. Tenant AI models use your Databricks workspace
            and are not limited by VDAB.
          </p>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <Progress
            value={usage.percentUsed}
            indicatorClassName={fillClass}
            className={compact ? "h-1.5" : "h-2"}
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onRefresh && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 shrink-0"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh token usage"
            >
              <RefreshCw
                className={`h-3 w-3 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          )}
          <PlatformAiUsageInfoTooltip tokenLimit={usage.tokenLimit} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-foreground">{usageLabel}</p>
        {!compact && (
          <p className="text-[11px] text-muted-foreground">
            Resets {formatPlatformAiResetDate(usage.resetsAtUtc)} UTC
          </p>
        )}
      </div>

      {usage.isLimitReached && (
        <p className="text-[11px] text-destructive" role="alert">
          Monthly limit reached. Switch to a tenant AI model or wait until{" "}
          {formatPlatformAiResetDate(usage.resetsAtUtc)} UTC.
        </p>
      )}
    </div>
  );
}

export default PlatformAiUsageMeter;
