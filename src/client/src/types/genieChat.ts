import type { ProjectJsonObject } from "../models/ProjectComponents";

/** Creates GenieChat defaults with no App resource selected. */
export function createGenieChatProperties(): ProjectJsonObject {
  return {
    genieSpaceAppResourceName: "",
    title: "Genie Chat",
    showBorder: false,
    chatTotalHeightPixels: 600,
  };
}
