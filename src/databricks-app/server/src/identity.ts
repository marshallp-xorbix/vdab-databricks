import type { IncomingMessage } from "node:http";
import type { CallerIdentity } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import { normalizeWorkspaceHost } from "./workspace-host.ts";

const AUTHENTICATION_MODE_LOCAL_TEST = "local-test";
const AUTHENTICATION_MODE_DATABRICKS = "databricks";
const LOCAL_TEST_USER_ID_VARIABLE = "VDAB_LOCAL_USER_ID";
const AUTHENTICATION_MODE_VARIABLE = "VDAB_AUTH_MODE";
const INSTALLATION_ADMIN_IDS_VARIABLE = "VDAB_INSTALL_ADMIN_IDS";

/** Resolves a caller using only the configured app identity boundary. */
export type IdentityResolver = (
  request: IncomingMessage,
) => Promise<CallerIdentity>;

/** Runtime environment values required to establish a caller identity. */
export interface IdentityEnvironment {
  authenticationMode: string | undefined;
  nodeEnvironment: string | undefined;
  localUserId: string | undefined;
  workspaceHost: string | undefined;
  workspaceId: string | undefined;
  installationAdminIds?: string | undefined;
}

/** Resolves the explicit local test identity or the trusted Databricks proxy identity. */
export function createIdentityResolver(
  environment: IdentityEnvironment = readIdentityEnvironment(),
): IdentityResolver {
  const mode = environment.authenticationMode;

  if (mode === AUTHENTICATION_MODE_LOCAL_TEST) {
    return createLocalTestIdentityResolver(environment);
  }

  if (mode !== AUTHENTICATION_MODE_DATABRICKS) {
    throw new Error(
      `${AUTHENTICATION_MODE_VARIABLE} must be set to 'databricks' or 'local-test'.`,
    );
  }

  requireWorkspaceHost(environment.workspaceHost);

  return async (request: IncomingMessage): Promise<CallerIdentity> => {
    const accessToken = readSingleHeader(
      request,
      "x-forwarded-access-token",
    );
    const userId = readSingleHeader(request, "x-forwarded-user");

    if (!accessToken || !userId) {
      throw new ApplicationError(
        401,
        "databricks_session_required",
        "Sign in required",
        "Open this app through Databricks and sign in to continue.",
      );
    }

    return {
      userId,
      preferredUsername: readSingleHeader(
        request,
        "x-forwarded-preferred-username",
      ),
      email: readSingleHeader(request, "x-forwarded-email"),
      workspaceId: environment.workspaceId ?? null,
      authenticationMode: AUTHENTICATION_MODE_DATABRICKS,
      isInstallationAdmin: isConfiguredInstallationAdmin(
        userId,
        environment.installationAdminIds,
      ),
      databricksAccessToken: accessToken,
    };
  };
}

function createLocalTestIdentityResolver(
  environment: IdentityEnvironment,
): IdentityResolver {
  if (environment.nodeEnvironment === "production") {
    throw new Error("Local test identity is forbidden in production.");
  }

  const userId = environment.localUserId?.trim();

  if (!userId) {
    throw new Error(`${LOCAL_TEST_USER_ID_VARIABLE} is required in local-test mode.`);
  }

  return async (): Promise<CallerIdentity> => ({
    userId,
    preferredUsername: userId,
    email: null,
    workspaceId: environment.workspaceId ?? null,
    authenticationMode: AUTHENTICATION_MODE_LOCAL_TEST,
    isInstallationAdmin: false,
    databricksAccessToken: null,
  });
}

function readIdentityEnvironment(): IdentityEnvironment {
  return {
    authenticationMode: process.env[AUTHENTICATION_MODE_VARIABLE],
    nodeEnvironment: process.env.NODE_ENV,
    localUserId: process.env[LOCAL_TEST_USER_ID_VARIABLE],
    workspaceHost: process.env.DATABRICKS_HOST,
    workspaceId: process.env.DATABRICKS_WORKSPACE_ID,
    installationAdminIds: process.env[INSTALLATION_ADMIN_IDS_VARIABLE],
  };
}

function isConfiguredInstallationAdmin(
  userId: string,
  configuredIds: string | undefined,
): boolean {
  return (configuredIds ?? "")
    .split(",")
    .map((configuredId) => configuredId.trim())
    .filter((configuredId) => configuredId.length > 0)
    .includes(userId);
}

function requireWorkspaceHost(workspaceHost: string | undefined): void {
  if (!workspaceHost) {
    throw new Error("DATABRICKS_HOST is required in Databricks authentication mode.");
  }

  normalizeWorkspaceHost(workspaceHost);
}

function readSingleHeader(
  request: IncomingMessage,
  headerName: string,
): string | null {
  const headerValue = request.headers[headerName];

  if (typeof headerValue !== "string" || headerValue.trim().length === 0) {
    return null;
  }

  return headerValue.trim();
}
