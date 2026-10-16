import type { UnityCatalogColumn } from "../../types/components/bindings";
import type { VdabComponent } from "../../types/components";
import { getBoundTableColumnsFromComponent } from "../charts/chartBindingColumns";

/**
 * Resolves selectable columns for chart / story field mappers from the
 * component's Unity Catalog or Lakebase table binding.
 */
export function resolveBindingColumns(
  component: VdabComponent,
): UnityCatalogColumn[] {
  return getBoundTableColumnsFromComponent(component);
}
