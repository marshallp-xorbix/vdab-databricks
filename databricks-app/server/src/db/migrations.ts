import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { SqlClient, SqlPool } from "./sql.ts";

const MIGRATION_LOCK_ID = 7_221_026_016;
const MIGRATION_DIRECTORY = resolve(import.meta.dirname, "migrations");
/** Ordered append-only schema files used by startup and packaged smoke. */
export const LAKEBASE_MIGRATION_FILES = [
  "001_initial_schema.sql",
  "002_component_aggregate.sql",
  "003_component_nullable_properties.sql",
  "004_workflow_aggregate.sql",
  "005_project_portability.sql",
  "006_project_deployments.sql",
  "007_deployment_app_resources.sql",
  "008_project_deployment_settings.sql",
] as const;
const MIGRATION_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

/** Applies the append-only schema set transactionally under a database lock. */
export async function runLakebaseMigrations(
  pool: SqlPool,
  sleep: (delayMs: number) => Promise<void> = delay,
): Promise<void> {
  const migrations = await Promise.all(
    LAKEBASE_MIGRATION_FILES.map(async (fileName) => ({
      id: fileName.replace(".sql", ""),
      sql: await readFile(resolve(MIGRATION_DIRECTORY, fileName), "utf8"),
    })),
  );

  for (const migration of migrations) {
    await withConnectionRetry(
      () => applyMigration(pool, migration.id, migration.sql),
      sleep,
    );
  }
}

async function applyMigration(
  pool: SqlPool,
  migrationId: string,
  sql: string,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS vdab_schema_migrations (
        migration_id text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
    );

    const existingMigration = await client.query<MigrationRow>(
      "SELECT migration_id, checksum FROM vdab_schema_migrations WHERE migration_id = $1",
      [migrationId],
    );

    if (existingMigration.rows.length > 0) {
      if (existingMigration.rows[0]?.checksum !== checksum(sql)) {
        throw new Error(
          `Applied Lakebase migration ${migrationId} was modified.`,
        );
      }

      await client.query("COMMIT");
      return;
    }

    await client.query(sql);
    await client.query(
      "INSERT INTO vdab_schema_migrations (migration_id, checksum) VALUES ($1, $2)",
      [migrationId, checksum(sql)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function withConnectionRetry(
  operation: () => Promise<void>,
  sleep: (delayMs: number) => Promise<void>,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      const delayMs = MIGRATION_RETRY_DELAYS_MS[attempt];

      if (delayMs === undefined) {
        throw error;
      }

      if (!isTransientDatabaseError(error)) {
        throw error;
      }

      await sleep(delayMs);
    }
  }
}

async function rollback(client: SqlClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the migration error if the connection is already unavailable.
  }
}

function checksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isTransientDatabaseError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const code = error.code;

  return (
    typeof code === "string" &&
    (/^08/.test(code) ||
      ["57P01", "57P03", "53300", "ECONNRESET", "ETIMEDOUT"].includes(code))
  );
}

function delay(delayMs: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
}

interface MigrationRow extends Record<string, unknown> {
  migration_id: string;
  checksum: string;
}
