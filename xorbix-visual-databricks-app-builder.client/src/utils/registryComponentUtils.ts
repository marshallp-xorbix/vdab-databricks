import type { VdabComponent } from "../types/components";

/**
 * API contract is `VdabComponent`, but payloads may still send PascalCase `Type`
 * from some code paths; normalize for lookups.
 */
type RegistryEntryShape = VdabComponent & { Type?: string };

export function getRegistryDefinitionType(component: VdabComponent): string {
  const row = component as RegistryEntryShape;
  if (typeof row.type === "string" && row.type.length > 0) {
    return row.type;
  }
  if (typeof row.Type === "string" && row.Type.length > 0) {
    return row.Type;
  }
  return "";
}
