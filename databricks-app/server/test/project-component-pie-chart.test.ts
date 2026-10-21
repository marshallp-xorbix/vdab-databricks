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
  id: "project-pie-chart",
  name: "Revenue by region",
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
  { name: "units", type: "BIGINT", dataType: "BIGINT" },
]);

test("PieChartPreview_MatchesAcceptedPythonFixture", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/pie-chart-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = new ProjectPreviewGenerator().generate(project, createDocument());

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
  assert.equal(preview.previewOnly, true);
});

test("DonutChartPreview_MatchesAcceptedPythonFixtureAndUsesLegacyHole", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/donut-chart-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const preview = new ProjectPreviewGenerator().generate(project, {
    projectId: project.id,
    version: 1,
    components: [createDonutChart()],
  });
  const python = preview.files[0]?.content ?? "";

  assert.deepEqual(preview.files, [{ path: "app.py", content: expectedPython }]);
  assert.match(python, /'type': 'arc', 'outerRadius': 120, 'innerRadius': 54, 'tooltip': True/);
  assert.match(python, /No positive values are available for this donut chart/);
});

test("DonutChartPreview_ReusesViewerQueryAndRadialDataRules", () => {
  const python = generate(createDonutChart({
    properties: {
      title: "Revenue by region",
      seriesColor: "#2f77cc",
      category: { field: "region", displayName: "Market", scaleType: "categorical", transform: "none" },
      value: { field: "revenue", displayName: "Revenue (USD)", scaleType: "continuous", transform: "none" },
    },
  }));

  assert.match(python, /SELECT `region` AS category, `revenue` AS value FROM `main`\.`sales`\.`orders` ORDER BY category/);
  assert.match(python, /dropna\(subset=\['category', 'value'\]\)/);
  assert.match(python, /groupby\('category', as_index=False, sort=False\)\['value'\]\.sum\(\)/);
  assert.match(python, /_vdab_sql_query_df\('main', 'sales', 'orders', 10000/);
  assert.match(python, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
  assert.match(python, /'innerRadius': 54/);
});

test("PieChartPreview_UsesRawRowsThenFiltersGroupsAndSortsSlices", () => {
  const python = generate(createPieChart({
    properties: {
      title: "Revenue by region",
      seriesColor: "#2f77cc",
      category: { field: "region", displayName: "Market", scaleType: "categorical", transform: "none" },
      value: { field: "revenue", displayName: "Revenue (USD)", scaleType: "continuous", transform: "none" },
    },
  }));

  assert.match(python, /SELECT `region` AS category, `revenue` AS value FROM `main`\.`sales`\.`orders` ORDER BY category/);
  assert.match(python, /dropna\(subset=\['category', 'value'\]\)/);
  assert.match(python, /groupby\('category', as_index=False, sort=False\)\['value'\]\.sum\(\)/);
  assert.match(python, /sort_values\('value', ascending=False, kind='mergesort'\)/);
  assert.match(python, /'type': 'arc', 'outerRadius': 120, 'tooltip': True/);
  assert.match(python, /'type': 'text', 'radius': 136/);
  assert.match(python, /'title': 'Market'/);
  assert.match(python, /'title': 'Revenue \(USD\)'/);
  assert.match(python, /_vdab_sql_query_df\('main', 'sales', 'orders', 10000/);
  assert.match(python, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
  assert.match(python, /_vdab_pie_palette\('#2f77cc', len\(vdab_piechart1_data\)\)/);
});

test("PieChartPreview_GroupsConfiguredAggregateAndQuotesIdentifiers", () => {
  const python = generate(createPieChart({
    bindings: createBinding([
      { name: "region`name", type: "STRING", dataType: "STRING" },
      { name: "revenue amount", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
    ]),
    properties: {
      title: "Total revenue",
      seriesColor: "#1f77b4",
      category: { field: "region`name", displayName: "Region", scaleType: "categorical", transform: "none" },
      value: { field: "revenue amount", displayName: "Revenue", scaleType: "continuous", transform: "sum" },
    },
  }));

  assert.match(python, /SELECT `region``name` AS category, SUM\(`revenue amount`\) AS value/);
  assert.match(python, /GROUP BY `region``name` ORDER BY category/);
});

test("PieChartPreview_QueriesLakebaseWithTheInstalledWorkspaceEndpoint", () => {
  const incompletePython = generate(createPieChart({ bindings: null }));
  const lakebasePython = generate(createPieChart({
    bindings: {
      lakebaseAutoscaling: {
        bindingType: "lakebaseAutoscaling",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "lakebaseAutoscaling",
            database: "appdb",
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
              { name: "units", type: "BIGINT", dataType: "BIGINT" },
            ],
          },
        },
      },
    },
  }));

  assert.match(incompletePython, /choose category and value columns/);
  assert.match(lakebasePython, /SELECT "region" AS category, SUM\("revenue"\) AS value/);
  assert.match(lakebasePython, /source_kind='lakebaseAutoscaling', database='appdb'/);
  assert.match(lakebasePython, /endpoint='projects\/project\/branches\/branch\/endpoints\/endpoint'/);
});

test("PieChartInput_RejectsInvalidPropertiesTypesAndAuthorityFields", () => {
  const invalidComponents = [
    createPieChart({ properties: { category: { field: "region", scaleType: "continuous", transform: "none" } } }),
    createPieChart({ properties: { category: { field: "region", scaleType: "categorical", transform: "monthly" } } }),
    createPieChart({ properties: { value: { field: "region", scaleType: "continuous", transform: "sum" } } }),
    createPieChart({ properties: { value: { field: "revenue", scaleType: "continuous", transform: "median" } } }),
    createPieChart({ bindings: { ...tableBinding, workspaceHost: "https://outside.invalid" } }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    );
  }
});

test("DonutChartInput_ValidatesConfigurationAndRejectsClientAuthority", () => {
  const validInput = readComponentsInput({ version: 1, components: [createDonutChart()] });
  assert.equal(validInput.components[0]?.type, "DonutChart");

  const invalidComponents = [
    createDonutChart({ properties: { category: { field: "region", scaleType: "continuous", transform: "none" } } }),
    createDonutChart({ properties: { category: { field: "region", scaleType: "categorical", transform: "monthly" } } }),
    createDonutChart({ properties: { value: { field: "region", scaleType: "continuous", transform: "sum" } } }),
    createDonutChart({ bindings: { ...tableBinding, workspaceHost: "https://outside.invalid" } }),
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
  const input = readComponentsInput({ version: 1, components: [createPieChart()] });
  return { projectId: project.id, version: input.expectedVersion, components: input.components };
}

function createPieChart(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "pie-chart-main",
    type: "PieChart",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "pieChart1",
    description: null,
    properties: {
      title: "Revenue by region",
      seriesColor: "#1f77b4",
      category: { field: "region", displayName: "", scaleType: "categorical", transform: "none" },
      value: { field: "revenue", displayName: "", scaleType: "continuous", transform: "sum" },
    },
    bindings: tableBinding,
    children: [],
    layout: null,
    ...overrides,
  };
}

function createDonutChart(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  const pieChart = createPieChart({
    key: "donut-chart-main",
    type: "DonutChart",
    codeName: "donutChart1",
    properties: {
      title: "Revenue by region",
      seriesColor: "#1f77b4",
      category: { field: "region", displayName: "", scaleType: "categorical", transform: "none" },
      value: { field: "revenue", displayName: "", scaleType: "continuous", transform: "sum" },
    },
  });
  return { ...pieChart, ...overrides };
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
