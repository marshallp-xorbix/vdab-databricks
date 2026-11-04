import { parseChartAxis } from "../../../types/chartAxisConfig";

/**
 * True when every raw axis config has a non-empty field mapping.
 */
export function hasRequiredAxisFields(...rawAxes: unknown[]): boolean {
  return rawAxes.every((raw) => parseChartAxis(raw).field.length > 0);
}
