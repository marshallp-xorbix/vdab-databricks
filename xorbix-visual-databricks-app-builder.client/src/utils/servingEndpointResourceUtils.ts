import type { NormalizedAppResource } from "../models/DatabricksAppModels";
import { AppResourceKindSlug } from "../types/appResourceKinds";

const QUERYABLE_SERVING_ENDPOINT_PERMISSIONS = new Set([
  "CAN_QUERY",
  "CAN_MANAGE",
]);

export function getServingEndpointResources(
  resources: NormalizedAppResource[],
): NormalizedAppResource[] {
  return resources.filter(
    (resource) => resource.kind === AppResourceKindSlug.ServingEndpoint,
  );
}

export function findServingEndpointResourceByName(
  resources: NormalizedAppResource[],
  selectedName: string,
): NormalizedAppResource | undefined {
  const normalizedSelectedName = selectedName.trim().toLowerCase();
  return getServingEndpointResources(resources).find(
    (resource) =>
      resource.name.trim().toLowerCase() === normalizedSelectedName,
  );
}

export function hasServingEndpointQueryPermission(
  resource: NormalizedAppResource,
): boolean {
  const permission = resource.servingEndpoint?.permission?.trim().toUpperCase();
  return QUERYABLE_SERVING_ENDPOINT_PERMISSIONS.has(permission ?? "");
}

export function getServingEndpointPermissionLabel(
  resource: NormalizedAppResource,
): string {
  return resource.servingEndpoint?.permission?.trim() || "none";
}
