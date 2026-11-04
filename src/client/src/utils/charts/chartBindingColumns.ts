import type { UnityCatalogColumn } from "../../types/components/bindings";
import type { VdabComponent } from "../../types/components";

/**
 * Columns from a table binding stored on older apps under `binding.config`
 * instead of `binding.source.resource`.
 */
interface LegacyBindingConfig {
  config?: {
    columns?: UnityCatalogColumn[];
  };
}

function filterObjectColumns(
  columns: unknown[] | undefined,
): UnityCatalogColumn[] {
  if (!Array.isArray(columns) || columns.length === 0) {
    return [];
  }

  return columns.filter(
    (col): col is UnityCatalogColumn => Boolean(col) && typeof col === "object",
  );
}

/**
 * Resolves column metadata from the component's bound table for chart axis pickers
 * and save validation. Prefers `source.resource.columns` (current shape), then
 * legacy `config.columns` when present on older saved bindings.
 */
export function getBoundTableColumnsFromComponent(
  component: VdabComponent,
): UnityCatalogColumn[] {
  const bindings = component.bindings;
  if (!bindings) {
    return [];
  }

  const resourceCandidates: (unknown[] | undefined)[] = [
    bindings.lakebaseAutoscaling?.source?.resource?.columns,
    bindings.lakebaseProvisionedDatabase?.source?.resource?.columns,
    bindings.unityCatalogTable?.source?.resource?.columns,
  ];

  for (const columns of resourceCandidates) {
    const filtered = filterObjectColumns(columns);
    if (filtered.length > 0) {
      return filtered;
    }
  }

  const legacyCandidates: (unknown[] | undefined)[] = [
    (bindings.lakebaseAutoscaling as LegacyBindingConfig | undefined)?.config
      ?.columns,
    (bindings.lakebaseProvisionedDatabase as LegacyBindingConfig | undefined)
      ?.config?.columns,
    (bindings.unityCatalogTable as LegacyBindingConfig | undefined)?.config
      ?.columns,
  ];

  for (const columns of legacyCandidates) {
    const filtered = filterObjectColumns(columns);
    if (filtered.length > 0) {
      return filtered;
    }
  }

  return [];
}
