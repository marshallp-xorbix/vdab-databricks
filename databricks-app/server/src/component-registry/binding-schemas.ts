import type { BindingSchema } from "./contracts.ts";

/** Current-workspace selector schemas retained from the legacy registry. */
export const BINDING_SCHEMAS: BindingSchema[] = [
  {
    type: "unityCatalogTable",
    label: "Unity Catalog Table",
    editorType: "UnityCatalogTableSelector",
    defaultConfig: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          catalog: null,
          schema: null,
          table: null,
          primaryKeyColumn: null,
        },
      },
    },
  },
  {
    type: "databricksVolume",
    label: "Databricks Volume",
    editorType: "DatabricksVolumeSelector",
    defaultConfig: {
      bindingType: "databricksVolume",
      source: {
        kind: "resource",
        valueType: "file",
        resource: {
          type: "databricksVolume",
          catalog: null,
          schema: null,
          volume: null,
          filePath: "",
        },
      },
    },
  },
  {
    type: "lakebaseProvisionedDatabase",
    label: "Lakebase Provisioned Database",
    editorType: "LakebaseProvisionedDatabaseSelector",
    defaultConfig: {
      bindingType: "lakebaseProvisionedDatabase",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "lakebaseProvisionedDatabase",
          database: null,
          instanceName: null,
          catalog: null,
          schema: null,
          table: null,
          primaryKeyColumn: null,
        },
      },
    },
  },
  {
    type: "lakebaseAutoscaling",
    label: "Lakebase Autoscaling",
    editorType: "LakebaseAutoscalingTableSelector",
    defaultConfig: {
      bindingType: "lakebaseAutoscaling",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "lakebaseAutoscaling",
          projectId: null,
          branchId: null,
          endpointId: null,
          database: null,
          catalog: null,
          schema: null,
          table: null,
          primaryKeyColumn: null,
        },
      },
    },
  },
];
