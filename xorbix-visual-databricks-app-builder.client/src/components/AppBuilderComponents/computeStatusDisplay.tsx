import { CircleX, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ComputeStatusPresentation } from "./builderHeaderComputeStatus";

export function ComputeStatusBadgeIcon({
  presentation,
}: {
  presentation: ComputeStatusPresentation;
}) {
  if (presentation.badgeIcon === "unavailable") {
    return (
      <CircleX className="h-2.5 w-2.5 flex-shrink-0 text-destructive" />
    );
  }
  if (presentation.badgeIcon === "loading") {
    return (
      <Loader2 className="h-2.5 w-2.5 flex-shrink-0 animate-spin text-info" />
    );
  }
  return (
    <span
      className={`h-2 w-2 rounded-full flex-shrink-0 ${presentation.dotColorClass} ${
        presentation.dotPulse ? "animate-pulse" : ""
      }`}
    />
  );
}

/** Same chrome as the builder header status chip (dot/icon + colored label). */
export function ComputeStatusPill({
  presentation,
  className,
}: {
  presentation: ComputeStatusPresentation;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex select-none items-center gap-1.5 rounded-full border border-[var(--builder-chrome-border)] bg-card px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
      title={presentation.statusLabel}
    >
      <ComputeStatusBadgeIcon presentation={presentation} />
      <span className={cn("font-semibold", presentation.labelTextClass)}>
        {presentation.shortLabel}
      </span>
    </div>
  );
}
