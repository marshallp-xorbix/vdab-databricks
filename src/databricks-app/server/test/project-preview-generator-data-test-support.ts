import type { ProjectComponent } from "../src/db/project-components-contract.ts";

export function createFileUpload(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "customer-files",
    type: "FileUpload",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "customerFiles",
    description: null,
    properties: { label: "Upload documents" },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createDataWindow(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "datawindow-main",
    type: "DataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "dataWindow1",
    description: null,
    properties: {
      label: "Customer table",
      maxRows: 100,
      scrollable: true,
      placeholder: "(missing)",
      width: 800,
      hideIndex: true,
      height: "content",
    },
    bindings: {
      unityCatalogTable: {
        bindingType: "unityCatalogTable",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "unityCatalogTable",
            catalog: "main",
            schema: "default",
            table: "sales`2026",
            primaryKeyColumn: null,
            columns: [
              { name: "customer name", type: "STRING" },
              { name: "revenue", type: "DECIMAL" },
            ],
          },
        },
      },
    },
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createEditableDataWindow(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "editable-data-window-main",
    type: "EditableDataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "editableDataWindow1",
    description: null,
    properties: {
      label: "Editable customers",
      maxRows: 50,
      scrollable: true,
      placeholder: "No customers",
      disabled: false,
      numRows: "dynamic",
      hideIndex: true,
      width: "stretch",
      height: "content",
    },
    bindings: createEditableDataWindowBinding("customer_id"),
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createEditableDataWindowBinding(
  primaryKeyColumn: string | null,
  columns: Array<{ name: string; type: string | null; dataType: string | null }> = [
    { name: "customer_id", type: "BIGINT", dataType: "LONG" },
    { name: "customer name", type: "STRING", dataType: "STRING" },
    { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  ],
  complete = true,
  dataSourceFormat: string | null = "DELTA",
): ProjectComponent["bindings"] {
  return {
    unityCatalogTable: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          catalog: "main",
          schema: complete ? "default" : null,
          table: complete ? "customers" : null,
          dataSourceFormat,
          primaryKeyColumn,
          columns,
        },
      },
    },
  };
}

export function createProvisionedLakebaseBinding(
  primaryKeyColumn: string | null = null,
): ProjectComponent["bindings"] {
  return {
    lakebaseProvisionedDatabase: {
      bindingType: "lakebaseProvisionedDatabase",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "lakebaseProvisionedDatabase",
          instanceName: "legacy-provisioned",
          database: "appdb",
          schema: "public",
          table: "customers",
          primaryKeyColumn,
          columns: [
            { name: "id", type: "bigint", dataType: "BIGINT" },
            { name: "display_name", type: "text", dataType: "TEXT" },
          ],
        },
      },
    },
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
