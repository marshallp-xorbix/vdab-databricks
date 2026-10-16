import type { FC } from "react";
import { useEffect } from "react";
import type { UnityCatalogColumn } from "../../types/components/bindings";
import type {
  ChartAxisConfig,
  ChartAxisFieldRole,
  ChartFieldTransform,
} from "../../types/chartAxisConfig";
import { getTransformsForRole } from "../../types/chartAxisConfig";
import { cn } from "../../lib/utils";
import { getMeasureTransformsForColumn } from "../../utils/charts/chartValueAxisValidation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  ChartColumnFieldLabel,
  ChartColumnTypeIcon,
} from "./ChartColumnTypeIcon";
import { getChartColumnTypeCategory } from "../../utils/chartColumnTypeUtils";

const EMPTY_FIELD = "__empty_field__";

const TRANSFORM_LABEL: Record<ChartFieldTransform, string> = {
  none: "None",
  sum: "SUM",
  avg: "AVG",
  count: "COUNT",
  count_distinct: "COUNT DISTINCT",
  min: "MIN",
  max: "MAX",
  yearly: "YEARLY",
  monthly: "MONTHLY",
  weekly: "WEEKLY",
  daily: "DAILY",
};

function getTransformsForColumnType(
  role: ChartAxisFieldRole,
  typeText: string | undefined,
  allowEmptyField: boolean,
  axisField: string,
): ChartFieldTransform[] {
  const category = getChartColumnTypeCategory(typeText);

  if (
    role === "line-y" ||
    role === "bar-y" ||
    role === "pie-value" ||
    role === "amoeba-size" ||
    role === "amoeba-x" ||
    role === "amoeba-y" ||
    role === "amoeba-change" ||
    role === "amoeba-health" ||
    role === "amoeba-risk" ||
    role === "network-relationship-weight" ||
    role === "network-edge-value" ||
    role === "network-frequency" ||
    role === "network-edge-risk" ||
    role === "network-source-value" ||
    role === "network-target-value" ||
    role === "network-source-health" ||
    role === "network-target-health" ||
    role === "network-source-risk" ||
    role === "network-target-risk" ||
    role === "terrain-height" ||
    role === "terrain-risk" ||
    role === "terrain-target" ||
    role === "terrain-baseline" ||
    role === "terrain-forecast" ||
    role === "terrain-volume" ||
    role === "heat-map-metric" ||
    role === "heat-map-secondary" ||
    role === "heat-map-change" ||
    role === "heat-map-target" ||
    role === "heat-map-risk" ||
    role === "heat-map-forecast"
  ) {
    const hasField = Boolean(axisField && axisField.length > 0);
    return getMeasureTransformsForColumn(category, role, {
      barAllowEmptyField: allowEmptyField && role === "bar-y",
      hasField,
    });
  }

  if (
    role === "amoeba-entity-id" ||
    role === "amoeba-entity-label" ||
    role === "amoeba-category" ||
    role === "network-source-id" ||
    role === "network-source-label" ||
    role === "network-target-id" ||
    role === "network-target-label" ||
    role === "network-relationship-type" ||
    role === "network-direction" ||
    role === "network-edge-status" ||
    role === "network-source-category" ||
    role === "network-target-category" ||
    role === "terrain-x" ||
    role === "terrain-y" ||
    role === "terrain-category" ||
    role === "terrain-status" ||
    role === "terrain-event-name" ||
    role === "terrain-event-date" ||
    role === "terrain-callout" ||
    role === "heat-map-area" ||
    role === "heat-map-category" ||
    role === "heat-map-notes"
  ) {
    return ["none"];
  }

  if (
    role === "amoeba-time" ||
    role === "network-time" ||
    role === "terrain-time" ||
    role === "heat-map-time"
  ) {
    if (category === "temporal") {
      return ["none", "yearly", "monthly", "weekly", "daily"];
    }
    return ["none"];
  }

  if (category === "boolean" || category === "string") {
    return ["none", "count", "count_distinct"];
  }

  if (category === "temporal") {
    // Time buckets for temporal fields match Databricks-style UX (dimensions only).
    return ["none", "yearly", "monthly", "weekly", "daily"];
  }

  if (category === "numeric") {
    return ["none", "sum", "avg", "min", "max", "count", "count_distinct"];
  }

  return getTransformsForRole(role);
}

function shouldShowScaleType(typeText: string | undefined): boolean {
  const category = getChartColumnTypeCategory(typeText);
  return category === "numeric" || category === "temporal" || category === "unknown";
}

interface ChartAxisFieldPopoverProps {
  label: string;
  role: ChartAxisFieldRole;
  axis: ChartAxisConfig;
  columns: UnityCatalogColumn[];
  onChange: (next: ChartAxisConfig) => void;
  /** When true, field can be cleared (e.g. COUNT(*) on bar Y). */
  allowEmptyField?: boolean;
}

export const ChartAxisFieldPopover: FC<ChartAxisFieldPopoverProps> = ({
  label,
  role,
  axis,
  columns,
  onChange,
  allowEmptyField = false,
}) => {
  const boundColumns = columns.filter(
    (col): col is UnityCatalogColumn & { name: string } =>
      Boolean(col.name && col.name.length > 0),
  );

  const selectedColumn = boundColumns.find((c) => c.name === axis.field);
  const transforms = getTransformsForColumnType(
    role,
    selectedColumn?.type,
    allowEmptyField,
    axis.field ?? "",
  );
  const showScaleType = shouldShowScaleType(selectedColumn?.type);

  useEffect(() => {
    if (transforms.length === 0) {
      return;
    }
    if (transforms.includes(axis.transform)) {
      return;
    }
    onChange({ ...axis, transform: transforms[0] });
  }, [transforms, axis.field, axis.transform, axis.displayName, axis.scaleType]);

  const selectFieldValue =
    axis.field && axis.field.length > 0
      ? axis.field
      : allowEmptyField
        ? EMPTY_FIELD
        : undefined;

  const patch = (partial: Partial<ChartAxisConfig>) => {
    onChange({ ...axis, ...partial });
  };

  const summary = (() => {
    if (!axis.field && role === "bar-y" && axis.transform === "count") {
      return (
        <span className="flex items-center gap-2 truncate">
          <ChartColumnTypeIcon category="numeric" />
          <span className="truncate">COUNT(*)</span>
        </span>
      );
    }
    if (!axis.field) {
      return <span className="text-muted-foreground">Configure…</span>;
    }
    const typeText = selectedColumn?.type;
    const tf =
      axis.transform && axis.transform !== "none"
        ? `${TRANSFORM_LABEL[axis.transform]}(${axis.field})`
        : axis.field;
    return (
      <span className="flex min-w-0 items-center gap-2">
        <ChartColumnTypeIcon typeText={typeText} />
        <span className="truncate font-medium text-foreground">{tf}</span>
      </span>
    );
  })();

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-9 w-full justify-start gap-2 px-3 py-2 text-left font-normal"
          >
            {summary}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[360px] space-y-4 rounded-md border-border bg-card p-5 shadow-sm data-[state=closed]:animate-none data-[state=open]:animate-none data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[side=bottom]:slide-in-from-top-0 data-[side=left]:slide-in-from-right-0 data-[side=right]:slide-in-from-left-0 data-[side=top]:slide-in-from-bottom-0"
          align="start"
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Field</Label>
            <Select
              value={selectFieldValue}
              onValueChange={(val) => {
                const nextField = val === EMPTY_FIELD ? "" : val;
                const nextCol = boundColumns.find((c) => c.name === nextField);
                const nextTransforms = getTransformsForColumnType(
                  role,
                  nextCol?.type,
                  allowEmptyField,
                  nextField,
                );
                const nextTransform = nextTransforms.includes(axis.transform)
                  ? axis.transform
                  : nextTransforms[0];
                patch({
                  field: nextField,
                  transform: nextTransform,
                  displayName: "",
                });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select column…" />
              </SelectTrigger>
              <SelectContent>
                {allowEmptyField ? (
                  <SelectItem value={EMPTY_FIELD}>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <ChartColumnTypeIcon category="numeric" />
                      <span>None (aggregate all rows)</span>
                    </span>
                  </SelectItem>
                ) : null}
                {boundColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name!}>
                    <ChartColumnFieldLabel
                      name={col.name!}
                      typeText={col.type}
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showScaleType ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Scale type</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    axis.scaleType === "continuous" ? "default" : "outline"
                  }
                  className="flex-1"
                  onClick={() => patch({ scaleType: "continuous" })}
                >
                  Continuous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    axis.scaleType === "categorical" ? "default" : "outline"
                  }
                  className="flex-1"
                  onClick={() => patch({ scaleType: "categorical" })}
                >
                  Categorical
                </Button>
              </div>
            </div>
          ) : null}

          {transforms.length > 1 || transforms[0] !== "none" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Transform</Label>
              <div className="flex flex-wrap gap-1">
                {transforms.map((tf) => (
                  <Button
                    key={tf}
                    type="button"
                    size="sm"
                    variant={axis.transform === tf ? "default" : "outline"}
                    className={cn(
                      "h-7 px-2 text-[11px]",
                      tf === "count_distinct" && "px-1.5",
                    )}
                    onClick={() => patch({ transform: tf })}
                  >
                    {TRANSFORM_LABEL[tf]}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs">Display name</Label>
            <Input
              value={axis.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
              placeholder="Axis title"
              className="h-9"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
