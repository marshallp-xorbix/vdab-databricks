import { startProjectDeployment } from "../api/projectDeploymentsApi";
import { getWorkspaceApp } from "../api/workspaceAppsApi";
import type { ProjectChildAppMode } from "../models/ProjectDeployments";

const APP_URL_ATTEMPTS = 8;
const APP_URL_DELAY_MS = 400;

/** Uploads the saved snapshot and opens the child App page once Databricks returns its URL. */
export async function deploySavedProjectAndOpen(input: {
  projectId: string;
  mode: ProjectChildAppMode;
  appName: string;
}): Promise<void> {
  await startProjectDeployment({
    projectId: input.projectId,
    mode: input.mode,
    appName: input.appName,
    confirmOverwrite: input.mode === "linkExisting",
  });
  const url = await waitForAppUrl(input.appName);
  window.location.assign(url);
}

async function waitForAppUrl(appName: string): Promise<string> {
  for (let attempt = 0; attempt < APP_URL_ATTEMPTS; attempt += 1) {
    const app = await getWorkspaceApp(appName);
    if (app.url) return app.url;
    await delay(APP_URL_DELAY_MS);
  }
  throw new Error(
    "The Databricks App deployment started, but its page is not available yet.",
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
