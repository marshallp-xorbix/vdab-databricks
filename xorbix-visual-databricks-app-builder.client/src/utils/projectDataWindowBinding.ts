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

/** Returns whether a saved table binding is from a non-UC resource family. */
export function hasUnsupportedDataWindowBinding(
  bindings: ProjectJsonObject | null,
): boolean {
  return (
    bindings !== null &&
    Object.keys(bindings).some((key) => key !== "unityCatalogTable")
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

function readNullableString(value: unknown): string | null {
  return value === null || typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
