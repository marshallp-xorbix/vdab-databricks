import type { ProjectJsonObject } from "../models/ProjectComponents";

/** Creates ModelChat defaults with no App resource selected. */
export function createModelChatProperties(): ProjectJsonObject {
  return {
    servingEndpointAppResourceName: "",
    title: "Model Chat",
    showBorder: false,
    chatTotalHeightPixels: 600,
  };
}
