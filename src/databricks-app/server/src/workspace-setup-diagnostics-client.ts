import type { CallerIdentity, WorkspaceSetupDiagnostics } from "./contracts.ts";
import { normalizeWorkspaceHost } from "./workspace-host.ts";

const APPS_PATH = "/api/2.0/apps/";
const OAUTH_CONSENT_PATH = "/api/2.0/oauth-app-integrations/";
const MAX_WORKSPACE_RESPONSE_BYTES = 131_072;
const REQUEST_TIMEOUT_MS = 5_000;

interface DatabricksAppAuthorizationResponse {
  oauth2_app_client_id?: unknown;
  user_api_scopes?: unknown;
  effective_user_api_scopes?: unknown;
}

interface DatabricksConsentResponse {
  user_consented_scopes?: unknown;
  scopes?: unknown;
  scope?: unknown;
}

/** Reads app-scope and current-user consent with only the forwarded user token. */
export interface WorkspaceSetupDiagnosticsClient {
  getAuthorizationDiagnostics(
    caller: CallerIdentity,
  ): Promise<WorkspaceSetupDiagnostics["authorization"]>;
}

/** Creates a read-only workspace diagnostics adapter pinned to the installed workspace. */
export function createWorkspaceSetupDiagnosticsClient(
  workspaceHost: string | null,
  appName: string | null,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceSetupDiagnosticsClient {
  const pinnedWorkspaceHost = workspaceHost
    ? normalizeWorkspaceHost(workspaceHost)
    : null;
  const normalizedAppName = appName?.trim() || null;

  return {
    getAuthorizationDiagnostics: async (caller) => {
      if (
        !caller.databricksAccessToken ||
        !pinnedWorkspaceHost ||
        !normalizedAppName
      ) {
        return unavailableAuthorization(
          "The installed workspace app name, host, or signed-in user token is unavailable.",
        );
      }

      return checkAuthorization(
        caller.databricksAccessToken,
        pinnedWorkspaceHost,
        normalizedAppName,
        fetchImplementation,
      );
    },
  };
}

async function checkAuthorization(
  accessToken: string,
  workspaceHost: string,
  appName: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceSetupDiagnostics["authorization"]> {
  const appResponse = await readWorkspaceJson(
    new URL(`${APPS_PATH}${encodeURIComponent(appName)}`, workspaceHost),
    accessToken,
    fetchImplementation,
  );

  if (!appResponse.ok) {
    return unavailableAuthorization(
      appResponse.status === 401
        ? "Databricks rejected the signed-in session. Refresh VDAB and sign in again."
        : appResponse.status === 403
          ? "The Apps scope or permission needed to inspect authorization is unavailable. Check the app's configured scopes and test the affected feature."
          : "The app authorization configuration could not be read from this workspace.",
    );
  }

  const app = asRecord(appResponse.body);
  const clientId = app?.oauth2_app_client_id;
  const requestedScopes = readOptionalStringArray(app?.user_api_scopes);
  const effectiveScopes = readOptionalStringArray(
    app?.effective_user_api_scopes,
  );
  const hasScopeConfiguration =
    app !== null &&
    ("user_api_scopes" in app || "effective_user_api_scopes" in app);

  if (
    typeof clientId !== "string" ||
    clientId.trim().length === 0 ||
    requestedScopes === null ||
    effectiveScopes === null ||
    !hasScopeConfiguration
  ) {
    return unavailableAuthorization(
      "Databricks returned app authorization metadata in an unsupported format.",
    );
  }

  const consentResponse = await readWorkspaceJson(
    new URL(
      `${OAUTH_CONSENT_PATH}${encodeURIComponent(clientId)}/user-consent/me`,
      workspaceHost,
    ),
    accessToken,
    fetchImplementation,
  );

  if (!consentResponse.ok) {
    return unavailableAuthorization(
      consentResponse.status === 401
        ? "Databricks rejected the signed-in session while checking consent. Refresh VDAB and sign in again."
        : consentResponse.status === 403
          ? "Databricks did not allow this caller to inspect consent. Check the affected feature directly and review OAuth consent in Databricks."
          : "The caller's OAuth consent could not be confirmed. Review OAuth consent in Databricks and test the affected feature.",
      requestedScopes,
      effectiveScopes,
    );
  }

  const consent = asRecord(consentResponse.body);
  const consentedScopes = readConsentScopes(consent);

  if (consentedScopes === null) {
    return unavailableAuthorization(
      "Databricks returned consent metadata in an unsupported format. Review OAuth consent in Databricks and test the affected feature.",
      requestedScopes,
      effectiveScopes,
    );
  }

  const requiredScopes =
    effectiveScopes.length > 0 ? effectiveScopes : requestedScopes;
  const missingScopes = requiredScopes.filter(
    (scope) => !consentedScopes.includes(scope),
  );

  return {
    status: missingScopes.length === 0 ? "verified" : "missing-scopes",
    requestedScopes,
    effectiveScopes,
    consentedScopes,
    missingScopes,
    message:
      missingScopes.length === 0
        ? "The current user has consented to the effective scopes returned by Databricks. Resource permissions are still checked when each feature runs."
        : "The current user's consent does not include every effective app scope. Grant consent in Databricks, then run this check again.",
  };
}

async function readWorkspaceJson(
  endpoint: URL,
  accessToken: string,
  fetchImplementation: typeof fetch,
): Promise<{ ok: true; body: unknown } | { ok: false; status: number }> {
  let response: Response;

  try {
    response = await fetchImplementation(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 0 };
  }

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  try {
    const body = await readResponseBodyWithinLimit(response);
    return { ok: true, body: JSON.parse(body) as unknown };
  } catch {
    return { ok: false, status: 502 };
  }
}

async function readResponseBodyWithinLimit(
  response: Response,
): Promise<string> {
  if (!response.body) {
    throw new Error("Workspace response body is missing.");
  }

  const reader = response.body.getReader();
  const bodyChunks: Uint8Array[] = [];
  let bodyBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      bodyBytes += value.byteLength;
      if (bodyBytes > MAX_WORKSPACE_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Workspace response exceeds the safe size limit.");
      }

      bodyChunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const responseBytes = new Uint8Array(bodyBytes);
  let offset = 0;
  for (const chunk of bodyChunks) {
    responseBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(responseBytes);
}

function readConsentScopes(
  response: Record<string, unknown> | null,
): string[] | null {
  if (!response) {
    return null;
  }

  if (Object.hasOwn(response, "user_consented_scopes")) {
    return readStringArray(response.user_consented_scopes);
  }

  const scopes = readStringArray(response.scopes);

  if (scopes !== null) {
    return scopes;
  }

  if (typeof response.scope === "string") {
    return response.scope.trim().length === 0
      ? []
      : response.scope.trim().split(/\s+/u);
  }

  return null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }

  return [
    ...new Set(value.map((item) => (item as string).trim()).filter(Boolean)),
  ];
}

function readOptionalStringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) {
    return [];
  }

  return readStringArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unavailableAuthorization(
  message: string,
  requestedScopes: string[] = [],
  effectiveScopes: string[] = [],
): WorkspaceSetupDiagnostics["authorization"] {
  return {
    status: "unavailable",
    requestedScopes,
    effectiveScopes,
    consentedScopes: [],
    missingScopes: [],
    message,
  };
}
