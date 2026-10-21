import type { ProjectJsonObject } from "../models/ProjectComponents";

/** Creates standalone ModelChat defaults with no workspace endpoint selected. */
export function createModelChatProperties(): ProjectJsonObject {
  return {
    servingEndpointName: "",
    title: "Model Chat",
    showBorder: false,
    chatTotalHeightPixels: 600,
  };
}
