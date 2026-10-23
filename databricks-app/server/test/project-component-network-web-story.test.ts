import assert from "node:assert/strict";
import { readGeneratedPythonFixture } from "./generated-python-fixture.ts";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";
import { NETWORK_WEB_STORY_HTML } from "../src/generation/network-web-story-html.ts";

const project: ProjectSummary = {
  id: "project-network-web",
  name: "Supply chain graph",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

const columns = [
  { name: "source_id", type: "BIGINT", dataType: "BIGINT" },
  { name: "source_label", type: "STRING", dataType: "STRING" },
  { name: "target_id", type: "BIGINT", dataType: "BIGINT" },
  { name: "target_label", type: "STRING", dataType: "STRING" },
  { name: "relationship_type", type: "STRING", dataType: "STRING" },
  { name: "weight", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "snapshot_date", type: "DATE", dataType: "DATE" },
  { name: "direction", type: "STRING", dataType: "STRING" },
  { name: "edge_value", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
  { name: "frequency", type: "INT", dataType: "INTEGER" },
  { name: "edge_risk", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "edge_status", type: "STRING", dataType: "STRING" },
  { name: "source_category", type: "STRING", dataType: "STRING" },
  { name: "target_category", type: "STRING", dataType: "STRING" },
  { name: "source_value", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "target_value", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "source_health", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "target_health", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "source_risk", type: "DOUBLE", dataType: "DOUBLE" },
  { name: "target_risk", type: "DOUBLE", dataType: "DOUBLE" },
];

test("NetworkWebStoryPreview_MatchesLegacyGraphFixtureAndViewerQuery", async () => {
  const expectedPython = await readGeneratedPythonFixture(
    "network-web-story-app.py",
  );
  const python = generate(createNetworkWebStory());

  assert.equal(python, expectedPython);
  assert.match(python, /SELECT `source_id` AS source_entity_id/);
  assert.match(python, /`weight` AS relationship_weight/);
  assert.match(
    python,
    /WHERE `snapshot_date` = \(SELECT MAX\(`snapshot_date`\)/,
  );
  assert.match(
    python,
    /_vdab_sql_query_df\('main', 'supply', 'edges', 1000, query_statement=/,
  );
  assert.doesNotMatch(python, /LIMIT 1000/);
  assert.match(
    python,
    /st\.context\.headers\.get\('x-forwarded-access-token'\)/,
  );
  assert.match(python, /const payload = __NETWORK_WEB_PAYLOAD__/);
  assert.match(python, /Search nodes by label/);
  assert.match(python, /function neighborhood\(rootId, depth\)/);
  assert.match(python, /pointerdown/);
  assert.match(python, /searchEl\.addEventListener/);
  assert.match(python, /function esc\(s\)/);
  assert.match(
    python,
    /components\.html\(vdab_networkwebstory1_html, height=620, scrolling=False\)/,
  );
});

test("NetworkWebStoryCanvas_SupportsKeyboardAndAnnouncesStateChanges", () => {
  assert.match(
    NETWORK_WEB_STORY_HTML,
    /role="group" tabindex="0" aria-describedby="hint"/,
  );
  assert.match(
    NETWORK_WEB_STORY_HTML,
    /setAttribute\('aria-label','Toggle category /,
  );
  assert.match(NETWORK_WEB_STORY_HTML, /aria-pressed/);
  assert.match(NETWORK_WEB_STORY_HTML, /ArrowRight/);
  assert.match(NETWORK_WEB_STORY_HTML, /aria-live="polite"/);
  assert.match(
    NETWORK_WEB_STORY_HTML,
    /announcer\.textContent='Focused node '/,
  );
  assert.match(NETWORK_WEB_STORY_HTML, /document\.createElement\('button'\)/);
});

test("NetworkWebStoryPreview_MapsEveryOptionalRoleAndAppearanceSetting", () => {
  const python = generate(
    createNetworkWebStory({
      properties: {
        ...defaultProperties(),
        layoutAlgorithm: "radial",
        nodeSizeBy: "value",
        nodeColorBy: "risk_score",
        edgeWidthBy: "frequency",
        edgeColorBy: "status",
        showArrows: false,
        highlightDepth: 3,
        minWeightFilter: 25.5,
        maxNodes: 120,
        maxEdges: 400,
      },
    }),
  );

  for (const alias of [
    "direction",
    "edge_value",
    "frequency",
    "edge_risk_score",
    "edge_status",
    "source_category",
    "target_category",
    "source_value",
    "target_value",
    "source_health_score",
    "target_health_score",
    "source_risk_score",
    "target_risk_score",
  ]) {
    assert.match(python, new RegExp(`AS ${alias}`));
  }
  assert.match(python, /'layout_algorithm': 'radial'/);
  assert.match(python, /'node_size_by': 'value'/);
  assert.match(python, /'node_color_by': 'risk_score'/);
  assert.match(python, /'edge_width_by': 'frequency'/);
  assert.match(python, /'edge_color_by': 'status'/);
  assert.match(python, /'show_arrows': False/);
  assert.match(python, /'highlight_depth': 3/);
  assert.match(python, /'min_weight_filter': 25\.5/);
  assert.match(python, /'max_nodes': 120/);
  assert.match(python, /'max_edges': 400/);
  assert.match(python, /_edge_map\[_vdab_key\]\['weight'\] \+= _vdab_weight/);
  assert.match(python, /\[:400\]/);
});

test("NetworkWebStoryInput_AcceptsAnyFiniteNonNegativeWeightThreshold", () => {
  const story = createNetworkWebStory({
    properties: { ...defaultProperties(), minWeightFilter: Number.MAX_VALUE },
  });

  assert.doesNotThrow(() =>
    readComponentsInput({ version: 1, components: [story] }),
  );
  assert.ok(
    generate(story).includes("'min_weight_filter': 1.7976931348623157e+308"),
  );
});

test("NetworkWebStoryPreview_PreservesIncompleteAndLakebaseBindings", () => {
  const incompletePython = generate(
    createNetworkWebStory({
      properties: {
        ...defaultProperties(),
        relationshipWeight: axis("", "continuous"),
      },
    }),
  );
  const lakebasePython = generate(
    createNetworkWebStory({ bindings: createLakebaseBinding() }),
  );

  assert.match(incompletePython, /Map the required NetworkWebStory fields/);
  assert.doesNotMatch(incompletePython, /query_statement=/);
  assert.match(lakebasePython, /_vdab_sql_query_df\(/);
  assert.match(
    lakebasePython,
    /source_kind='lakebaseAutoscaling', database='appdb'.*resource_environment_variable='VDAB_LAKEBASE_ENDPOINT_[A-F0-9]{16}'/,
  );
});

test("NetworkWebStoryInput_RejectsMalformedPropertiesBindingsAndShape", () => {
  const invalidComponents: ProjectComponent[] = [
    createNetworkWebStory({
      properties: { ...defaultProperties(), unknown: true },
    }),
    createNetworkWebStory({
      properties: {
        ...defaultProperties(),
        sourceEntityId: axis("source_id", "continuous"),
      },
    }),
    createNetworkWebStory({
      properties: {
        ...defaultProperties(),
        relationshipWeight: axis("weight", "continuous", "sum"),
      },
    }),
    createNetworkWebStory({
      properties: { ...defaultProperties(), layoutAlgorithm: "circular" },
    }),
    createNetworkWebStory({
      properties: { ...defaultProperties(), maxNodes: 501 },
    }),
    createNetworkWebStory({
      properties: { ...defaultProperties(), minWeightFilter: -1 },
    }),
    createNetworkWebStory({
      properties: {
        ...defaultProperties(),
        sourceEntityLabel: axis("missing_label", "categorical"),
      },
    }),
    createNetworkWebStory({
      properties: {
        ...defaultProperties(),
        edgeValue: axis("source_label", "continuous"),
      },
    }),
    createNetworkWebStory({ children: ["nested-child"] }),
    createNetworkWebStory({ layout: { columns: 2 } }),
    createNetworkWebStory({
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

test("NetworkWebStoryPreview_RejectsMalformedPersistedComponent", () => {
  for (const component of [
    createNetworkWebStory({
      properties: { ...defaultProperties(), showArrows: "true" },
    }),
    createNetworkWebStory({
      properties: { ...defaultProperties(), edgeColorBy: "external_value" },
    }),
    createNetworkWebStory({ schemaVersion: 2 }),
  ]) {
    assert.throws(
      () => generate(component),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_network_web_story_properties",
    );
  }
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

function createNetworkWebStory(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "network-web-main",
    type: "NetworkWebStory",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "networkWebStory1",
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
    title: "Supplier Network",
    sourceEntityId: axis("source_id", "categorical"),
    sourceEntityLabel: axis("source_label", "categorical"),
    targetEntityId: axis("target_id", "categorical"),
    targetEntityLabel: axis("target_label", "categorical"),
    relationshipType: axis("relationship_type", "categorical"),
    relationshipWeight: axis("weight", "continuous"),
    timeField: axis("snapshot_date", "categorical"),
    direction: axis("direction", "categorical"),
    edgeValue: axis("edge_value", "continuous"),
    frequency: axis("frequency", "continuous"),
    edgeRiskScore: axis("edge_risk", "continuous"),
    edgeStatus: axis("edge_status", "categorical"),
    sourceCategory: axis("source_category", "categorical"),
    targetCategory: axis("target_category", "categorical"),
    sourceValue: axis("source_value", "continuous"),
    targetValue: axis("target_value", "continuous"),
    sourceHealthScore: axis("source_health", "continuous"),
    targetHealthScore: axis("target_health", "continuous"),
    sourceRiskScore: axis("source_risk", "continuous"),
    targetRiskScore: axis("target_risk", "continuous"),
    layoutAlgorithm: "force",
    nodeSizeBy: "degree",
    nodeColorBy: "category",
    edgeWidthBy: "weight",
    edgeColorBy: "relationship_type",
    showArrows: true,
    highlightDepth: 1,
    minWeightFilter: 0,
    maxNodes: 300,
    maxEdges: 800,
  };
}

function axis(
  field: string,
  scaleType: "categorical" | "continuous",
  transform = "none",
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
          schema: "supply",
          table: "edges",
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
          table: "edges",
          dataSourceFormat: null,
          primaryKeyColumn: null,
          columns,
        },
      },
    },
  };
}
