import type { LakebaseDatabaseCatalog } from "../../providers/DatabricksDataConnectorApi";

export const resolveLakebaseDatabaseName = (
  catalogs: LakebaseDatabaseCatalog[],
  instanceName?: string
): string | undefined => {
  if (!catalogs || catalogs.length === 0) {
    return undefined;
  }

  const withDatabaseName = catalogs.filter((catalog) => !!catalog.databaseName);
  if (withDatabaseName.length === 0) {
    return undefined;
  }

  if (instanceName) {
    const instanceMatch = withDatabaseName.find(
      (catalog) => catalog.databaseInstanceName === instanceName
    );
    if (instanceMatch?.databaseName) {
      return instanceMatch.databaseName;
    }
  }

  return withDatabaseName[0].databaseName;
};
