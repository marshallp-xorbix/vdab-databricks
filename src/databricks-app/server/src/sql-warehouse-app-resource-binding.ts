import type { WorkspaceSqlWarehouseAppResource } from "./contracts.ts";

/**
 * Child-App env var for Unity Catalog SQL (matches SaaS StreamlitTemplateService).
 * The installed builder App may still use DATABRICKS_SQL_WAREHOUSE_ID for its own grant.
 */
export const DEFAULT_SQL_WAREHOUSE_ENVIRONMENT_VARIABLE =
  "DATABRICKS_WAREHOUSE_ID";

/** SaaS DefaultResourceKey for Databricks Apps SQL warehouse resources. */
export const DEFAULT_SQL_WAREHOUSE_RESOURCE_KEY = "sql-warehouse";

const SQL_WAREHOUSE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface SqlWarehouseAppResourceBinding {
  resource: WorkspaceSqlWarehouseAppResource;
  environmentVariable: string;
}

/** Creates the SaaS-aligned child-App SQL warehouse binding for one warehouse id. */
export function createSqlWarehouseAppResourceBinding(
  warehouseId: string,
): SqlWarehouseAppResourceBinding {
  if (!SQL_WAREHOUSE_ID_PATTERN.test(warehouseId)) {
    throw new Error("SQL warehouse resource identifier is invalid.");
  }

  return {
    resource: {
      name: DEFAULT_SQL_WAREHOUSE_RESOURCE_KEY,
      description: "SQL warehouse",
      sql_warehouse: { id: warehouseId, permission: "CAN_USE" },
    },
    environmentVariable: DEFAULT_SQL_WAREHOUSE_ENVIRONMENT_VARIABLE,
  };
}

/** Checks a trusted installation-provided SQL warehouse identifier. */
export function isValidSqlWarehouseId(value: string): boolean {
  return SQL_WAREHOUSE_ID_PATTERN.test(value);
}
