import type { CallerIdentity, WorkspaceLakebaseDatabaseResource, WorkspaceLakebaseTableResource } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import type {
  LakebasePostgresConnection,
  LakebasePostgresConnectionFactory,
} from "./workspace-lakebase-postgres-connection.ts";
import {
  POSTGRES_API_PATH,
  branchPath,
  encodeResourceId,
  endpointResourceName,
  fetchLakebaseJson,
  fetchWorkspaceApi,
  listApiRecords,
  readLakebaseJson,
  requireCallerToken,
} from "./workspace-lakebase-api-client.ts";
import {
  groupTableRows,
  isRecord,
  invalidLakebaseResponse,
  metadataUnavailable,
  readDatabase,
  readLakebaseHost,
  readSchemaRow,
  requireRecord,
  resourceListTooLarge,
} from "./workspace-lakebase-resource-readers.ts";

const MAX_METADATA_ROWS = 5_000;
const OAUTH_TOKEN_TTL = "300s";
const LIST_SCHEMAS_SQL = `
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
  AND schema_name NOT LIKE 'pg_toast%'
ORDER BY schema_name
LIMIT $1`;
const LIST_TABLES_SQL = `
SELECT tables.table_name, tables.table_type, columns.column_name,
       columns.data_type, columns.is_nullable, columns.ordinal_position
FROM information_schema.tables AS tables
JOIN information_schema.columns AS columns
  ON columns.table_catalog = tables.table_catalog
 AND columns.table_schema = tables.table_schema
 AND columns.table_name = tables.table_name
WHERE tables.table_schema = $1
  AND tables.table_type IN ('BASE TABLE', 'VIEW')
ORDER BY tables.table_name, columns.ordinal_position
LIMIT $2`;

export async function listLakebaseSchemas(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  endpointId: string,
  databaseName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  connectionFactory: LakebasePostgresConnectionFactory,
): Promise<string[]> {
  const connection = await createUserConnection(
    caller,
    projectId,
    branchId,
    endpointId,
    databaseName,
    workspaceHost,
    fetchImplementation,
    connectionFactory,
  );

  try {
    const rows = await connection.query(LIST_SCHEMAS_SQL, [MAX_METADATA_ROWS + 1]);
    if (rows.length > MAX_METADATA_ROWS) {
      throw resourceListTooLarge();
    }
    const schemas = rows.map(readSchemaRow);
    return schemas.sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw metadataUnavailable();
  } finally {
    await connection.close();
  }
}
export async function listLakebaseTables(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  endpointId: string,
  databaseName: string,
  schemaName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  connectionFactory: LakebasePostgresConnectionFactory,
): Promise<WorkspaceLakebaseTableResource[]> {
  const connection = await createUserConnection(
    caller,
    projectId,
    branchId,
    endpointId,
    databaseName,
    workspaceHost,
    fetchImplementation,
    connectionFactory,
  );

  try {
    const rows = await connection.query(LIST_TABLES_SQL, [schemaName, MAX_METADATA_ROWS + 1]);
    if (rows.length > MAX_METADATA_ROWS) {
      throw resourceListTooLarge();
    }
    return groupTableRows(rows);
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw metadataUnavailable();
  } finally {
    await connection.close();
  }
}
async function createUserConnection(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  endpointId: string,
  databaseName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  connectionFactory: LakebasePostgresConnectionFactory,
): Promise<LakebasePostgresConnection> {
  requireCallerToken(caller);
  const userName = caller.email?.trim();
  if (!userName) {
    throw new ApplicationError(
      403,
      "lakebase_user_identity_unavailable",
      "Lakebase user identity is unavailable",
      "The signed-in Databricks session must include an email identity that has a Lakebase PostgreSQL role.",
    );
  }

  const resourceName = endpointResourceName(projectId, branchId, endpointId);
  const endpoint = await fetchLakebaseJson(
    new URL(`${POSTGRES_API_PATH}/${resourceName}`, workspaceHost),
    caller,
    fetchImplementation,
  );
  const endpointRecord = requireRecord(endpoint, "endpoint");
  const status = requireRecord(endpointRecord.status, "endpoint status");
  const hosts = requireRecord(status.hosts, "endpoint hosts");
  const host = readLakebaseHost(hosts.host);
  const database = await findDatabase(
    caller,
    projectId,
    branchId,
    databaseName,
    workspaceHost,
    fetchImplementation,
  );
  const credentialResponse = await postCredential(
    caller,
    resourceName,
    workspaceHost,
    fetchImplementation,
  );

  return connectionFactory({
    host,
    user: userName,
    database: database.databaseName,
    password: credentialResponse.token,
  });
}
async function findDatabase(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  databaseName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceLakebaseDatabaseResource> {
  const databasePath = `${branchPath(projectId, branchId)}/databases`;
  const databaseRecords = await listApiRecords(
    caller,
    databasePath,
    "databases",
    workspaceHost,
    fetchImplementation,
  );
  const databases = databaseRecords.map(readDatabase);
  const database = databases.find((item) => item.databaseName === databaseName);
  if (!database) {
    throw new ApplicationError(
      404,
      "lakebase_database_not_found",
      "Lakebase database not found",
      "Select a database that is visible to your Databricks account.",
    );
  }
  return database;
}
async function postCredential(
  caller: CallerIdentity,
  endpointName: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<{ token: string }> {
  const endpoint = new URL(`${POSTGRES_API_PATH}/credentials`, workspaceHost);
  const response = await fetchWorkspaceApi(endpoint, caller, fetchImplementation, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: endpointName, ttl: OAUTH_TOKEN_TTL }),
  });
  const body = await readLakebaseJson(response);
  if (!isRecord(body) || typeof body.token !== "string" || body.token.length < 20 || body.token.length > 16_384) {
    throw invalidLakebaseResponse();
  }
  return { token: body.token };
}
