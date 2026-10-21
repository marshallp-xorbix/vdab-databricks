import { Pool, type PoolConfig } from "pg";
import { createLakebasePasswordProvider } from "./lakebase-credentials.ts";

const DEFAULT_CONNECTION_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const MAX_POOL_CONNECTIONS = 5;

/** Creates the customer-bound Lakebase pool with rotating app credentials. */
export function createLakebasePool(
  environment: NodeJS.ProcessEnv = process.env,
): Pool {
  const host = requireValue(environment.PGHOST, "PGHOST");
  const database = requireValue(environment.PGDATABASE, "PGDATABASE");
  const user = requireValue(environment.PGUSER, "PGUSER");
  const port = resolvePort(environment.PGPORT);
  const sslMode = requireValue(environment.PGSSLMODE, "PGSSLMODE");

  if (sslMode !== "require" && sslMode !== "verify-full") {
    throw new Error("Lakebase connections require TLS verification.");
  }

  const password = createLakebasePasswordProvider({
    workspaceHost: environment.DATABRICKS_HOST,
    clientId: environment.DATABRICKS_CLIENT_ID,
    clientSecret: environment.DATABRICKS_CLIENT_SECRET,
    endpoint: environment.LAKEBASE_ENDPOINT,
  });
  const configuration: PoolConfig = {
    host,
    database,
    user,
    port,
    ssl: { rejectUnauthorized: true },
    password,
    max: MAX_POOL_CONNECTIONS,
    connectionTimeoutMillis: DEFAULT_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: DEFAULT_IDLE_TIMEOUT_MS,
    keepAlive: true,
    application_name: "vdab-builder",
  };

  return new Pool(configuration);
}

function resolvePort(rawPort: string | undefined): number {
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PGPORT must be a valid PostgreSQL port.");
  }

  return port;
}

function requireValue(value: string | undefined, name: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`${name} is required for Lakebase access.`);
  }

  return normalizedValue;
}
