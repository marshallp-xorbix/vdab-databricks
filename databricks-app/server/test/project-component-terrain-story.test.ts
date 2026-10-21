import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";
import { TERRAIN_STORY_HTML } from "../src/generation/terrain-story-html.ts";

const project: ProjectSummary = {
  id: "project-terrain-story",
  name: "Production terrain",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  callerRole: "owner",
};

const columnDefinitions: ReadonlyArray<readonly [string, string]> = [
  ["month", "DATE"], ["line", "STRING"], ["part", "STRING"], ["output", "DOUBLE"],
  ["category", "STRING"], ["risk", "DOUBLE"], ["target", "DOUBLE"], ["baseline", "DOUBLE"],
  ["forecast", "DOUBLE"], ["volume", "INT"], ["status", "STRING"], ["event", "STRING"],
  ["event_date", "DATE"], ["callout", "STRING"],
];
const columns = columnDefinitions.map(([name, type]) => ({ name, type, dataType: type }));

test("TerrainStoryPreview_MatchesFixtureAndViewerAuthorizedGroupedQuery", async () => {
  const fixture = await readFile(new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/terrain-story-app.py",
    import.meta.url,
  ), "utf8");
  const python = generate(createTerrainStory());

  assert.equal(python, fixture);
  assert.match(python, /SELECT `line` AS x_value, `part` AS y_value, SUM\(`output`\) AS height_value/);
  assert.match(python, /MAX\(`category`\) AS category, MAX\(`status`\) AS status/);
  assert.match(python, /AVG\(`risk`\) AS risk_score, AVG\(`target`\) AS target_value/);
  assert.match(python, /MAX\(`month`\) FROM/);
  assert.match(python, /GROUP BY `line`, `part`/);
  assert.match(python, /_vdab_sql_query_df\('main', 'analytics', 'production_grid', 500, query_statement=/);
  assert.doesNotMatch(python, /LIMIT 500/);
  assert.match(python, /x-forwarded-access-token/);
  assert.match(python, /const payload = __TERRAIN_PAYLOAD__/);
  assert.match(python, /components\.html\(vdab_productionterrain_html, height=580, scrolling=False\)/);
});

test("TerrainStoryPreview_MapsOptionalFieldsAndAllVisualSettings", () => {
  const python = generate(createTerrainStory({ properties: {
    ...defaultProperties(),
    heightMetric: axis("output", "continuous", "max"),
    timeField: axis("month", "categorical"),
    terrainCategory: axis("category", "categorical"),
    riskScore: axis("risk", "continuous", "count"),
    targetValue: axis("target", "continuous", "min"),
    baselineValue: axis("baseline", "continuous", "max"),
    forecastValue: axis("forecast", "continuous", "avg"),
    volumeMetric: axis("volume", "continuous", "count_distinct"),
    status: axis("status", "categorical"),
    eventName: axis("event", "categorical"),
    eventDate: axis("event_date", "categorical"),
    calloutText: axis("callout", "categorical"),
    terrainMode: "ridge",
    heightScale: 2.4,
    interpolation: "none",
    gridResolution: 120,
    colorBy: "variance",
    showPeakLabels: false,
    showValleyLabels: false,
    cameraPreset: "top",
    aggregationMethod: "min",
  } }));

  for (const alias of ["category", "risk_score", "target_value", "baseline_value", "forecast_value", "volume_value", "status", "event_name", "event_date", "callout_text"]) {
    assert.match(python, new RegExp(`AS ${alias}`));
  }
  assert.match(python, /MAX\(`output`\) AS height_value/);
  assert.match(python, /COUNT\(`risk`\) AS risk_score/);
  assert.match(python, /COUNT\(DISTINCT `volume`\) AS volume_value/);
  assert.match(python, /'terrain_mode': 'ridge'/);
  assert.match(python, /'height_scale': 2\.4/);
  assert.match(python, /'grid_resolution': 120/);
  assert.match(python, /'show_peak_labels': False/);
  assert.match(python, /'camera_preset': 'top'/);
});

test("TerrainStoryInput_RejectsMalformedPropertiesBindingsAndShape", () => {
  const invalidComponents = [
    createTerrainStory({ properties: { ...defaultProperties(), unknown: true } }),
    createTerrainStory({ properties: { ...defaultProperties(), title: 23 } }),
    createTerrainStory({ properties: { ...defaultProperties(), heightScale: 0.05 } }),
    createTerrainStory({ properties: { ...defaultProperties(), heightScale: Number.POSITIVE_INFINITY } }),
    createTerrainStory({ properties: { ...defaultProperties(), gridResolution: 10.5 } }),
    createTerrainStory({ properties: { ...defaultProperties(), terrainMode: "contour" } }),
    createTerrainStory({ properties: { ...defaultProperties(), xDimension: axis("line", "categorical", "max") } }),
    createTerrainStory({ properties: { ...defaultProperties(), heightMetric: axis("output", "categorical", "sum") } }),
    createTerrainStory({ properties: { ...defaultProperties(), heightMetric: axis("output", "continuous", "sum; DROP TABLE") } }),
    createTerrainStory({ properties: { ...defaultProperties(), heightMetric: axis("outside", "continuous", "sum") } }),
    createTerrainStory({ properties: { ...defaultProperties(), heightMetric: axis("status", "continuous", "sum") } }),
    createTerrainStory({ children: ["nested"] }),
    createTerrainStory({ layout: { columns: 2 } }),
    createTerrainStory({ schemaVersion: 2 }),
    createTerrainStory({ bindings: { ...createUnityCatalogBinding(), workspaceHost: "https://outside.invalid" } }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    );
  }
});

test("TerrainStoryPreview_RejectsMalformedPersistedPropertiesAndRequiresMappings", () => {
  for (const component of [
    createTerrainStory({ properties: { ...defaultProperties(), cameraPreset: "orbit" } }),
    createTerrainStory({ properties: { ...defaultProperties(), showPeakLabels: "true" } }),
    createTerrainStory({ properties: { ...defaultProperties(), baselineValue: axis("baseline", "continuous", "avg; select") } }),
  ]) {
    assert.throws(
      () => generate(component),
      (error: unknown) => error instanceof ApplicationError && error.status === 422 &&
        error.code === "invalid_terrain_story_properties",
    );
  }

  const incomplete = generate(createTerrainStory({
    properties: { ...defaultProperties(), heightMetric: axis("", "continuous", "sum") },
  }));
  assert.match(incomplete, /Map the required TerrainStory fields/);
  assert.doesNotMatch(incomplete, /query_statement=/);
});

test("TerrainStoryPreview_PreservesLakebaseBindingWithExplicitLimitation", () => {
  const python = generate(createTerrainStory({ bindings: createLakebaseBinding() }));
  assert.match(python, /_vdab_sql_query_df\(/);
  assert.match(python, /source_kind='lakebaseAutoscaling', database='builder'/);
});

test("TerrainStoryCanvas_KeyboardCellInspectionAnnouncesDetailsAndEscapesTooltips", () => {
  assert.match(TERRAIN_STORY_HTML, /id="toolbar" aria-label="Terrain overlays"/);
  assert.match(TERRAIN_STORY_HTML, /aria-pressed="true"/);
  assert.match(TERRAIN_STORY_HTML, /tabindex="0" role="img"/);
  assert.match(TERRAIN_STORY_HTML, /ArrowRight/);
  assert.match(TERRAIN_STORY_HTML, /aria-live="polite"/);
  assert.match(TERRAIN_STORY_HTML, /function esc\(s\)/);
  assert.match(TERRAIN_STORY_HTML, /function drawHeat/);
  assert.match(TERRAIN_STORY_HTML, /function drawRidge/);
  assert.match(TERRAIN_STORY_HTML, /function drawSurface/);
  assert.match(TERRAIN_STORY_HTML, /dblclick/);

  const listeners = new Map<string, (event: unknown) => void>();
  const rectangle = { left: 0, top: 0, width: 800, height: 580 };
  const context = new Proxy({}, { get: (_target, name) => name === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => {} });
  const wrap = {
    clientWidth: 800,
    clientHeight: 580,
    getBoundingClientRect: () => rectangle,
  };
  const canvas = {
    width: 0,
    height: 0,
    style: { cursor: "" },
    parentElement: wrap,
    getContext: () => context,
    getBoundingClientRect: () => rectangle,
    addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler),
  };
  const announcer = { textContent: "" };
  const tip = { style: { display: "", left: "", top: "" }, innerHTML: "" };
  const button = { classList: { add() {}, toggle() {} }, setAttribute() {} };
  const elements = new Map<string, object>([
    ["wrap", wrap], ["c", canvas], ["tip", tip], ["announce", announcer],
    ["togPeaks", button], ["togValleys", button], ["togEvents", button],
  ]);
  const script = /<script>([\s\S]*?)<\/script>/.exec(TERRAIN_STORY_HTML)?.[1];
  assert.ok(script);
  new vm.Script(script.replace("__TERRAIN_PAYLOAD__", JSON.stringify({
    records: [{ x: "North", y: "West", height: 30, category: "Engine", risk_score: 75, variance: 5 }],
    callouts: [],
    visualConfig: { terrain_mode: "heat_surface" },
    summary: { top_peaks: [], bottom_valleys: [] },
  }))).runInNewContext({
    document: { getElementById: (id: string) => elements.get(id) },
    window: { devicePixelRatio: 1 },
    requestAnimationFrame() {},
  });

  listeners.get("keydown")?.({ key: "ArrowRight", preventDefault() {} });
  assert.match(announcer.textContent, /Cell 1 of 1\. Cell North by West\. Height 30\. Category Engine\. Risk 75\. Variance 5/);
  listeners.get("keydown")?.({ key: "Escape", preventDefault() {} });
  assert.equal(announcer.textContent, "Terrain cell selection cleared.");
});

function generate(component: ProjectComponent): string {
  return new ProjectPreviewGenerator().generate(project, {
    projectId: project.id,
    version: 1,
    components: [component],
  }).files[0]?.content ?? "";
}

function createTerrainStory(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "terrain-main",
    type: "TerrainStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "productionTerrain",
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
    title: "Production Terrain",
    xDimension: axis("line", "categorical"),
    yDimension: axis("part", "categorical"),
    heightMetric: axis("output", "continuous", "sum"),
    timeField: axis("month", "categorical"),
    terrainCategory: axis("category", "categorical"),
    riskScore: axis("risk", "continuous", "avg"),
    targetValue: axis("target", "continuous", "avg"),
    baselineValue: axis("baseline", "continuous", "avg"),
    forecastValue: axis("forecast", "continuous", "avg"),
    volumeMetric: axis("volume", "continuous", "sum"),
    status: axis("status", "categorical"),
    eventName: axis("event", "categorical"),
    eventDate: axis("event_date", "categorical"),
    calloutText: axis("callout", "categorical"),
    terrainMode: "surface",
    heightScale: 1,
    interpolation: "bilinear",
    gridResolution: 60,
    colorBy: "height_metric",
    showPeakLabels: true,
    showValleyLabels: true,
    cameraPreset: "angled",
    aggregationMethod: "sum",
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
          table: "production_grid",
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
          catalog: "main",
          schema: "analytics",
          table: "production_grid",
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
