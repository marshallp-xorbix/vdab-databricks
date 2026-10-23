import {
  discardHttpResponseBody,
  readBoundedJsonResponse,
} from "../bounded-json-response.ts";

const CREDENTIAL_REFRESH_SKEW_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
/** Maximum payload accepted from either Lakebase credential exchange. */
export const MAX_LAKEBASE_CREDENTIAL_RESPONSE_BYTES = 16_384;

/** Runtime values injected by a Databricks App and its Lakebase binding. */
export interface LakebaseCredentialEnvironment {
  workspaceHost: string | undefined;
  clientId: string | undefined;
  clientSecret: string | undefined;
  endpoint: string | undefined;
}

interface CachedCredential {
  value: string;
  expiresAt: number;
}

interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
}

interface LakebaseTokenResponse {
  token: string;
  expire_time: string;
}

/** Creates an expiring password provider for the bound Lakebase endpoint. */
export function createLakebasePasswordProvider(
  environment: LakebaseCredentialEnvironment,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): () => Promise<string> {
  const workspaceHost = requireWorkspaceOrigin(environment.workspaceHost);
  const clientId = requireValue(environment.clientId, "DATABRICKS_CLIENT_ID");
  const clientSecret = requireValue(
    environment.clientSecret,
    "DATABRICKS_CLIENT_SECRET",
  );
  const endpoint = requireValue(environment.endpoint, "LAKEBASE_ENDPOINT");

  if (
    !/^projects\/[\w-]+\/branches\/[\w-]+\/endpoints\/[\w-]+$/.test(endpoint)
  ) {
    throw new Error(
      "LAKEBASE_ENDPOINT must be a bound Lakebase endpoint path.",
    );
  }

  let workspaceCredential: CachedCredential | null = null;
  let databaseCredential: CachedCredential | null = null;
  let refreshOperation: Promise<string> | null = null;

  return async (): Promise<string> => {
    if (isFresh(databaseCredential, now())) {
      return databaseCredential.value;
    }

    if (refreshOperation) {
      return refreshOperation;
    }

    refreshOperation = refreshDatabaseCredential();

    try {
      return await refreshOperation;
    } finally {
      refreshOperation = null;
    }
  };

  async function refreshDatabaseCredential(): Promise<string> {
    const oauthToken = await getWorkspaceToken();
    const databaseTokenResponse = await fetcher(
      `${workspaceHost}/api/2.0/postgres/credentials`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${oauthToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ endpoint }),
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!databaseTokenResponse.ok) {
      await discardHttpResponseBody(databaseTokenResponse);
      throw new Error("Databricks did not issue a Lakebase credential.");
    }

    const databaseToken = await readLakebaseToken(databaseTokenResponse);
    databaseCredential = {
      value: databaseToken.token,
      expiresAt: Date.parse(databaseToken.expire_time),
    };

    if (!Number.isFinite(databaseCredential.expiresAt)) {
      databaseCredential = null;
      throw new Error(
        "Databricks returned an invalid Lakebase credential expiry.",
      );
    }

    return databaseCredential.value;
  }

  async function getWorkspaceToken(): Promise<string> {
    if (isFresh(workspaceCredential, now())) {
      return workspaceCredential.value;
    }

    const basicCredentials = Buffer.from(
      `${clientId}:${clientSecret}`,
    ).toString("base64");
    const oauthResponse = await fetcher(`${workspaceHost}/oidc/v1/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${basicCredentials}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=all-apis",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!oauthResponse.ok) {
      await discardHttpResponseBody(oauthResponse);
      throw new Error("Databricks did not issue an app workspace credential.");
    }

    const token = await readOAuthToken(oauthResponse);
    workspaceCredential = {
      value: token.access_token,
      expiresAt: now() + token.expires_in * 1000,
    };

    return workspaceCredential.value;
  }
}

function isFresh(
  credential: CachedCredential | null,
  currentTime: number,
): credential is CachedCredential {
  return (
    credential !== null &&
    credential.expiresAt > currentTime + CREDENTIAL_REFRESH_SKEW_MS
  );
}

async function readOAuthToken(response: Response): Promise<OAuthTokenResponse> {
  let value: unknown;
  try {
    value = await readBoundedJsonResponse(
      response,
      MAX_LAKEBASE_CREDENTIAL_RESPONSE_BYTES,
    );
  } catch {
    throw new Error("Databricks returned an invalid workspace credential.");
  }

  if (!isRecord(value)) {
    throw new Error("Databricks returned an invalid workspace credential.");
  }

  const accessToken = value.access_token;
  const expiresIn = value.expires_in;

  if (
    typeof accessToken !== "string" ||
    accessToken.length === 0 ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error("Databricks returned an invalid workspace credential.");
  }

  return { access_token: accessToken, expires_in: expiresIn };
}

async function readLakebaseToken(
  response: Response,
): Promise<LakebaseTokenResponse> {
  let value: unknown;
  try {
    value = await readBoundedJsonResponse(
      response,
      MAX_LAKEBASE_CREDENTIAL_RESPONSE_BYTES,
    );
  } catch {
    throw new Error("Databricks returned an invalid Lakebase credential.");
  }

  if (!isRecord(value)) {
    throw new Error("Databricks returned an invalid Lakebase credential.");
  }

  const token = value.token;
  const expireTime = value.expire_time;

  if (
    typeof token !== "string" ||
    token.length === 0 ||
    typeof expireTime !== "string"
  ) {
    throw new Error("Databricks returned an invalid Lakebase credential.");
  }

  return { token, expire_time: expireTime };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireWorkspaceOrigin(workspaceHost: string | undefined): string {
  const value = requireValue(workspaceHost, "DATABRICKS_HOST");
  const parsedHost = new URL(value);

  if (
    parsedHost.protocol !== "https:" ||
    parsedHost.username.length > 0 ||
    parsedHost.password.length > 0 ||
    parsedHost.pathname !== "/" ||
    parsedHost.search.length > 0 ||
    parsedHost.hash.length > 0
  ) {
    throw new Error("DATABRICKS_HOST must be an HTTPS workspace origin.");
  }

  return parsedHost.origin;
}

function requireValue(value: string | undefined, name: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`${name} is required for Lakebase access.`);
  }

  return normalizedValue;
}
