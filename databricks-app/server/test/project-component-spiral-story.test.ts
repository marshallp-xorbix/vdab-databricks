import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";
import { SPIRAL_STORY_HTML } from "../src/generation/spiral-story-html.ts";

const project: ProjectSummary = {
  id: "project-spiral-story",
  name: "Journey tracker",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  callerRole: "owner",
};

const columns = [
  { name: "journey", type: "STRING", dataType: "STRING" },
  { name: "stage", type: "STRING", dataType: "STRING" },
  { name: "milestone_date", type: "DATE", dataType: "DATE" },
  { name: "progress", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "metric", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  { name: "target_date", type: "DATE", dataType: "DATE" },
  { name: "actual_date", type: "DATE", dataType: "DATE" },
  { name: "status", type: "STRING", dataType: "STRING" },
  { name: "risk", type: "INT", dataType: "INTEGER" },
  { name: "owner", type: "STRING", dataType: "STRING" },
  { name: "achievement", type: "STRING", dataType: "STRING" },
  { name: "cost", type: "BIGINT", dataType: "LONG" },
];

test("SpiralStoryPreview_MatchesFixtureAndViewerAuthorizedJourneyQuery", async () => {
  const fixture = await readFile(new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/spiral-story-app.py",
    import.meta.url,
  ), "utf8");
  const python = generate(createSpiralStory());

  assert.equal(python, fixture);
  assert.match(python, /SELECT `journey` AS journey_name, `stage` AS stage, MAX\(`milestone_date`\) AS timeline/);
  assert.match(python, /AVG\(`progress`\) AS progress_pct, SUM\(`metric`\) AS metric_value/);
  assert.match(python, /MAX\(`target_date`\) AS target_date, MAX\(`actual_date`\) AS actual_date/);
  assert.match(python, /MAX\(`owner`\) AS owner, MAX\(`achievement`\) AS key_achievement, AVG\(`risk`\) AS risk_score/);
  assert.match(python, /SUM\(`cost`\) AS cost/);
  assert.match(python, /GROUP BY `journey`, `stage` ORDER BY MAX\(`milestone_date`\)/);
  assert.doesNotMatch(python, /SELECT MAX\(`milestone_date`\) FROM/);
  assert.match(python, /_vdab_sql_query_df\('main', 'analytics', 'journey_milestones', 100, query_statement=/);
  assert.doesNotMatch(python, /LIMIT 100/);
  assert.match(python, /x-forwarded-access-token/);
  assert.match(python, /const payload = __SPIRAL_PAYLOAD__/);
  assert.match(python, /journeys\.length<2/);
  assert.match(python, /components\.html\(vdab_journeytracker_html, height=560, scrolling=False\)/);
});

test("SpiralStoryPreview_MapsEveryOptionalFieldAndVisualSetting", () => {
  const python = generate(createSpiralStory({ properties: {
    ...defaultProperties(),
    progressPct: axis("progress", "continuous", "max"),
    metricValue: axis("metric", "continuous", "avg"),
    targetDate: axis("target_date", "categorical"),
    actualDate: axis("actual_date", "categorical"),
    status: axis("status", "categorical"),
    riskScore: axis("risk", "continuous", "max"),
    owner: axis("owner", "categorical"),
    keyAchievement: axis("achievement", "categorical"),
    cost: axis("cost", "continuous", "min"),
    showLabels: false,
    showRiskGlow: false,
    showVariance: false,
    spaceByTimeline: true,
  } }));

  for (const alias of ["target_date", "actual_date", "status", "risk_score", "owner", "key_achievement", "cost"]) {
    assert.match(python, new RegExp(`AS ${alias}`));
  }
  assert.match(python, /MAX\(`progress`\) AS progress_pct/);
  assert.match(python, /AVG\(`metric`\) AS metric_value/);
  assert.match(python, /'show_labels': False/);
  assert.match(python, /'show_risk_glow': False/);
  assert.match(python, /'show_variance': False/);
  assert.match(python, /'space_by_timeline': True/);
});

test("SpiralStoryInput_RejectsMalformedPropertiesBindingsAndComponentShape", () => {
  const invalidComponents = [
    createSpiralStory({ properties: { ...defaultProperties(), unknown: true } }),
    createSpiralStory({ properties: { ...defaultProperties(), title: 23 } }),
    createSpiralStory({ properties: { ...defaultProperties(), showLabels: "true" } }),
    createSpiralStory({ properties: { ...defaultProperties(), journeyName: axis("journey", "continuous") } }),
    createSpiralStory({ properties: { ...defaultProperties(), progressPct: axis("progress", "continuous", "yearly") } }),
    createSpiralStory({ properties: { ...defaultProperties(), cost: axis("cost", "continuous", "max; DROP TABLE") } }),
    createSpiralStory({ properties: { ...defaultProperties(), cost: axis("cost", "continuous", "sum") }, bindings: createUnityCatalogBinding({ costType: "STRING" }) }),
    createSpiralStory({ properties: { ...defaultProperties(), metricValue: axis("outside", "continuous", "sum") } }),
    createSpiralStory({ children: ["nested"] }),
    createSpiralStory({ layout: { columns: 2 } }),
    createSpiralStory({ bindings: { ...createUnityCatalogBinding(), workspaceHost: "https://outside.invalid" } }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    );
  }
});

test("SpiralStoryPreview_RejectsMalformedPersistedPropertiesAndMissingMappings", () => {
  for (const component of [
    createSpiralStory({ properties: { ...defaultProperties(), spaceByTimeline: "true" } }),
    createSpiralStory({ properties: { ...defaultProperties(), riskScore: axis("risk", "continuous", "avg; select") } }),
    createSpiralStory({ schemaVersion: 2 }),
  ]) {
    assert.throws(
      () => generate(component),
      (error: unknown) => error instanceof ApplicationError && error.status === 422 &&
        error.code === "invalid_spiral_story_properties",
    );
  }

  const incomplete = generate(createSpiralStory({
    properties: { ...defaultProperties(), metricValue: axis("", "continuous", "sum") },
  }));
  assert.match(incomplete, /Map the required SpiralStory fields/);
  assert.doesNotMatch(incomplete, /query_statement=/);
});

test("SpiralStoryInput_PreservesLakebaseBindingWithExplicitLimitation", () => {
  const python = generate(createSpiralStory({ bindings: createLakebaseBinding() }));
  assert.match(python, /_vdab_sql_query_df\(/);
  assert.match(python, /source_kind='lakebaseAutoscaling', database='builder'/);
});

test("SpiralStoryCanvas_KeyboardNavigationAnnouncesEscapedMilestoneDetails", () => {
  assert.match(SPIRAL_STORY_HTML, /role="group" tabindex="0" aria-label="Spiral journey visualization"/);
  assert.match(SPIRAL_STORY_HTML, /ArrowRight/);
  assert.match(SPIRAL_STORY_HTML, /ArrowLeft/);
  assert.match(SPIRAL_STORY_HTML, /aria-live="polite"/);
  assert.match(SPIRAL_STORY_HTML, /function esc\(v\)/);
  assert.match(SPIRAL_STORY_HTML, /function placementFractions|function fractions/);
  assert.match(SPIRAL_STORY_HTML, /dblclick/);
  assert.match(SPIRAL_STORY_HTML, /space_by_timeline/);

  const listeners = new Map<string, (event: unknown) => void>();
  const rect = { left: 0, top: 0, width: 800, height: 560 };
  const context = {
    setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, fillRect() {}, fillText() {},
    createRadialGradient: () => ({ addColorStop() {} }), clip() {},
  };
  const wrap = {
    clientWidth: 800,
    clientHeight: 560,
    getBoundingClientRect: () => rect,
    addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler),
  };
  const canvas = {
    width: 0, height: 0, style: { cursor: "" },
    parentElement: wrap,
    getContext: () => context,
    getBoundingClientRect: () => rect,
    addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler),
  };
  const tip = { style: { display: "", left: "", top: "" }, innerHTML: "" };
  const warning = { textContent: "" };
  const announcer = { textContent: "" };
  const toolbar = { style: { display: "" } };
  const select = { addEventListener() {}, appendChild() {}, value: "" };
  const elements = new Map<string, object>([
    ["wrap", wrap], ["c", canvas], ["tip", tip], ["warn", warning],
    ["announce", announcer], ["toolbar", toolbar], ["journeySelect", select],
  ]);
  const script = /<script>([\s\S]*?)<\/script>/.exec(SPIRAL_STORY_HTML)?.[1];
  assert.ok(script);
  new vm.Script(script.replace("__SPIRAL_PAYLOAD__", JSON.stringify({
    records: [{ journey_name: "__proto__", stage: "A & <B>", timeline: "2026-01-01", progress_pct: 80, metric_value: 42, status: "active" }],
    journeys: ["__proto__"], selected_journey: "__proto__", summary: { warnings: [] },
  }))).runInNewContext({
    document: { getElementById: (id: string) => elements.get(id) },
    window: { devicePixelRatio: 1, addEventListener() {} },
  });

  listeners.get("keydown")?.({ key: "ArrowRight", preventDefault() {} });
  assert.match(announcer.textContent, /Milestone 1 of 1\. A & <B>\./);
  listeners.get("keydown")?.({ key: "Enter", preventDefault() {} });
  assert.match(announcer.textContent, /Journey __proto__/);
  listeners.get("keydown")?.({ key: "Escape", preventDefault() {} });
  assert.equal(announcer.textContent, "Milestone selection cleared.");
});

function generate(component: ProjectComponent): string {
  return new ProjectPreviewGenerator().generate(project, {
    projectId: project.id,
    version: 1,
    components: [component],
  }).files[0]?.content ?? "";
}

function createSpiralStory(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "spiral-main",
    type: "SpiralStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "journeyTracker",
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
    title: "Journey Tracker",
    journeyName: axis("journey", "categorical"),
    stage: axis("stage", "categorical"),
    timelineField: axis("milestone_date", "categorical"),
    progressPct: axis("progress", "continuous", "avg"),
    metricValue: axis("metric", "continuous", "sum"),
    targetDate: axis("target_date", "categorical"),
    actualDate: axis("actual_date", "categorical"),
    status: axis("status", "categorical"),
    riskScore: axis("risk", "continuous", "avg"),
    owner: axis("owner", "categorical"),
    keyAchievement: axis("achievement", "categorical"),
    cost: axis("cost", "continuous", "sum"),
    showLabels: true,
    showRiskGlow: true,
    showVariance: true,
    spaceByTimeline: false,
  };
}

function axis(field: string, scaleType: "categorical" | "continuous", transform = "none") {
  return { field, displayName: "", scaleType, transform };
}

function createUnityCatalogBinding(overrides: { costType?: string } = {}): ProjectComponent["bindings"] {
  return {
    unityCatalogTable: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          catalog: "main",
          schema: "analytics",
          table: "journey_milestones",
          dataSourceFormat: "DELTA",
          primaryKeyColumn: null,
          columns: columns.map((column) => ({
            ...column,
            ...(column.name === "cost" && overrides.costType
              ? { type: overrides.costType, dataType: overrides.costType }
              : {}),
          })),
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
          catalog: "main",
          schema: "analytics",
          table: "journey_milestones",
          database: "builder",
          projectId: "project-1",
          branchId: "branch-1",
          endpointId: "endpoint-1",
          columns,
        },
      },
    },
  };
}
