import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";

const project: ProjectSummary = {
  id: "project-heat-map",
  name: "Heat Map by State",
  description: null,
  version: 2,
  createdBy: "owner-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

const columns = [
  { name: "state_code", type: "STRING", dataType: "STRING" },
  { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  { name: "order_month", type: "DATE", dataType: "DATE" },
  { name: "units", type: "BIGINT", dataType: "LONG" },
  { name: "growth_pct", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "target", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "risk", type: "INT", dataType: "INTEGER" },
  { name: "region", type: "STRING", dataType: "STRING" },
  { name: "forecast", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "notes", type: "STRING", dataType: "STRING" },
];

test("HeatMapStoryPreview_MatchesGeneratedPythonFixtureAndViewerQuery", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/heat-map-story-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const python = generate(createHeatMapStory());

  assert.equal(python, expectedPython);
  assert.match(python, /SELECT `state_code` AS area_key, SUM\(`revenue`\) AS metric_value/);
  assert.match(python, /MAX\(`order_month`\)/);
  assert.match(python, /GROUP BY `state_code`/);
  assert.match(python, /_vdab_sql_query_df\('main', 'sales', 'state_sales', 500, query_statement=/);
  assert.match(python, /statement \+= f' LIMIT \{max_rows:d\}'/);
  assert.match(python, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
  assert.match(python, /const USA = \{/);
  assert.match(python, /canvas\.addEventListener/);
  assert.match(python, /Unmatched area keys/);
  assert.match(python, /'color_scale': 'sequential'/);
  assert.match(python, /'show_labels': True/);
  assert.match(python, /'show_legend': True/);
  assert.match(python, /components\.html\(vdab_heatmapstory1_html, height=580, scrolling=False\)/);
  assert.match(python, /\.replace\('<', '\\\\u003c'\)/);
});

test("HeatMapStoryPreview_UsesEveryOptionalMappingAndSelectedAppearance", () => {
  const python = generate(createHeatMapStory({
    properties: {
      ...defaultProperties(),
      colorScale: "diverging",
      showLabels: false,
      showLegend: false,
      aggregationMethod: "max",
    },
  }));

  assert.match(python, /SUM\(`units`\) AS secondary_value/);
  assert.match(python, /AVG\(`growth_pct`\) AS change_pct/);
  assert.match(python, /AVG\(`target`\) AS target_value/);
  assert.match(python, /AVG\(`risk`\) AS risk_score/);
  assert.match(python, /MAX\(`region`\) AS category/);
  assert.match(python, /AVG\(`forecast`\) AS forecast_value/);
  assert.match(python, /MAX\(`notes`\) AS notes/);
  assert.match(python, /'color_scale': 'diverging'/);
  assert.match(python, /'aggregation_method': 'max'/);
  assert.match(python, /'show_labels': False/);
  assert.match(python, /'show_legend': False/);
});

test("HeatMapStoryPreview_PreservesIncompleteAndLakebaseBindings", () => {
  const incompletePython = generate(createHeatMapStory({
    properties: { ...defaultProperties(), geographicArea: axis("", "categorical", "none") },
  }));
  const lakebasePython = generate(createHeatMapStory({ bindings: createLakebaseBinding() }));

  assert.match(incompletePython, /Map the required HeatMapStory fields/);
  assert.doesNotMatch(incompletePython, /query_statement=/);
  assert.match(lakebasePython, /_vdab_sql_query_df\(/);
  assert.match(lakebasePython, /source_kind='lakebaseAutoscaling', database='appdb'/);
});

test("HeatMapStoryInput_RejectsInvalidPropertiesBindingsAndComponentShape", () => {
  const invalidComponents = [
    createHeatMapStory({ properties: { ...defaultProperties(), colorScale: "rainbow" } }),
    createHeatMapStory({ properties: { ...defaultProperties(), aggregationMethod: "count" } }),
    createHeatMapStory({ properties: { ...defaultProperties(), metricValue: axis("revenue", "categorical", "sum") } }),
    createHeatMapStory({ properties: { ...defaultProperties(), unexpected: true } }),
    createHeatMapStory({ properties: { ...defaultProperties(), metricValue: axis("missing", "continuous", "sum") } }),
    createHeatMapStory({ children: ["nested-child"] }),
    createHeatMapStory({ layout: { columns: 2 } }),
    createHeatMapStory({ bindings: { ...createUnityCatalogBinding(), workspaceHost: "https://outside.invalid" } }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    );
  }
});

test("HeatMapStoryPreview_RejectsMalformedPersistedPropertiesAndShape", () => {
  assert.throws(
    () => generate(createHeatMapStory({ properties: { ...defaultProperties(), unexpected: true } })),
    (error: unknown) => error instanceof ApplicationError && error.status === 422 &&
      error.code === "invalid_heat_map_story_properties",
  );
  assert.throws(
    () => generate(createHeatMapStory({ children: ["nested-child"] })),
    (error: unknown) => error instanceof ApplicationError && error.status === 422 &&
      error.code === "invalid_heat_map_story_properties",
  );
});

function generate(component: ProjectComponent): string {
  return new ProjectPreviewGenerator().generate(project, {
    projectId: project.id,
    version: 1,
    components: [component],
  }).files[0]?.content ?? "";
}

function createHeatMapStory(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "heat-map-story-main",
    type: "HeatMapStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "heatMapStory1",
    description: null,
    properties: defaultProperties(),
    bindings: createUnityCatalogBinding(),
    children: [],
    layout: null,
    ...overrides,
  };
}

function defaultProperties(): ProjectComponent["properties"] {
  return {
    title: "State Revenue",
    geographicArea: axis("state_code", "categorical", "none"),
    metricValue: axis("revenue", "continuous", "sum"),
    timeField: axis("order_month", "categorical", "none"),
    secondaryMetric: axis("units", "continuous", "sum"),
    changePct: axis("growth_pct", "continuous", "avg"),
    targetValue: axis("target", "continuous", "avg"),
    riskScore: axis("risk", "continuous", "avg"),
    category: axis("region", "categorical", "none"),
    forecastValue: axis("forecast", "continuous", "avg"),
    notes: axis("notes", "categorical", "none"),
    mapScope: "usa",
    geographicLevel: "state",
    colorScale: "sequential",
    showLabels: true,
    showLegend: true,
    aggregationMethod: "sum",
  };
}

function axis(field: string, scaleType: "categorical" | "continuous", transform: string) {
  return { field, displayName: "", scaleType, transform };
}

function createUnityCatalogBinding(): ProjectComponent["bindings"] {
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
          table: "state_sales",
          dataSourceFormat: "DELTA",
          primaryKeyColumn: null,
          columns,
        },
      },
    },
  };
}

function createLakebaseBinding(): ProjectComponent["bindings"] {
  return {
    lakebaseAutoscaling: {
      bindingType: "lakebaseAutoscaling",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "lakebaseAutoscaling",
          database: "appdb",
          projectId: "db-project",
          branchId: "production",
          endpointId: "read-write",
          catalog: "public",
          schema: "public",
          table: "state_sales",
          dataSourceFormat: null,
          primaryKeyColumn: null,
          columns,
        },
      },
    },
  };
}
