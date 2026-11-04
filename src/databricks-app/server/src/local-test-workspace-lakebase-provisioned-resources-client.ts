import type {
  CallerIdentity,
  WorkspaceLakebaseProvisionedInstanceResource,
  WorkspaceLakebaseTableResource,
} from "./contracts.ts";
import type { WorkspaceLakebaseProvisionedResourcesClient } from "./workspace-lakebase-provisioned-resources-client.ts";

const SAMPLE_INSTANCE = "sample-provisioned-instance";
const SAMPLE_DATABASE = "databricks_postgres";
const SAMPLE_SCHEMA = "public";

/** Returns deterministic Provisioned Lakebase resources without contacting a workspace. */
export class LocalTestWorkspaceLakebaseProvisionedResourcesClient
  implements WorkspaceLakebaseProvisionedResourcesClient
{
  async listInstances(_caller: CallerIdentity): Promise<WorkspaceLakebaseProvisionedInstanceResource[]> {
    return [{ instanceName: SAMPLE_INSTANCE, state: "AVAILABLE" }];
  }

  async listSchemas(
    _caller: CallerIdentity,
    instanceName: string,
    databaseName: string,
  ): Promise<string[]> {
    return isSampleDatabase(instanceName, databaseName) ? [SAMPLE_SCHEMA] : [];
  }

  async listTables(
    _caller: CallerIdentity,
    instanceName: string,
    databaseName: string,
    schemaName: string,
  ): Promise<WorkspaceLakebaseTableResource[]> {
    return isSampleDatabase(instanceName, databaseName) && schemaName === SAMPLE_SCHEMA
      ? [{
          name: "sample_records",
          tableType: "BASE TABLE",
          columns: [
            { name: "record_id", type: "integer", nullable: false },
            { name: "record_name", type: "text", nullable: false },
          ],
        }]
      : [];
  }
}

function isSampleDatabase(instanceName: string, databaseName: string): boolean {
  return instanceName === SAMPLE_INSTANCE && databaseName === SAMPLE_DATABASE;
}
