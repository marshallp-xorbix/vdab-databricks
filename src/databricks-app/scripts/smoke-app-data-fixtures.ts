/** Builds a deterministic fixture for the packaged standalone app smoke. */
export function createSmokeDataFixtures(): { components: unknown[]; chartBindings: unknown } {
  const fileUploadDefinition = {
    key: "smoke-file-upload",
    type: "FileUpload",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeFileUpload",
    description: null,
    properties: { label: "Upload smoke files" },
    bindings: {
      databricksVolume: {
        bindingType: "databricksVolume",
        source: {
          kind: "resource",
          valueType: "file",
          resource: {
            type: "databricksVolume",
            catalog: "main",
            schema: "default",
            volume: "uploads",
            filePath: "smoke/imports",
          },
        },
      },
    },
    children: [],
    layout: null,
  };
  const dataWindowDefinition = {
    key: "smoke-data-window",
    type: "DataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeDataWindow",
    description: null,
    properties: {
      label: "Smoke customers",
      maxRows: 25,
      scrollable: true,
      placeholder: null,
      width: "stretch",
      hideIndex: null,
      height: "auto",
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
            table: "customers",
            dataSourceFormat: "DELTA",
            columns: [
              { name: "customer_id", type: "BIGINT" },
              { name: "customer_name", type: "STRING" },
            ],
          },
        },
      },
    },
    children: [],
    layout: null,
  };
  const editableDataWindowDefinition = {
    key: "smoke-editable-data-window",
    type: "EditableDataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeEditableDataWindow",
    description: null,
    properties: {
      label: "Smoke editable customers",
      maxRows: 25,
      scrollable: true,
      placeholder: null,
      disabled: false,
      numRows: "dynamic",
      hideIndex: true,
      width: "stretch",
      height: "auto",
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
            table: "customers",
            dataSourceFormat: "DELTA",
            primaryKeyColumn: "customer_id",
            columns: [
              { name: "customer_id", type: "BIGINT", dataType: "LONG" },
              { name: "customer_name", type: "STRING", dataType: "STRING" },
            ],
          },
        },
      },
    },
    children: [],
    layout: null,
  };
  const barChartDefinition = {
    key: "smoke-bar-chart",
    type: "BarChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeBarChart",
    description: null,
    properties: {
      title: "Smoke orders by region",
      seriesColor: "#1f77b4",
      xAxis: {
        field: "customer_name",
        displayName: "Customer",
        scaleType: "categorical",
        transform: "none",
      },
      yAxis: {
        field: "",
        displayName: "Order count",
        scaleType: "continuous",
        transform: "count",
      },
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
            table: "customers",
            dataSourceFormat: "DELTA",
            primaryKeyColumn: null,
            columns: [
              { name: "customer_id", type: "BIGINT", dataType: "LONG" },
              { name: "customer_name", type: "STRING", dataType: "STRING" },
            ],
          },
        },
      },
    },
    children: [],
    layout: null,
  };
  const lineChartDefinition = {
    key: "smoke-line-chart",
    type: "LineChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeLineChart",
    description: null,
    properties: {
      title: "Smoke customer values",
      seriesColor: "#1f77b4",
      xAxis: {
        field: "customer_id",
        displayName: "Customer ID",
        scaleType: "continuous",
        transform: "none",
      },
      yAxis: {
        field: "customer_id",
        displayName: "Customer ID",
        scaleType: "continuous",
        transform: "none",
      },
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const pieChartDefinition = {
    key: "smoke-pie-chart",
    type: "PieChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokePieChart",
    description: null,
    properties: {
      title: "Smoke customers by value",
      seriesColor: "#1f77b4",
      category: {
        field: "customer_name",
        displayName: "Customer",
        scaleType: "categorical",
        transform: "none",
      },
      value: {
        field: "customer_id",
        displayName: "Customer ID",
        scaleType: "continuous",
        transform: "sum",
      },
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const donutChartDefinition = {
    key: "smoke-donut-chart",
    type: "DonutChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "smokeDonutChart",
    description: null,
    properties: {
      title: "Smoke customers by value",
      seriesColor: "#1f77b4",
      category: {
        field: "customer_name",
        displayName: "Customer",
        scaleType: "categorical",
        transform: "none",
      },
      value: {
        field: "customer_id",
        displayName: "Customer ID",
        scaleType: "continuous",
        transform: "sum",
      },
    },
    bindings: barChartDefinition.bindings,
    children: [],
    layout: null,
  };
  const components = [
    fileUploadDefinition,
    dataWindowDefinition,
    editableDataWindowDefinition,
    barChartDefinition,
    lineChartDefinition,
    pieChartDefinition,
    donutChartDefinition,
  ];
  return { components, chartBindings: barChartDefinition.bindings };
}
