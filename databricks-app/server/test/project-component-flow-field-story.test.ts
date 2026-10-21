import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";

const project: ProjectSummary = {
  id: "project-flow-field",
  name: "Flow Field",
  description: null,
  version: 3,
  createdBy: "owner-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

const columns = [
  { name: "source_stage", type: "STRING", dataType: "STRING" },
  { name: "destination_stage", type: "STRING", dataType: "STRING" },
  { name: "flow_volume", type: "BIGINT", dataType: "LONG" },
  { name: "stage_order", type: "INT", dataType: "INTEGER" },
  { name: "event_time", type: "TIMESTAMP", dataType: "TIMESTAMP" },
  { name: "conversion", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "drop_count", type: "BIGINT", dataType: "LONG" },
  { name: "avg_time", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "status", type: "STRING", dataType: "STRING" },
];

test("FlowFieldStoryPreview_MatchesAcceptedCanvasFixtureAndViewerQuery", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/flow-field-story-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const python = generate(createFlowFieldStory());

  assert.equal(python, expectedPython);
  assert.match(python, /MAX\(`event_time`\)/);
  assert.match(python, /GROUP BY `source_stage`, `destination_stage`/);
  assert.match(python, /_vdab_sql_query_df\('main', 'sales', 'flows', 500, query_statement=/);
  assert.match(python, /statement \+= f' LIMIT \{max_rows:d\}'/);
  assert.match(python, /'show_drop_offs': True/);
  assert.match(python, /'show_labels': True/);
  assert.match(python, /const payload = __FLOW_FIELD_PAYLOAD__/);
  assert.match(python, /statusColor\(status\)/);
  assert.match(python, /Hover streams for details/);
  assert.match(python, /Largest drop-off:/);
  assert.match(python, /reason': 'low_conversion'/);
  assert.match(python, /\.replace\('<', '\\\\u003c'\)/);
});

test("FlowFieldStoryPreview_UsesAllOptionalMeasuresAndVisibilitySettings", () => {
  const python = generate(createFlowFieldStory({
    properties: {
      ...defaultProperties(),
      showDropOffs: false,
      showLabels: false,
    },
  }));

  assert.match(python, /AVG\(`conversion`\) AS conversion_pct/);
  assert.match(python, /SUM\(`drop_count`\) AS drop_off/);
  assert.match(python, /AVG\(`avg_time`\) AS avg_time_in_stage/);
  assert.match(python, /MAX\(`status`\) AS status/);
  assert.match(python, /'show_drop_offs': False/);
  assert.match(python, /'show_labels': False/);
  assert.match(python, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
});

test("FlowFieldStoryPreview_PreservesIncompleteAndLakebaseBindings", () => {
  const incompletePython = generate(createFlowFieldStory({
    properties: { ...defaultProperties(), stageOrder: axis("", "continuous", "max") },
  }));
  const lakebasePython = generate(createFlowFieldStory({ bindings: createLakebaseBinding() }));

  assert.match(incompletePython, /Map the required FlowFieldStory fields/);
  assert.doesNotMatch(incompletePython, /query_statement=/);
  assert.match(lakebasePython, /_vdab_sql_query_df\(/);
  assert.match(lakebasePython, /source_kind='lakebaseAutoscaling', database='appdb'/);
});

test("FlowFieldStoryInput_RejectsInvalidSettingsMappingsAndShape", () => {
  const invalidComponents = [
    createFlowFieldStory({ properties: { ...defaultProperties(), showLabels: "true" } }),
    createFlowFieldStory({ properties: { ...defaultProperties(), flowVolume: axis("flow_volume", "categorical", "sum") } }),
    createFlowFieldStory({ properties: { ...defaultProperties(), unknown: true } }),
    createFlowFieldStory({
      properties: { ...defaultProperties(), flowVolume: axis("source_stage", "continuous", "sum") },
    }),
    createFlowFieldStory({ children: ["nested-child"] }),
    createFlowFieldStory({ layout: { columns: 2 } }),
    createFlowFieldStory({ bindings: { ...createUnityCatalogBinding(), workspaceHost: "https://outside.invalid" } }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    );
  }
});

test("FlowFieldStoryPreview_RejectsMalformedPersistedComponent", () => {
  assert.throws(
    () => generate(createFlowFieldStory({ properties: { ...defaultProperties(), unexpected: true } })),
    (error: unknown) => error instanceof ApplicationError && error.status === 422 &&
      error.code === "invalid_flow_field_story_properties",
  );
});

function generate(component: ProjectComponent): string {
  return new ProjectPreviewGenerator().generate(project, {
    projectId: project.id,
    version: 1,
    components: [component],
  }).files[0]?.content ?? "";
}

function createFlowFieldStory(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "flow-field-story-main",
    type: "FlowFieldStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "flowFieldStory1",
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
    title: "Flow Field Story",
    sourceStage: axis("source_stage", "categorical", "none"),
    destinationStage: axis("destination_stage", "categorical", "none"),
    flowVolume: axis("flow_volume", "continuous", "sum"),
    stageOrder: axis("stage_order", "continuous", "max"),
    timeField: axis("event_time", "categorical", "none"),
    conversionPct: axis("conversion", "continuous", "avg"),
    dropOffCount: axis("drop_count", "continuous", "sum"),
    avgTimeInStage: axis("avg_time", "continuous", "avg"),
    status: axis("status", "categorical", "none"),
    showDropOffs: true,
    showLabels: true,
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
          table: "flows",
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
          table: "flow_data",
          dataSourceFormat: null,
          primaryKeyColumn: "flow_id",
          columns,
        },
      },
    },
  };
}
