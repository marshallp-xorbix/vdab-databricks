import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
} from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";

const project: ProjectSummary = {
  id: "project-bar-chart",
  name: "Sales overview",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

const tableBinding = {
  unityCatalogTable: {
    bindingType: "unityCatalogTable",
    source: {
      kind: "resource",
      valueType: "table",
      resource: {
        type: "unityCatalogTable",
        catalog: "main",
        schema: "sales",
        table: "orders",
        dataSourceFormat: "DELTA",
        primaryKeyColumn: null,
        columns: [
          { name: "region", type: "STRING", dataType: "STRING" },
          { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
          { name: "sold_at", type: "TIMESTAMP", dataType: "TIMESTAMP" },
        ],
      },
    },
  },
};

test("BarChartPreview_MatchesAcceptedPythonFixture", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/bar-chart-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = new ProjectPreviewGenerator().generate(project, createDocument());

  assert.deepEqual(preview.files.find((file) => file.path === "app.py"), { path: "app.py", content: expectedPython });
  assert.equal(preview.previewOnly, true);
});

test("BarChartPreview_QuotesIdentifiersAndUsesAllowlistedAggregateSql", () => {
  const component = createBarChart({
    properties: {
      title: "Quarterly revenue",
      seriesColor: "#2f77cc",
      xAxis: { field: "sold_at", displayName: "Sale date", scaleType: "categorical", transform: "yearly" },
      yAxis: { field: "revenue", displayName: "Revenue", scaleType: "continuous", transform: "sum" },
    },
    bindings: createBinding({
      catalog: "main`catalog",
      schema: "sales",
      table: "orders`2024",
      columns: [
        { name: "region", type: "STRING", dataType: "STRING" },
        { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
        { name: "sold_at", type: "TIMESTAMP", dataType: "TIMESTAMP" },
      ],
    }),
  });
  const python = generate(component);

  assert.match(python, /DATE_TRUNC\(\\'year\\', `sold_at`\)/);
  assert.match(python, /SUM\(`revenue`\)/);
  assert.match(python, /`main``catalog`\.`sales`\.`orders``2024`/);
  assert.match(python, /st\.vega_lite_chart\(data=vdab_barchart1_data/);
  assert.match(python, /'color': '#2f77cc'/);
});

test("BarChartPreview_UsesCountStarAndExplainsIncompleteBindings", () => {
  const countChart = createBarChart({
    properties: {
      title: "Orders by region",
      xAxis: { field: "region", displayName: "Region", scaleType: "categorical", transform: "none" },
      yAxis: { field: "", displayName: "", scaleType: "continuous", transform: "count" },
    },
  });
  const countPython = generate(countChart);
  const incompletePython = generate(createBarChart({ bindings: null }));

  assert.match(countPython, /COUNT\(\*\) AS value/);
  assert.match(countPython, /'title': 'COUNT\(\*\)'/);
  assert.match(incompletePython, /Bind a Unity Catalog table, choose an X column/);
});

test("BarChartPreview_UsesLegacyDerivedAxisTitlesAndDropsBlankCategories", () => {
  const python = generate(createBarChart({
    properties: {
      title: "Revenue by date",
      seriesColor: "#1f77b4",
      xAxis: { field: "sold_at", displayName: "", scaleType: "categorical", transform: "yearly" },
      yAxis: { field: "revenue", displayName: "", scaleType: "continuous", transform: "sum" },
    },
  }));

  assert.match(python, /'title': 'yearly\(sold_at\)'/);
  assert.match(python, /'title': 'sum\(revenue\)'/);
  assert.match(python, /astype\(str\)\.str\.strip\(\) != ''/);
});

test("BarChartPreview_QueriesLakebaseWithTheInstalledWorkspaceEndpoint", () => {
  const component = createBarChart({
    bindings: {
      lakebaseAutoscaling: {
        bindingType: "lakebaseAutoscaling",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "lakebaseAutoscaling",
            database: "appdb",
            databaseId: "database-id",
            projectId: "project",
            branchId: "branch",
            endpointId: "endpoint",
            catalog: null,
            schema: "public",
            table: "orders",
            dataSourceFormat: null,
            primaryKeyColumn: null,
            columns: [
              { name: "region", type: "STRING", dataType: "STRING" },
              { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
              { name: "sold_at", type: "TIMESTAMP", dataType: "TIMESTAMP" },
            ],
          },
        },
      },
    },
  });
  const python = generate(component);

  assert.match(python, /SELECT "region" AS category, SUM\("revenue"\) AS value/);
  assert.match(python, /source_kind='lakebaseAutoscaling', database='appdb'.*resource_environment_variable='VDAB_LAKEBASE_ENDPOINT_[A-F0-9]{16}'/);
  assert.match(python, /endpoint='projects\/project\/branches\/branch\/endpoints\/endpoint'/);
});

test("BarChartInput_RejectsInvalidAxesColumnTypesAndAuthorityFields", () => {
  const invalidComponents = [
    createBarChart({ properties: { seriesColor: "blue" } }),
    createBarChart({ properties: { xAxis: { field: "region", scaleType: "continuous", transform: "none" } } }),
    createBarChart({ properties: { xAxis: { field: "missing", scaleType: "categorical", transform: "none" } } }),
    createBarChart({ properties: { xAxis: { field: "region", scaleType: "categorical", transform: "yearly" } } }),
    createBarChart({ properties: { yAxis: { field: "region", scaleType: "continuous", transform: "sum" } } }),
    createBarChart({ bindings: { ...tableBinding, workspaceHost: "https://outside.invalid" } }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    );
  }
});

function generate(component: ProjectComponent): string {
  return new ProjectPreviewGenerator().generate(project, {
    projectId: project.id,
    version: 1,
    components: [component],
  }).files[0]?.content ?? "";
}

function createDocument(): ProjectComponentsDocument {
  const input = readComponentsInput({ version: 1, components: [createBarChart()] });
  return { projectId: project.id, version: input.expectedVersion, components: input.components };
}

function createBarChart(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "bar-chart-main",
    type: "BarChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "barChart1",
    description: null,
    properties: {
      title: "Revenue by region",
      seriesColor: "#1f77b4",
      xAxis: { field: "region", displayName: "Region", scaleType: "categorical", transform: "none" },
      yAxis: { field: "revenue", displayName: "Revenue", scaleType: "continuous", transform: "sum" },
    },
    bindings: tableBinding,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createBinding(table: {
  catalog: string;
  schema: string;
  table: string;
  columns: Array<{ name: string; type: string; dataType: string }>;
}): ProjectComponent["bindings"] {
  return {
    unityCatalogTable: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          ...table,
          dataSourceFormat: "DELTA",
          primaryKeyColumn: null,
        },
      },
    },
  };
}
