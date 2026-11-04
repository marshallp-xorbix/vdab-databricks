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
  id: "project-line-chart",
  name: "Sales over time",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

const tableBinding = createBinding([
  { name: "region", type: "STRING", dataType: "STRING" },
  { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  { name: "sold_at", type: "TIMESTAMP", dataType: "TIMESTAMP" },
]);

test("LineChartPreview_MatchesAcceptedPythonFixture", async () => {
  const fixturePath = new URL(
    "./fixtures/contracts/generated/line-chart-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = new ProjectPreviewGenerator().generate(project, createDocument());

  assert.deepEqual(preview.files.find((file) => file.path === "app.py"), { path: "app.py", content: expectedPython });
  assert.equal(preview.previewOnly, true);
});

test("LineChartPreview_UsesOrderedRawPointsWithoutAggregation", () => {
  const python = generate(createLineChart());

  assert.match(python, /SELECT `sold_at` AS x, `revenue` AS y FROM `main`\.`sales`\.`orders` ORDER BY x/);
  assert.doesNotMatch(python, /GROUP BY/);
  assert.match(python, /'type': 'line', 'point': True, 'color': '#1f77b4'/);
  assert.match(python, /'field': 'x', 'type': 'temporal', 'title': 'sold_at'/);
  assert.match(python, /'field': 'y', 'type': 'quantitative', 'title': 'revenue'/);
  assert.match(python, /_vdab_sql_query_df\('main', 'sales', 'orders', 10000/);
});

test("LineChartPreview_GroupsConfiguredAggregateByXAxis", () => {
  const python = generate(createLineChart({
    properties: {
      title: "Average revenue",
      seriesColor: "#2f77cc",
      xAxis: { field: "sold_at", displayName: "Sale date", scaleType: "continuous", transform: "none" },
      yAxis: { field: "revenue", displayName: "Average revenue", scaleType: "continuous", transform: "avg" },
    },
  }));

  assert.match(python, /SELECT `sold_at` AS x, AVG\(`revenue`\) AS y/);
  assert.match(python, /GROUP BY `sold_at` ORDER BY x/);
  assert.match(python, /'color': '#2f77cc'/);
});

test("LineChartPreview_QueriesLakebaseWithTheInstalledWorkspaceEndpoint", () => {
  const incompletePython = generate(createLineChart({ bindings: null }));
  const lakebasePython = generate(createLineChart({
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
  }));

  assert.match(incompletePython, /Bind a Unity Catalog table and choose X and Y columns/);
  assert.match(lakebasePython, /SELECT "sold_at" AS x, "revenue" AS y/);
  assert.match(lakebasePython, /source_kind='lakebaseAutoscaling', database='appdb'.*resource_environment_variable='VDAB_LAKEBASE_ENDPOINT_[A-F0-9]{16}'/);
  assert.match(lakebasePython, /endpoint='projects\/project\/branches\/branch\/endpoints\/endpoint'/);
});

test("LineChartInput_RejectsUnsupportedAxesTypesAndAuthorityFields", () => {
  const invalidComponents = [
    createLineChart({ properties: { xAxis: { field: "sold_at", scaleType: "continuous", transform: "yearly" } } }),
    createLineChart({ properties: { yAxis: { field: "region", scaleType: "continuous", transform: "none" } } }),
    createLineChart({ properties: { yAxis: { field: "revenue", scaleType: "continuous", transform: "median" } } }),
    createLineChart({ bindings: { ...tableBinding, workspaceHost: "https://outside.invalid" } }),
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
  const input = readComponentsInput({ version: 1, components: [createLineChart()] });
  return { projectId: project.id, version: input.expectedVersion, components: input.components };
}

function createLineChart(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "line-chart-main",
    type: "LineChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "lineChart1",
    description: null,
    properties: {
      title: "Sales over time",
      seriesColor: "#1f77b4",
      xAxis: { field: "sold_at", displayName: "", scaleType: "continuous", transform: "none" },
      yAxis: { field: "revenue", displayName: "", scaleType: "continuous", transform: "none" },
    },
    bindings: tableBinding,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createBinding(columns: Array<{ name: string; type: string; dataType: string }>): ProjectComponent["bindings"] {
  return {
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
          columns,
        },
      },
    },
  };
}
