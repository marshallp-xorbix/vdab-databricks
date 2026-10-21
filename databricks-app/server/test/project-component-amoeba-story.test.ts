import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";

const project: ProjectSummary = {
  id: "project-amoeba-story",
  name: "Portfolio story",
  description: null,
  version: 2,
  createdBy: "owner-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

const columns = [
  { name: "entity_id", type: "BIGINT", dataType: "BIGINT" },
  { name: "entity_name", type: "STRING", dataType: "STRING" },
  { name: "segment", type: "STRING", dataType: "STRING" },
  { name: "period", type: "TIMESTAMP", dataType: "TIMESTAMP" },
  { name: "size", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  { name: "x_position", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "y_position", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "change_value", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "health", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "risk", type: "DOUBLE", dataType: "DOUBLE" },
];

test("AmoebaStoryPreview_MatchesAcceptedCanvasFixtureAndEscapesEmbeddedData", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/amoeba-story-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const python = generate(createAmoebaStory());

  assert.equal(python, expectedPython);
  assert.match(python, /SELECT `entity_id` AS entity_id, MAX\(`entity_name`\) AS entity_label/);
  assert.match(python, /GROUP BY `entity_id`'\)/);
  assert.match(python, /_vdab_sql_query_df\('main', 'sales', 'portfolio', 100, query_statement=/);
  assert.match(python, /statement \+= f' LIMIT \{max_rows:d\}'/);
  assert.doesNotMatch(python, /WHERE `period` = \(SELECT MAX\(`period`\)/);
  assert.match(python, /components\.html\(vdab_amoebastory1_html, height=560, scrolling=False\)/);
  assert.match(python, /\.replace\('<', '\\\\u003c'\)/);
  assert.match(python, /const payload = __AMOEBA_PAYLOAD__/);
  assert.match(python, /drag to pan/i);
  assert.match(python, /double-click to reset/i);
});

test("AmoebaStoryPreview_UsesViewerQueryAggregationAndEveryVisualSetting", () => {
  const python = generate(createAmoebaStory({
    codeName: "portfolio",
    properties: {
      ...defaultProperties(),
      layoutMode: "scatter",
      sizeScale: "log",
      minRadiusPx: 24,
      maxRadiusPx: 155,
      colorBy: "health_score",
      pulseBy: "none",
      pulseThreshold: 72,
      pulseThresholdMode: "below",
      shapeVariation: 0.6,
      labelMode: "full",
      animationEnabled: false,
      animationSpeed: 1.5,
      entityId: axis("entity_id", "categorical", "none"),
      entityLabel: axis("entity_name", "categorical", "none"),
      category: axis("segment", "categorical", "none"),
      sizeMetric: axis("size", "continuous", "sum"),
      xMetric: axis("x_position", "continuous", "avg"),
      yMetric: axis("y_position", "continuous", "avg"),
      changeMetric: axis("change_value", "continuous", "avg"),
      timeField: axis("period", "categorical", "none"),
      healthScore: axis("health", "continuous", "avg"),
      riskScore: axis("risk", "continuous", "avg"),
    },
  }));

  assert.match(python, /SUM\(`size`\) AS size_value/);
  assert.match(python, /AVG\(`x_position`\) AS x_value/);
  assert.match(python, /AVG\(`health`\) AS health_score/);
  assert.match(python, /AVG\(`risk`\) AS risk_score/);
  assert.match(python, /WHERE `period` = \(SELECT MAX\(`period`\)/);
  assert.match(python, /'layout_mode': 'scatter'/);
  assert.match(python, /'size_scale': 'log'/);
  assert.match(python, /'min_radius_px': 24/);
  assert.match(python, /'max_radius_px': 155/);
  assert.match(python, /'color_by': 'health_score'/);
  assert.match(python, /'pulse_by': 'none'/);
  assert.match(python, /'pulse_threshold_mode': 'below'/);
  assert.match(python, /'shape_variation': 0.6/);
  assert.match(python, /'label_mode': 'full'/);
  assert.match(python, /'animation_enabled': False/);
  assert.match(python, /'animation_speed': 1.5/);
  assert.match(python, /_vdab_sql_query_df\('main', 'sales', 'portfolio', 100, query_statement=/);
  assert.match(python, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
});

test("AmoebaStoryPreview_PreservesIncompleteAndLakebaseBindings", () => {
  const incompletePython = generate(createAmoebaStory({
    properties: { ...defaultProperties(), entityLabel: axis("", "categorical", "none") },
  }));
  const lakebasePython = generate(createAmoebaStory({ bindings: createLakebaseBinding() }));

  assert.match(incompletePython, /Map the required AmoebaStory fields/);
  assert.doesNotMatch(incompletePython, /query_statement=/);
  assert.match(lakebasePython, /_vdab_sql_query_df\(/);
  assert.match(lakebasePython, /source_kind='lakebaseAutoscaling', database='appdb'/);
});

test("AmoebaStoryInput_RejectsMalformedPropertiesBindingsAndComponentShape", () => {
  const invalidComponents = [
    createAmoebaStory({ properties: { ...defaultProperties(), maxRadiusPx: 7 } }),
    createAmoebaStory({ properties: { ...defaultProperties(), layoutMode: "orbit" } }),
    createAmoebaStory({ properties: { ...defaultProperties(), unexpected: true } }),
    createAmoebaStory({
      properties: { ...defaultProperties(), sizeMetric: axis("entity_name", "continuous", "sum") },
    }),
    createAmoebaStory({ children: ["nested-child"] }),
    createAmoebaStory({ layout: { columns: 2 } }),
    createAmoebaStory({ bindings: { ...createUnityCatalogBinding(), workspaceHost: "https://outside.invalid" } }),
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

function createAmoebaStory(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "amoeba-story-main",
    type: "AmoebaStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "amoebaStory1",
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
    title: "Portfolio story",
    entityId: axis("entity_id", "categorical", "none"),
    entityLabel: axis("entity_name", "categorical", "none"),
    category: axis("segment", "categorical", "none"),
    sizeMetric: axis("size", "continuous", "sum"),
    xMetric: axis("x_position", "continuous", "avg"),
    yMetric: axis("y_position", "continuous", "avg"),
    changeMetric: axis("change_value", "continuous", "avg"),
    timeField: axis("", "categorical", "none"),
    healthScore: axis("", "continuous", "avg"),
    riskScore: axis("", "continuous", "avg"),
    layoutMode: "hybrid",
    sizeScale: "sqrt",
    minRadiusPx: 42,
    maxRadiusPx: 130,
    colorBy: "category",
    pulseBy: "risk_score",
    pulseThreshold: 50,
    pulseThresholdMode: "above",
    shapeVariation: 0.35,
    labelMode: "compact",
    animationEnabled: true,
    animationSpeed: 1,
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
          table: "portfolio",
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
          table: "entities",
          dataSourceFormat: null,
          primaryKeyColumn: "entity_id",
          columns,
        },
      },
    },
  };
}
