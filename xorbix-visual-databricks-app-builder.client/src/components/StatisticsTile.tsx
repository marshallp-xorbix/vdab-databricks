import {
  AlertTriangle,
  CheckCircle,
  Info,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "../lib/utils";

export type StatisticsTileTrend =
  | "up"
  | "down"
  | "stable"
  | "operational"
  | "warning"
  | "info"
  | "none";

export interface StatisticsTileProps {
  title: string;
  value: string;
  change: string;
  change2?: string;
  trend?: StatisticsTileTrend;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  badgeLabel?: string;
  className?: string;
  loading?: boolean;
}

export function StatisticsTile({
  title,
  value,
  change,
  change2,
  trend = "none",
  icon: Icon,
  iconClassName,
  badgeLabel,
  className,
  loading = false,
}: Readonly<StatisticsTileProps>) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-start justify-between rounded-xl border border-border bg-card p-5 shadow-sm",
          className,
        )}
      >
        <div className="w-full space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="ml-3 h-10 w-10 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  function renderTrendIcon() {
    switch (trend) {
      case "up":
        return <TrendingUp className="mr-1 h-3 w-3 text-success" />;
      case "down":
        return <TrendingDown className="mr-1 h-3 w-3 text-destructive" />;
      case "stable":
        return <Minus className="mr-1 h-3 w-3 text-muted-foreground" />;
      case "operational":
        return <CheckCircle className="mr-1 h-3 w-3 text-success" />;
      case "warning":
        return <AlertTriangle className="mr-1 h-3 w-3 text-warning" />;
      case "info":
        return <Info className="mr-1 h-3 w-3 text-info" />;
      default:
        return null;
    }
  }

  let changeToneClassName = "text-muted-foreground";
  if (trend === "up" || trend === "operational") {
    changeToneClassName = "text-success";
  } else if (trend === "down") {
    changeToneClassName = "text-destructive";
  } else if (trend === "warning") {
    changeToneClassName = "text-warning-foreground";
  } else if (trend === "info") {
    changeToneClassName = "text-info";
  }

  const changeTextClassName = cn(
    "flex items-center font-medium",
    changeToneClassName,
  );

  return (
    <div
      className={cn(
        "flex items-start justify-between rounded-xl border border-border bg-card p-5 shadow-[var(--card-shadow)] transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          {badgeLabel && (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {badgeLabel}
            </span>
          )}
        </p>
        <h3 className="mt-1 text-2xl font-bold text-foreground">{value}</h3>
        <div className="mt-2 flex w-full items-center justify-between gap-2 text-xs">
          <span className={cn(changeTextClassName, "min-w-0")}>
            {renderTrendIcon()}
            <span className="truncate">{change}</span>
          </span>
          {change2 && (
            <span className="shrink-0 font-medium text-muted-foreground">
              {change2}
            </span>
          )}
        </div>
      </div>
      <div className={cn("rounded-lg p-2", iconClassName)}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );
}
