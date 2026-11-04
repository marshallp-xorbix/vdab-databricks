const LAKEBASE_ENDPOINT_ENVIRONMENT_VARIABLE = "LAKEBASE_ENDPOINT";
const SQL_WAREHOUSE_ENVIRONMENT_VARIABLE = "DATABRICKS_SQL_WAREHOUSE_ID";
const APP_RESOURCE_KEY_PATTERN = /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/;

/** Adds the optional installed-workspace SQL warehouse resource reference. */
export function addDefaultSqlWarehouseResourceBinding(
  appManifest: string,
  resourceKey: string | undefined,
): string {
  if (resourceKey === undefined) return appManifest;
  if (!APP_RESOURCE_KEY_PATTERN.test(resourceKey)) {
    throw new Error("Default SQL warehouse resource key is invalid.");
  }

  const lines = appManifest.split(/\r?\n/);
  if (
    lines.some((line) =>
      line.includes(`name: ${SQL_WAREHOUSE_ENVIRONMENT_VARIABLE}`),
    )
  ) {
    throw new Error(
      "The app manifest already defines the default SQL warehouse variable.",
    );
  }

  const lakebaseLine = lines.findIndex(
    (line) => line === `  - name: ${LAKEBASE_ENDPOINT_ENVIRONMENT_VARIABLE}`,
  );
  if (
    lakebaseLine < 0 ||
    lines[lakebaseLine + 1] !== "    valueFrom: postgres"
  ) {
    throw new Error(
      "The app manifest does not contain the expected Lakebase resource binding.",
    );
  }

  lines.splice(
    lakebaseLine + 2,
    0,
    `  - name: ${SQL_WAREHOUSE_ENVIRONMENT_VARIABLE}`,
    `    valueFrom: ${resourceKey}`,
  );
  return lines.join(appManifest.includes("\r\n") ? "\r\n" : "\n");
}
