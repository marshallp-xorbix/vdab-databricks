import type { NormalizedAppResource } from "../models/DatabricksAppModels";
import type { VdabComponent } from "../types/components";
import { ComponentType } from "../types/components/componentTypes";
import { AppResourceKindSlug } from "../types/appResourceKinds";

function genieResourceNameSet(resources: NormalizedAppResource[]): Set<string> {
  return new Set(
    resources
      .filter((r) => r.kind === AppResourceKindSlug.GenieSpace)
      .map((r) => r.name.trim())
      .filter((n) => n.length > 0),
  );
}

function resourceNameMatches(
  declared: Set<string>,
  selected: string,
): boolean {
  if (declared.has(selected)) {
    return true;
  }
  const lower = selected.toLowerCase();
  for (const name of declared) {
    if (name.toLowerCase() === lower) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a user-facing message when any Genie Chat cannot be deployed or previewed, or null if OK.
 */
export function getGenieChatDeployBlockingMessage(
  components: VdabComponent[],
  resources: NormalizedAppResource[],
): string | null {
  const declared = genieResourceNameSet(resources);

  for (const c of components) {
    if (c.type !== ComponentType.GenieChat) {
      continue;
    }
    const selected = String(c.props?.genieSpaceAppResourceName ?? "").trim();
    const label = c.codeName?.trim() || c.id;
    if (!selected) {
      return `Genie Chat "${label}" is not bound to a Genie space. Open App Settings → App resources, add a Genie space, then select it in the component properties.`;
    }
    if (!resourceNameMatches(declared, selected)) {
      return `Genie Chat "${label}" references app resource "${selected}", but no genie_space resource with that name exists. Add it under App Settings or pick an existing Genie space.`;
    }
  }

  return null;
}
