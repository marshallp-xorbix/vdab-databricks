import type { IProjectComponent } from "../models/ProjectComponents";

/** Explains why Genie Chat or Model Chat cannot deploy until its workspace target is selected. */
export function getChatDeployBlockingMessage(
  components: readonly IProjectComponent[],
): string | null {
  for (const component of components) {
    const label = component.codeName || component.key;
    if (component.type === "GenieChat" && !readText(component.properties.genieSpaceId)) {
      return `Genie Chat "${label}" is not bound to a Genie space. Select a Genie space in the component properties before deploying.`;
    }
    if (component.type === "ModelChat" && !readText(component.properties.servingEndpointName)) {
      return `Model Chat "${label}" is not bound to a serving endpoint. Select a chat endpoint in the component properties before deploying.`;
    }
  }
  return null;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
