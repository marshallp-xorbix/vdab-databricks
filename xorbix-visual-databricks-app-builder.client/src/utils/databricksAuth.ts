import type { DatabricksConnection } from "../models";
import { DATABRICKS_AUTH_STORAGE_KEYS } from "../constants/databricksAuthStorageKeys";
import { getDatabricksRedirectUri } from "../config/api";

const AUTH_SCOPE = "all-apis offline_access";

const generatePkceCodes = async () => {
  const allowedChars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomChar = () =>
    allowedChars.charAt(Math.floor(Math.random() * allowedChars.length));

  const codeVerifier = Array.from({ length: 64 }, randomChar).join("");
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { codeVerifier, codeChallenge: base64 };
};

export const startDatabricksAuthorization = async (
  workspace: DatabricksConnection,
  returnUrl?: string,
) => {
  const workspaceUrl = workspace.workspaceUrl;
  const workspaceDisplayName = workspace.workspaceDisplayName;
  const redirectUri = getDatabricksRedirectUri();

  if (!workspaceUrl) {
    throw new Error("Workspace URL is missing.");
  }

  if (!workspaceDisplayName) {
    throw new Error("Workspace display name is missing.");
  }

  if (!workspace.clientId) {
    throw new Error("Client ID is missing for this workspace.");
  }

  if (!redirectUri) {
    throw new Error("Redirect URL is missing.");
  }

  const state = crypto.randomUUID();
  const { codeVerifier, codeChallenge } = await generatePkceCodes();
  const resolvedReturnUrl =
    returnUrl ??
    `${window.location.pathname}${window.location.search}${window.location.hash}`;

  localStorage.setItem(DATABRICKS_AUTH_STORAGE_KEYS.codeVerifier, codeVerifier);
  localStorage.setItem(DATABRICKS_AUTH_STORAGE_KEYS.workspaceUrl, workspaceUrl);
  if (workspace.pkId > 0) {
    localStorage.setItem(
      DATABRICKS_AUTH_STORAGE_KEYS.workspaceConnectionId,
      String(workspace.pkId),
    );
  } else {
    localStorage.removeItem(DATABRICKS_AUTH_STORAGE_KEYS.workspaceConnectionId);
  }
  localStorage.setItem(
    DATABRICKS_AUTH_STORAGE_KEYS.workspaceDisplayName,
    workspaceDisplayName,
  );
  localStorage.setItem(DATABRICKS_AUTH_STORAGE_KEYS.returnUrl, resolvedReturnUrl);

  const authUrl =
    `${workspaceUrl}/oidc/v1/authorize?` +
    new URLSearchParams({
      client_id: workspace.clientId ?? "",
      redirect_uri: redirectUri ?? "",
      response_type: "code",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      scope: AUTH_SCOPE,
    }).toString();

  window.location.href = authUrl;
};
