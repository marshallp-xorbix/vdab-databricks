import type { IWorkspaceTable } from "../models/WorkspaceTable";
import type { ProjectJsonObject } from "../models/ProjectComponents";

export interface IUnityCatalogTableBinding {
  catalog: string | null;
  schema: string | null;
  table: string | null;
  dataSourceFormat: string | null;
  primaryKeyColumn: string | null;
  columns: Array<{ name: string; type: string | null; dataType: string | null }>;
}

export type ProjectTableBindingKind =
  | "unityCatalogTable"
  | "lakebaseAutoscaling"
  | "lakebaseProvisionedDatabase";

export interface IProjectTableBinding extends IUnityCatalogTableBinding {
  kind: ProjectTableBindingKind;
  database: string | null;
  instanceName: string | null;
  projectId: string | null;
  branchId: string | null;
  endpointId: string | null;
  databaseId: string | null;
}

/** Reads a Unity Catalog binding while leaving other saved binding types untouched. */
export function readUnityCatalogTableBinding(
  bindings: ProjectJsonObject | null,
): IUnityCatalogTableBinding | null {
  const bindingValue = bindings?.unityCatalogTable;
  if (!isRecord(bindingValue) || !isRecord(bindingValue.source)) {
    return null;
  }

  const resource = bindingValue.source.resource;
  if (!isRecord(resource)) {
    return null;
  }

  return {
    catalog: readNullableString(resource.catalog),
    schema: readNullableString(resource.schema),
    table: readNullableString(resource.table),
    dataSourceFormat: readNullableString(resource.dataSourceFormat),
    primaryKeyColumn: readNullableString(resource.primaryKeyColumn),
    columns: readColumns(resource.columns),
  };
}

/** Reads the selected UC or Lakebase table as a shared editor column model. */
export function readProjectTableBinding(
  bindings: ProjectJsonObject | null,
): IProjectTableBinding | null {
  if (bindings === null || Object.keys(bindings).length !== 1) return null;
  const [kind] = Object.keys(bindings) as ProjectTableBindingKind[];
  if (kind === "unityCatalogTable") {
    const selection = readUnityCatalogTableBinding(bindings);
    return selection ? {
      ...selection,
      kind,
      database: null,
      instanceName: null,
      projectId: null,
      branchId: null,
      endpointId: null,
      databaseId: null,
    } : null;
  }
  if (kind !== "lakebaseProvisionedDatabase" && kind !== "lakebaseAutoscaling") return null;
  const value = bindings[kind];
  if (!isRecord(value) || value.bindingType !== kind || !isRecord(value.source) ||
      !isRecord(value.source.resource) || value.source.kind !== "resource" || value.source.valueType !== "table") {
    return null;
  }
  const resource = value.source.resource;
  if (resource.type !== kind) return null;
  const database = readNullableString(resource.database);
  return {
    kind,
    catalog: database,
    schema: readNullableString(resource.schema),
    table: readNullableString(resource.table),
    dataSourceFormat: null,
    primaryKeyColumn: readNullableString(resource.primaryKeyColumn),
    columns: readColumns(resource.columns),
    database,
    instanceName: kind === "lakebaseProvisionedDatabase" ? readNullableString(resource.instanceName) : null,
    projectId: kind === "lakebaseAutoscaling" ? readNullableString(resource.projectId) : null,
    branchId: kind === "lakebaseAutoscaling" ? readNullableString(resource.branchId) : null,
    endpointId: kind === "lakebaseAutoscaling" ? readNullableString(resource.endpointId) : null,
    databaseId: kind === "lakebaseAutoscaling" ? readNullableString(resource.databaseId) : null,
  };
}

/** Returns whether a saved table binding is from a non-UC resource family. */
export function hasUnsupportedDataWindowBinding(
  bindings: ProjectJsonObject | null,
): boolean {
  return (
    bindings !== null &&
    Object.keys(bindings).some((key) =>
      key !== "unityCatalogTable" && key !== "lakebaseAutoscaling" && key !== "lakebaseProvisionedDatabase",
    )
  );
}

/** Creates the portable table binding shape from a selected current-workspace table. */
export function createUnityCatalogTableBinding(
  selection: IUnityCatalogTableBinding,
): ProjectJsonObject {
  return {
    unityCatalogTable: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          catalog: selection.catalog,
          schema: selection.schema,
          table: selection.table,
          dataSourceFormat: selection.dataSourceFormat,
          primaryKeyColumn: selection.primaryKeyColumn,
          columns: selection.columns.map((column) => ({
            name: column.name,
            type: column.type,
            dataType: column.dataType,
          })),
        },
      },
    },
  };
}

/** Creates the portable binding for one discovered Lakebase Autoscaling table. */
export function createLakebaseAutoscalingTableBinding(
  selection: IProjectTableBinding,
): ProjectJsonObject {
  return createLakebaseTableBinding("lakebaseAutoscaling", selection, {
    database: selection.database,
    projectId: selection.projectId,
    branchId: selection.branchId,
    endpointId: selection.endpointId,
    databaseId: selection.databaseId,
  });
}

/** Creates the portable binding for one discovered Provisioned Lakebase table. */
export function createLakebaseProvisionedTableBinding(
  selection: IProjectTableBinding,
): ProjectJsonObject {
  return createLakebaseTableBinding("lakebaseProvisionedDatabase", selection, {
    database: selection.database,
    instanceName: selection.instanceName,
  });
}

/** Converts a discovered workspace table into the project's binding contract. */
export function createUnityCatalogTableSelection(
  catalog: string,
  schema: string | null,
  table: IWorkspaceTable | null,
): IUnityCatalogTableBinding {
  return {
    catalog,
    schema,
    table: table?.name ?? null,
    dataSourceFormat: table?.dataSourceFormat ?? null,
    primaryKeyColumn: null,
    columns: (table?.columns ?? []).map((column) => ({
      name: column.name,
      type: column.type,
      dataType: column.dataType ?? null,
    })),
  };
}

function readColumns(value: unknown): Array<{ name: string; type: string | null; dataType: string | null }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((column) => {
    if (!isRecord(column) || typeof column.name !== "string") {
      return [];
    }

    return [{
      name: column.name,
      type: typeof column.type === "string" ? column.type : null,
      dataType: typeof column.dataType === "string" ? column.dataType : null,
    }];
  });
}

function createLakebaseTableBinding(
  kind: "lakebaseAutoscaling" | "lakebaseProvisionedDatabase",
  selection: IProjectTableBinding,
  resourceFields: Record<string, string | null>,
): ProjectJsonObject {
  return {
    [kind]: {
      bindingType: kind,
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: kind,
          catalog: null,
          schema: selection.schema,
          table: selection.table,
          dataSourceFormat: null,
          primaryKeyColumn: selection.primaryKeyColumn,
          columns: selection.columns.map((column) => ({ ...column })),
          ...resourceFields,
        },
      },
    },
  };
}

function readNullableString(value: unknown): string | null {
  return value === null || typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
