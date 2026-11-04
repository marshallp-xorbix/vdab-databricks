import assert from "node:assert/strict";
import { readGeneratedPythonFixture } from "./generated-python-fixture.ts";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";

const project: ProjectSummary = {
  id: "project-honeycomb",
  name: "Portfolio health",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

const columns = [
  { name: "item_id", type: "STRING", dataType: "STRING" },
  { name: "impact", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "priority", type: "STRING", dataType: "STRING" },
  { name: "progress", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "category", type: "STRING", dataType: "STRING" },
  { name: "snapshot_date", type: "DATE", dataType: "DATE" },
  { name: "trend", type: "STRING", dataType: "STRING" },
  { name: "risk", type: "INT", dataType: "INTEGER" },
  { name: "owner", type: "STRING", dataType: "STRING" },
  { name: "due_date", type: "DATE", dataType: "DATE" },
  { name: "investment", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  { name: "benefit", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  { name: "notes", type: "STRING", dataType: "STRING" },
  { name: "status", type: "STRING", dataType: "STRING" },
];

test("HoneycombStoryPreview_MatchesFixtureAndUsesViewerAuthorizedItemQuery", async () => {
  const expectedPython = await readGeneratedPythonFixture(
    "honeycomb-story-app.py",
  );
  const python = generate(createHoneycombStory());

  assert.equal(python, expectedPython);
  assert.match(
    python,
    /SELECT `item_id` AS item_name, AVG\(`impact`\) AS impact_score/,
  );
  assert.match(python, /MAX\(`priority`\) AS priority_level/);
  assert.match(python, /MAX\(`category`\) AS category/);
  assert.match(python, /GROUP BY `item_id`'\)/);
  assert.doesNotMatch(python, /GROUP BY `item_id` LIMIT 100/);
  assert.match(
    python,
    /WHERE `snapshot_date` = \(SELECT MAX\(`snapshot_date`\)/,
  );
  assert.match(
    python,
    /_vdab_sql_query_df\('main', 'sales', 'portfolio_items', 100, query_statement=/,
  );
  assert.match(
    python,
    /st\.context\.headers\.get\('x-forwarded-access-token'\)/,
  );
  assert.match(python, /high_impact_low_progress/);
  assert.match(python, /delivery_health/);
  assert.match(python, /const RISK_THRESHOLD = 70/);
  assert.match(python, /dblclick/);
  assert.match(python, /wheel/);
  assert.match(python, /__HONEYCOMB_PAYLOAD__/);
  assert.match(python, /\.replace\('<', '\\\\u003c'\)/);
  assert.match(
    python,
    /components\.html\(vdab_honeycombstory1_html, height=560, scrolling=False\)/,
  );
});

test("HoneycombStoryPreview_UsesOptionalRolesAndVisualSettings", () => {
  const python = generate(
    createHoneycombStory({
      properties: {
        ...defaultProperties(),
        showLabels: false,
        showRiskBorders: false,
        showTrendArrows: false,
        impactScore: axis("impact", "continuous", "max"),
        investment: axis("investment", "continuous", "avg"),
      },
    }),
  );

  assert.match(python, /MAX\(`impact`\) AS impact_score/);
  assert.match(python, /MAX\(`due_date`\) AS due_date/);
  assert.match(python, /MAX\(`trend`\) AS trend/);
  assert.match(python, /AVG\(`investment`\) AS investment/);
  assert.match(python, /MAX\(`status`\) AS status/);
  assert.match(python, /'show_labels': False/);
  assert.match(python, /'show_risk_borders': False/);
  assert.match(python, /'show_trend_arrows': False/);
});

test("HoneycombStoryPreview_PreservesIncompleteAndLakebaseBindings", () => {
  const incompletePython = generate(
    createHoneycombStory({
      properties: {
        ...defaultProperties(),
        itemName: axis("", "categorical", "none"),
      },
    }),
  );
  const lakebasePython = generate(
    createHoneycombStory({ bindings: createLakebaseBinding() }),
  );

  assert.match(incompletePython, /Map the required HoneycombStory fields/);
  assert.doesNotMatch(incompletePython, /query_statement=/);
  assert.match(lakebasePython, /_vdab_sql_query_df\(/);
  assert.match(
    lakebasePython,
    /source_kind='lakebaseAutoscaling', database='appdb'.*resource_environment_variable='VDAB_LAKEBASE_ENDPOINT_[A-F0-9]{16}'/,
  );
});

test("HoneycombStoryInput_RejectsInvalidMappingsTypesAndComponentShape", () => {
  const invalidComponents = [
    createHoneycombStory({
      properties: { ...defaultProperties(), unexpected: true },
    }),
    createHoneycombStory({
      properties: {
        ...defaultProperties(),
        impactScore: axis("impact", "categorical", "avg"),
      },
    }),
    createHoneycombStory({
      properties: {
        ...defaultProperties(),
        impactScore: axis("impact", "continuous", "median"),
      },
    }),
    createHoneycombStory({
      properties: {
        ...defaultProperties(),
        impactScore: axis("missing", "continuous", "avg"),
      },
    }),
    createHoneycombStory({
      properties: {
        ...defaultProperties(),
        status: axis("missing", "categorical", "none"),
      },
    }),
    createHoneycombStory({ children: ["nested-child"] }),
    createHoneycombStory({ layout: { columns: 2 } }),
    createHoneycombStory({
      bindings: {
        ...createUnityCatalogBinding(),
        workspaceHost: "https://outside.invalid",
      },
    }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) =>
        error instanceof ApplicationError && error.status === 400,
    );
  }
});

test("HoneycombStoryPreview_RejectsMalformedPersistedPropertiesAndShape", () => {
  assert.throws(
    () =>
      generate(
        createHoneycombStory({
          properties: { ...defaultProperties(), showLabels: "yes" },
        }),
      ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 422 &&
      error.code === "invalid_honeycomb_story_properties",
  );
  assert.throws(
    () => generate(createHoneycombStory({ children: ["nested-child"] })),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 422 &&
      error.code === "invalid_honeycomb_story_properties",
  );
});

function generate(component: ProjectComponent): string {
  return (
    new ProjectPreviewGenerator().generate(project, {
      projectId: project.id,
      version: 1,
      components: [component],
    }).files[0]?.content ?? ""
  );
}

function createHoneycombStory(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "honeycomb-story-main",
    type: "HoneycombStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "honeycombStory1",
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
    title: "Portfolio Health",
    itemName: axis("item_id", "categorical", "none"),
    impactScore: axis("impact", "continuous", "avg"),
    priorityLevel: axis("priority", "categorical", "none"),
    progressPct: axis("progress", "continuous", "avg"),
    category: axis("category", "categorical", "none"),
    timeField: axis("snapshot_date", "categorical", "none"),
    trend: axis("trend", "categorical", "none"),
    riskScore: axis("risk", "continuous", "avg"),
    owner: axis("owner", "categorical", "none"),
    dueDate: axis("due_date", "categorical", "none"),
    investment: axis("investment", "continuous", "sum"),
    benefitValue: axis("benefit", "continuous", "sum"),
    notes: axis("notes", "categorical", "none"),
    status: axis("status", "categorical", "none"),
    showLabels: true,
    showRiskBorders: true,
    showTrendArrows: true,
  };
}

function axis(
  field: string,
  scaleType: "categorical" | "continuous",
  transform: string,
) {
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
          table: "portfolio_items",
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
          databaseId: "database-id",
          projectId: "db-project",
          branchId: "production",
          endpointId: "read-write",
          catalog: "public",
          schema: "public",
          table: "portfolio_items",
          dataSourceFormat: null,
          primaryKeyColumn: null,
          columns,
        },
      },
    },
  };
}
