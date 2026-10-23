import type {
  CallerIdentity,
  ProjectDeploymentSourceFile,
} from "../src/contracts.ts";
import { createWorkspaceAppDeploymentClient } from "../src/workspace-app-deployment-client.ts";

export const CALLER: CallerIdentity = {
  userId: "editor-1",
  preferredUsername: "editor@example.test",
  email: "editor@example.test",
  workspaceId: "workspace-1",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: "caller-token",
};

export const SOURCE_PATH =
  "/Workspace/Users/editor@example.test/.vdab/deployments/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";

export const SOURCE_FILES: ProjectDeploymentSourceFile[] = [
  { path: "app.py", content: "import streamlit as st\nst.title('Demo')\n" },
  { path: "requirements.txt", content: "streamlit==1.38.0\n" },
];

/** Creates a deployment client with a deterministic sequence of mocked responses. */
export function createClientHarness(responses: Response[]) {
  const pendingResponses = [...responses];
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImplementation: typeof fetch = async (input, init = {}) => {
    calls.push({ url: input.toString(), init });
    const response = pendingResponses.shift();
    if (!response) throw new Error("No fake response was configured.");
    return response;
  };

  return {
    calls,
    client: createWorkspaceAppDeploymentClient(
      "https://workspace.example",
      "vdab-app",
      fetchImplementation,
    ),
  };
}

/** Creates a JSON Response for mocked Databricks API calls. */
export function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
