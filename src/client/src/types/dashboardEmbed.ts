import type { ProjectJsonObject } from "../models/ProjectComponents";

export interface DashboardEmbedProperties {
  src: string;
  height: number;
  scrolling: boolean;
}

/** Creates standalone DashboardEmbed defaults. */
export function createDashboardEmbedProperties(): ProjectJsonObject {
  return { src: "", height: 600, scrolling: true };
}
