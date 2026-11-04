import type { ProjectJsonObject } from "../models/ProjectComponents";

/** Creates standalone GenieChat defaults with no workspace resource selected. */
export function createGenieChatProperties(): ProjectJsonObject {
  return {
    genieSpaceId: "",
    genieSpaceTitle: "",
    title: "Genie Chat",
    showBorder: false,
    chatTotalHeightPixels: 600,
  };
}
