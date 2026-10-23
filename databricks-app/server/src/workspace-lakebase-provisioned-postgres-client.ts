import { Pool } from "pg";
import type { PoolConfig } from "pg";

const POSTGRES_PORT = 5432;
const POSTGRES_TIMEOUT_MS = 10_000;

/** A bounded PostgreSQL connection used for workspace metadata discovery. */
export interface ProvisionedPostgresConnection {
  query(statement: string, parameters: readonly (string | number)[]): Promise<unknown[]>;
  close(): Promise<void>;
}

/** Credential and endpoint settings for one viewer-authorized PostgreSQL connection. */
export interface ProvisionedPostgresConnectionOptions {
  host: string;
  user: string;
  database: string;
  password: string;
}

/** Creates the caller-scoped PostgreSQL connection used by the resource adapter. */
export type ProvisionedPostgresConnectionFactory = (
  options: ProvisionedPostgresConnectionOptions,
) => ProvisionedPostgresConnection;

/** Creates a TLS-only, single-connection PostgreSQL pool with bounded operations. */
export function createProvisionedPostgresConnection(
  options: ProvisionedPostgresConnectionOptions,
): ProvisionedPostgresConnection {
  const config: PoolConfig = {
    host: options.host,
    port: POSTGRES_PORT,
    user: options.user,
    database: options.database,
    password: options.password,
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: POSTGRES_TIMEOUT_MS,
    query_timeout: POSTGRES_TIMEOUT_MS,
    statement_timeout: POSTGRES_TIMEOUT_MS,
    idleTimeoutMillis: POSTGRES_TIMEOUT_MS,
  };
  const pool = new Pool(config);
  return {
    query: async (statement, parameters) => (await pool.query(statement, [...parameters])).rows,
    close: async () => pool.end(),
  };
}
