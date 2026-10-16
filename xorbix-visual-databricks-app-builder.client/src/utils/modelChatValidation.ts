import type { NormalizedAppResource } from "../models/DatabricksAppModels";
import type { VdabComponent } from "../types/components";
import { ComponentType } from "../types/components/componentTypes";
import {
  findServingEndpointResourceByName,
  getServingEndpointPermissionLabel,
  hasServingEndpointQueryPermission,
} from "./servingEndpointResourceUtils";

/**
 * Returns a user-facing message when any Model Chat cannot be deployed or previewed, or null if OK.
 */
export function getModelChatDeployBlockingMessage(
  components: VdabComponent[],
  resources: NormalizedAppResource[],
): string | null {
  for (const component of components) {
    if (component.type !== ComponentType.ModelChat) {
      continue;
    }

    const rawSelected = component.props?.servingEndpointAppResourceName;
    const selected =
      typeof rawSelected === "string" ? rawSelected.trim() : "";
    const label = component.codeName?.trim() || component.id;
    if (!selected) {
      return `Model Chat "${label}" is not bound to a serving endpoint. Open App Settings -> App resources, add a Serving endpoint with CAN_QUERY permission, then select it in the component properties.`;
    }

    const resource = findServingEndpointResourceByName(resources, selected);
    if (resource == null) {
      return `Model Chat "${label}" references app resource "${selected}", but no serving_endpoint resource with that name exists. Add it under App Settings or pick an existing Serving endpoint.`;
    }

    if (!hasServingEndpointQueryPermission(resource)) {
      const permission = getServingEndpointPermissionLabel(resource);
      return `Model Chat "${label}" references app resource "${selected}", but that serving_endpoint resource has permission "${permission}". Change it to CAN_QUERY or CAN_MANAGE in App Settings before deploying.`;
    }
  }

  return null;
}
