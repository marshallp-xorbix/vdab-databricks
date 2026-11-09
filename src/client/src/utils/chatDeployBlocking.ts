import type { IProjectComponent } from "../models/ProjectComponents";
import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import { AppResourceKindSlug } from "../types/appResourceKinds";

/** Explains why Genie Chat or Model Chat cannot deploy until its App resource is valid. */
export function getChatDeployBlockingMessage(
  components: readonly IProjectComponent[],
  resources: readonly IWorkspaceAppResource[] = [],
): string | null {
  for (const component of components) {
    const label = component.codeName || component.key;
    if (component.type === "GenieChat") {
      const selected = readText(component.properties.genieSpaceAppResourceName);
      if (!selected) {
        return `Genie Chat "${label}" is not bound to a Genie space. Open App Settings → Resources, add a Genie space, then select it in the component properties.`;
      }
      if (!findGenieResource(resources, selected)) {
        return `Genie Chat "${label}" references app resource "${selected}", but no genie_space resource with that name exists. Add it under App Settings or pick an existing Genie space.`;
      }
    }
    if (component.type === "ModelChat") {
      const selected = readText(
        component.properties.servingEndpointAppResourceName,
      );
      if (!selected) {
        return `Model Chat "${label}" is not bound to a serving endpoint. Open App Settings → Resources, add a Serving endpoint with CAN_QUERY permission, then select it in the component properties.`;
      }
      const resource = findServingResource(resources, selected);
      if (!resource) {
        return `Model Chat "${label}" references app resource "${selected}", but no serving_endpoint resource with that name exists. Add it under App Settings or pick an existing Serving endpoint.`;
      }
      if (!hasServingQueryPermission(resource)) {
        const permission = readServingPermission(resource);
        return `Model Chat "${label}" references app resource "${selected}", but that serving_endpoint resource has permission "${permission}". Change it to CAN_QUERY or CAN_MANAGE in App Settings before deploying.`;
      }
    }
  }
  return null;
}

function findGenieResource(
  resources: readonly IWorkspaceAppResource[],
  name: string,
): IWorkspaceAppResource | undefined {
  const lower = name.toLowerCase();
  return resources.find(
    (resource) =>
      AppResourceKindSlug.GenieSpace in resource &&
      resource.name.trim().toLowerCase() === lower,
  );
}

function findServingResource(
  resources: readonly IWorkspaceAppResource[],
  name: string,
): IWorkspaceAppResource | undefined {
  const lower = name.toLowerCase();
  return resources.find(
    (resource) =>
      AppResourceKindSlug.ServingEndpoint in resource &&
      resource.name.trim().toLowerCase() === lower,
  );
}

function hasServingQueryPermission(resource: IWorkspaceAppResource): boolean {
  if (!("serving_endpoint" in resource)) return false;
  const permission = resource.serving_endpoint.permission;
  return permission === "CAN_QUERY" || permission === "CAN_MANAGE";
}

function readServingPermission(resource: IWorkspaceAppResource): string {
  if (!("serving_endpoint" in resource)) return "unknown";
  return resource.serving_endpoint.permission;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
