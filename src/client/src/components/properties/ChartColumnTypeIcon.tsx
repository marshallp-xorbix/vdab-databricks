import type { FC } from "react";
import {
  CalendarClock,
  CaseSensitive,
  CircleDot,
  Hash,
  HelpCircle,
} from "lucide-react";
import type { ChartColumnTypeCategory } from "../../utils/chartColumnTypeUtils";
import { getChartColumnTypeCategory } from "../../utils/chartColumnTypeUtils";
import { cn } from "../../lib/utils";

interface ChartColumnTypeIconProps {
  /** Spark / Unity Catalog column type string, e.g. `TIMESTAMP`, `DECIMAL(10,2)`. */
  typeText?: string;
  /** When set, overrides inference from `typeText`. */
  category?: ChartColumnTypeCategory;
  className?: string;
}

const iconClass = "h-3.5 w-3.5 shrink-0 text-muted-foreground";

export const ChartColumnTypeIcon: FC<ChartColumnTypeIconProps> = ({
  typeText,
  category: categoryProp,
  className,
}) => {
  const category =
    categoryProp ?? getChartColumnTypeCategory(typeText);

  const node =
    category === "temporal" ? (
      <CalendarClock className={cn(iconClass, className)} aria-hidden />
    ) : category === "numeric" ? (
      <Hash className={cn(iconClass, className)} aria-hidden />
    ) : category === "string" ? (
      <CaseSensitive className={cn(iconClass, className)} aria-hidden />
    ) : category === "boolean" ? (
      <CircleDot className={cn(iconClass, className)} aria-hidden />
    ) : (
      <HelpCircle className={cn(iconClass, className)} aria-hidden />
    );

  return (
    <span title={typeText?.trim() || "Unknown type"} className="inline-flex">
      {node}
    </span>
  );
};

/** Row label for dropdowns: icon + column name + optional short type snippet. */
export const ChartColumnFieldLabel: FC<{
  name: string;
  typeText?: string;
}> = ({ name, typeText }) => (
  <span className="flex min-w-0 items-center gap-2">
    <ChartColumnTypeIcon typeText={typeText} />
    <span className="truncate">{name}</span>
  </span>
);
