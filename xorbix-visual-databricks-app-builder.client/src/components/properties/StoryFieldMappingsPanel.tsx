import type { FC, ReactNode } from "react";
import type { VdabComponent } from "../../types/components";
import {
  defaultChartAxis,
  parseChartAxis,
  type ChartAxisConfig,
  type ChartAxisFieldRole,
} from "../../types/chartAxisConfig";
import { resolveBindingColumns } from "../../utils/bindings/resolveBindingColumns";
import { ChartAxisFieldPopover } from "./ChartAxisFieldPopover";

export interface IStoryFieldMappingRow {
  key: string;
  label: string;
  role: ChartAxisFieldRole;
  continuousDefault?: boolean;
  defaultTransform?: ChartAxisConfig["transform"];
}

interface IStoryFieldMappingsPanelProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
  requiredFields: readonly IStoryFieldMappingRow[];
  optionalFields: readonly IStoryFieldMappingRow[];
}

function parseAxis(
  raw: unknown,
  continuousDefault?: boolean,
  defaultTransform?: ChartAxisConfig["transform"],
): ChartAxisConfig {
  return {
    ...defaultChartAxis({
      scaleType: continuousDefault ? "continuous" : "categorical",
      transform: defaultTransform ?? "none",
    }),
    ...parseChartAxis(raw),
  };
}

function hasTableBinding(component: VdabComponent): boolean {
  return Boolean(
    component.bindings?.lakebaseAutoscaling ||
      component.bindings?.lakebaseProvisionedDatabase ||
      component.bindings?.unityCatalogTable,
  );
}

/**
 * Shared Field Mappings UI for story visualizations (Required + Optional role → column pickers).
 */
export const StoryFieldMappingsPanel: FC<IStoryFieldMappingsPanelProps> = ({
  component,
  onPropertyChange,
  requiredFields,
  optionalFields,
}) => {
  const props = component.props as Record<string, unknown>;
  const columns = resolveBindingColumns(component);
  const hasBinding = hasTableBinding(component);

  return (
    <div className="space-y-4">
      {!hasBinding && (
        <p className="text-xs text-warning-foreground bg-warning-subtle border border-warning/30 rounded-md px-2 py-1.5">
          Bind a Unity Catalog or Lakebase table in the Bindings panel first to
          choose columns.
        </p>
      )}
      {hasBinding && columns.length === 0 && (
        <p className="text-xs text-warning-foreground bg-warning-subtle border border-warning/30 rounded-md px-2 py-1.5">
          No columns found on this binding. Re-select the table in Bindings to
          refresh column metadata.
        </p>
      )}

      <FieldSection title="Required">
        {requiredFields.map((row) => (
          <ChartAxisFieldPopover
            key={row.key}
            label={row.label}
            role={row.role}
            axis={parseAxis(
              props[row.key],
              row.continuousDefault,
              row.defaultTransform,
            )}
            columns={columns}
            onChange={(next) => onPropertyChange(row.key, next)}
          />
        ))}
      </FieldSection>

      <FieldSection title="Optional" bordered>
        {optionalFields.map((row) => (
          <ChartAxisFieldPopover
            key={row.key}
            label={row.label}
            role={row.role}
            axis={parseAxis(
              props[row.key],
              row.continuousDefault,
              row.defaultTransform,
            )}
            columns={columns}
            onChange={(next) => onPropertyChange(row.key, next)}
          />
        ))}
      </FieldSection>
    </div>
  );
};

interface IFieldSectionProps {
  title: string;
  bordered?: boolean;
  children: ReactNode;
}

function FieldSection({
  title,
  bordered = false,
  children,
}: Readonly<IFieldSectionProps>) {
  return (
    <div
      className={
        bordered
          ? "space-y-4 pt-2 border-t border-border"
          : "space-y-4"
      }
    >
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
