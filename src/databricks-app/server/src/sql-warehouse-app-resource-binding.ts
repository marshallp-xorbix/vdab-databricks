import { createHash } from "node:crypto";
import type { WorkspaceSqlWarehouseAppResource } from "./contracts.ts";

export const DEFAULT_SQL_WAREHOUSE_ENVIRONMENT_VARIABLE =
  "DATABRICKS_SQL_WAREHOUSE_ID";

const SQL_WAREHOUSE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface SqlWarehouseAppResourceBinding {
  resource: WorkspaceSqlWarehouseAppResource;
  environmentVariable: string;
}

/** Creates a stable child-App binding for the installation's SQL warehouse. */
export function createSqlWarehouseAppResourceBinding(
  warehouseId: string,
): SqlWarehouseAppResourceBinding {
  if (!SQL_WAREHOUSE_ID_PATTERN.test(warehouseId)) {
    throw new Error("SQL warehouse resource identifier is invalid.");
  }

  const suffix = createHash("sha256")
    .update(`sql-warehouse\u0000${warehouseId}`)
    .digest("hex")
    .slice(0, 16);
  return {
    resource: {
      name: `vdab-wh-${suffix}`,
      description: "VDAB default SQL warehouse",
      sql_warehouse: { id: warehouseId, permission: "CAN_USE" },
    },
    environmentVariable: DEFAULT_SQL_WAREHOUSE_ENVIRONMENT_VARIABLE,
  };
}

/** Checks a trusted installation-provided SQL warehouse identifier. */
export function isValidSqlWarehouseId(value: string): boolean {
  return SQL_WAREHOUSE_ID_PATTERN.test(value);
}
