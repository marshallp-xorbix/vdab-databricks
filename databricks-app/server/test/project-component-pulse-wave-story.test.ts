import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";
import { PULSE_WAVE_STORY_HTML } from "../src/generation/pulse-wave-story-html.ts";

const project: ProjectSummary = {
  id: "project-pulse-wave",
  name: "Weekly revenue pulse",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  callerRole: "owner",
};

const columns = [
  { name: "period", type: "DATE", dataType: "DATE" },
  { name: "revenue", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "target_revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  { name: "event_name", type: "STRING", dataType: "STRING" },
  { name: "event_type", type: "STRING", dataType: "STRING" },
  { name: "impact_score", type: "INT", dataType: "INTEGER" },
];

test("PulseWaveStoryPreview_MatchesLegacyCanvasFixtureAndViewerQuery", async () => {
  const fixturePath = new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/pulse-wave-story-app.py",
    import.meta.url,
  );
  const expectedPython = await readFile(fixturePath, "utf8");
  const python = generate(createPulseWaveStory());

  assert.equal(python, expectedPython);
  assert.match(python, /SELECT `period` AS time_period/);
  assert.match(python, /SUM\(`revenue`\) AS metric_value/);
  assert.match(python, /AVG\(`target_revenue`\) AS baseline_value/);
  assert.match(python, /MAX\(`event_name`\) AS event_name/);
  assert.match(python, /MAX\(`event_type`\) AS event_type/);
  assert.match(python, /AVG\(`impact_score`\) AS impact_score/);
  assert.match(python, /GROUP BY `period` ORDER BY `period`/);
  assert.doesNotMatch(python, /SELECT MAX\(`period`\)/);
  assert.match(python, /_vdab_sql_query_df\('main', 'analytics', 'weekly_revenue', 500, query_statement=/);
  assert.doesNotMatch(python, /LIMIT 500/);
  assert.match(python, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
  assert.match(python, /__PULSE_WAVE_PAYLOAD__/);
  assert.match(python, /largest_spike/);
  assert.match(python, /largest_drop/);
  assert.match(python, /Fewer than 8 time points/);
  assert.match(python, /components\.html\(vdab_weeklyrevenuepulse_html, height=520, scrolling=False\)/);
});

test("PulseWaveStoryPreview_MapsEveryOptionalRoleAndVisualSetting", () => {
  const python = generate(createPulseWaveStory({
    properties: {
      ...defaultProperties(),
      metricValue: axis("revenue", "continuous", "max"),
      baselineValue: axis("target_revenue", "continuous", "min"),
      eventName: axis("event_name", "categorical"),
      eventType: axis("event_type", "categorical"),
      impactScore: axis("impact_score", "continuous", "sum"),
      aggregationMethod: "avg",
      showBaseline: false,
      showEvents: false,
      showAnomalyMarkers: false,
      fillUnderWave: false,
    },
  }));

  assert.match(python, /MAX\(`revenue`\) AS metric_value/);
  assert.match(python, /MIN\(`target_revenue`\) AS baseline_value/);
  assert.match(python, /SUM\(`impact_score`\) AS impact_score/);
  assert.match(python, /'aggregation_method': 'avg'/);
  assert.match(python, /'show_baseline': False/);
  assert.match(python, /'show_events': False/);
  assert.match(python, /'show_anomaly_markers': False/);
  assert.match(python, /'fill_under_wave': False/);
  assert.match(python, /_events\.append\(_vdab_event\)/);
});

test("PulseWaveStoryInput_PreservesIncompleteAndLakebaseBindings", () => {
  const incompletePython = generate(createPulseWaveStory({
    properties: { ...defaultProperties(), baselineValue: axis("", "continuous") },
  }));
  const lakebasePython = generate(createPulseWaveStory({ bindings: createLakebaseBinding() }));

  assert.match(incompletePython, /Map the required PulseWaveStory fields/);
  assert.doesNotMatch(incompletePython, /query_statement=/);
  assert.match(lakebasePython, /_vdab_sql_query_df\(/);
  assert.match(lakebasePython, /source_kind='lakebaseAutoscaling', database='appdb'/);
});

test("PulseWaveStoryInput_RejectsMalformedPropertiesBindingsAndShape", () => {
  const invalidComponents: ProjectComponent[] = [
    createPulseWaveStory({ properties: { ...defaultProperties(), unknown: true } }),
    createPulseWaveStory({ properties: { ...defaultProperties(), metricName: 12 } }),
    createPulseWaveStory({ properties: { ...defaultProperties(), aggregationMethod: "median" } }),
    createPulseWaveStory({ properties: { ...defaultProperties(), timeField: axis("period", "continuous") } }),
    createPulseWaveStory({ properties: { ...defaultProperties(), eventName: axis("event_name", "categorical", "max") } }),
    createPulseWaveStory({ properties: { ...defaultProperties(), metricValue: axis("target_revenue", "continuous", "yearly") } }),
    createPulseWaveStory({ properties: { ...defaultProperties(), baselineValue: axis("event_name", "continuous", "avg") } }),
    createPulseWaveStory({ properties: { ...defaultProperties(), metricValue: axis("missing_value", "continuous", "sum") } }),
    createPulseWaveStory({ children: ["nested-child"] }),
    createPulseWaveStory({ layout: { columns: 2 } }),
    createPulseWaveStory({ bindings: { ...createUnityCatalogBinding(), workspaceHost: "https://outside.invalid" } }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    );
  }
});

test("PulseWaveStoryPreview_RejectsMalformedPersistedComponent", () => {
  for (const component of [
    createPulseWaveStory({ properties: { ...defaultProperties(), showEvents: "true" } }),
    createPulseWaveStory({ properties: { ...defaultProperties(), eventType: axis("event_type", "categorical", "count") } }),
    createPulseWaveStory({ schemaVersion: 2 }),
  ]) {
    assert.throws(
      () => generate(component),
      (error: unknown) => error instanceof ApplicationError && error.status === 422 &&
        error.code === "invalid_pulse_wave_story_properties",
    );
  }
});

test("PulseWaveStoryCanvas_SupportsKeyboardPointInspectionAndAnnouncements", () => {
  assert.match(PULSE_WAVE_STORY_HTML, /role="group" tabindex="0" aria-describedby="hint"/);
  assert.match(PULSE_WAVE_STORY_HTML, /ArrowRight/);
  assert.match(PULSE_WAVE_STORY_HTML, /ArrowLeft/);
  assert.match(PULSE_WAVE_STORY_HTML, /aria-live="polite"/);
  assert.match(PULSE_WAVE_STORY_HTML, /function pointDetails\(index\)/);
  assert.match(PULSE_WAVE_STORY_HTML, /announcer\.textContent=pointDetails\(keyboardIndex\)/);
  assert.match(PULSE_WAVE_STORY_HTML, /const result=Object\.create\(null\)/);
  assert.match(PULSE_WAVE_STORY_HTML, /Math\.max\(0,Math\.min\(6,num\(event\.impact_score,40\)\/20\)\)/);
  assert.match(PULSE_WAVE_STORY_HTML, /event\.key==='Escape'/);
  assert.match(PULSE_WAVE_STORY_HTML, /event\.key==='Home'/);
  assert.match(PULSE_WAVE_STORY_HTML, /function esc\(s\)/);
});

test("PulseWaveStoryCanvas_KeyboardSelectionAnnouncesMappedPointDetails", () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const bounds = { left: 0, top: 0, width: 800, height: 520 };
  const canvasContext = {
    setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {},
    lineTo() {}, stroke() {}, fill() {}, save() {}, restore() {}, bezierCurveTo() {},
    closePath() {}, fillText() {}, translate() {}, rotate() {}, arc() {},
    setLineDash() {}, rect() {}, clip() {},
  };
  const wrapper = { getBoundingClientRect: () => bounds };
  const canvas = {
    parentElement: wrapper,
    getContext: () => canvasContext,
    getBoundingClientRect: () => bounds,
    addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler),
  };
  const tooltip = { style: { display: "", left: "", top: "" } };
  const warning = { textContent: "" };
  const announcer = { textContent: "" };
  const elements = new Map<string, object>([
    ["c", canvas], ["tip", tooltip], ["warn", warning], ["announce", announcer],
  ]);
  const script = /<script>([\s\S]*?)<\/script>/.exec(PULSE_WAVE_STORY_HTML)?.[1];
  assert.ok(script);
  const payload = {
    records: [
      { time_period: "__proto__", metric_value: 42, baseline_value: 40 },
      { time_period: "2026-10-20", metric_value: 50, baseline_value: 45 },
    ],
    events: [{ time_period: "__proto__", event_name: "Prototype event" }],
    summary: { warnings: [] },
  };

  new vm.Script(script.replace("__PULSE_WAVE_PAYLOAD__", JSON.stringify(payload))).runInNewContext({
    document: { getElementById: (id: string) => elements.get(id) },
    window: { devicePixelRatio: 1, addEventListener() {} },
  });

  listeners.get("keydown")?.({ key: "ArrowRight", preventDefault() {} });
  assert.equal(
    announcer.textContent,
    "__proto__. Metric 42. Baseline 40. Event Prototype event.",
  );
  listeners.get("keydown")?.({ key: "Enter", preventDefault() {} });
  assert.match(announcer.textContent, /^Selected\./);
  listeners.get("keydown")?.({ key: "ArrowRight", preventDefault() {} });
  assert.match(announcer.textContent, /^2026-10-20\./);
  listeners.get("keydown")?.({ key: "Escape", preventDefault() {} });
  assert.equal(announcer.textContent, "Chart selection cleared.");
});

function generate(component: ProjectComponent): string {
  return new ProjectPreviewGenerator().generate(project, {
    projectId: project.id,
    version: 1,
    components: [component],
  }).files[0]?.content ?? "";
}

function createPulseWaveStory(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "pulse-wave-main",
    type: "PulseWaveStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "weeklyRevenuePulse",
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
    title: "Weekly Revenue Pulse",
    metricName: "Revenue",
    timeField: axis("period", "categorical"),
    metricValue: axis("revenue", "continuous", "sum"),
    baselineValue: axis("target_revenue", "continuous", "avg"),
    eventName: axis("event_name", "categorical"),
    eventType: axis("event_type", "categorical"),
    impactScore: axis("impact_score", "continuous", "avg"),
    aggregationMethod: "sum",
    showBaseline: true,
    showEvents: true,
    showAnomalyMarkers: true,
    fillUnderWave: true,
  };
}

function axis(field: string, scaleType: "categorical" | "continuous", transform = "none") {
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
          schema: "analytics",
          table: "weekly_revenue",
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
          table: "weekly_revenue",
          dataSourceFormat: null,
          primaryKeyColumn: null,
          columns,
        },
      },
    },
  };
}
