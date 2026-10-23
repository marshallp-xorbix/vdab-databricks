import { Pool } from "pg";
import type { PoolConfig } from "pg";

const PG_TIMEOUT_MS = 10_000;
const POSTGRES_PORT = 5432;

export interface LakebasePostgresConnection {
  query(statement: string, parameters: readonly (string | number)[]): Promise<unknown[]>;
  close(): Promise<void>;
}

export interface LakebasePostgresConnectionOptions {
  host: string;
  user: string;
  database: string;
  password: string;
}

export type LakebasePostgresConnectionFactory = (
  options: LakebasePostgresConnectionOptions,
) => LakebasePostgresConnection;
export function createPostgresConnection(
  options: LakebasePostgresConnectionOptions,
): LakebasePostgresConnection {
  const poolConfig: PoolConfig = {
    host: options.host,
    port: POSTGRES_PORT,
    user: options.user,
    database: options.database,
    password: options.password,
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: PG_TIMEOUT_MS,
    query_timeout: PG_TIMEOUT_MS,
    statement_timeout: PG_TIMEOUT_MS,
    idleTimeoutMillis: PG_TIMEOUT_MS,
  };
  const pool = new Pool(poolConfig);
  return {
    query: async (statement, parameters) => {
      const result = await pool.query(statement, [...parameters]);
      return result.rows;
    },
    close: async () => pool.end(),
  };
}
