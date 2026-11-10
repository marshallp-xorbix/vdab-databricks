import { startProjectDeployment } from "../api/projectDeploymentsApi";
import { getWorkspaceApp } from "../api/workspaceAppsApi";
import type {
  IWorkspaceSecretResourceSelection,
  ProjectChildAppMode,
} from "../models/ProjectDeployments";

const APP_URL_ATTEMPTS = 30;
const APP_URL_DELAY_MS = 2_000;

export type DeploySavedProjectResult =
  | { status: "opened"; url: string }
  | { status: "started_without_url" };

/** Uploads the saved snapshot and opens the child App in a new tab when ready. */
export async function deploySavedProjectAndOpen(input: {
  projectId: string;
  mode: ProjectChildAppMode;
  appName: string;
  secretResources?: IWorkspaceSecretResourceSelection[];
}): Promise<DeploySavedProjectResult> {
  await startProjectDeployment({
    projectId: input.projectId,
    mode: input.mode,
    appName: input.appName,
    // Toolbar and Apps-list Deploy are explicit redeploy actions.
    confirmOverwrite: true,
    secretResources: input.secretResources ?? [],
  });
  const url = await waitForAppUrl(input.appName);
  if (!url) return { status: "started_without_url" };
  window.open(url, "_blank", "noopener,noreferrer");
  return { status: "opened", url };
}

async function waitForAppUrl(appName: string): Promise<string | null> {
  for (let attempt = 0; attempt < APP_URL_ATTEMPTS; attempt += 1) {
    const app = await getWorkspaceApp(appName);
    if (app.url) return app.url;
    await delay(APP_URL_DELAY_MS);
  }
  return null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
