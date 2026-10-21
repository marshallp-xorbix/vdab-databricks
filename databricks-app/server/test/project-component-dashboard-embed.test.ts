import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";

const project: ProjectSummary = {
  id: "project-dashboard-embed",
  name: "Quarterly overview",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  callerRole: "owner",
};

test("DashboardEmbedSave_NormalizesHostAndWorkspaceId_AndMatchesGeneratedFixture", async () => {
  const component = createDashboardEmbed({
    properties: {
      src: "https://former-workspace.cloud.databricks.com/embed/dashboardsv3/dashboard_12?o=123456&fullscreenWidget=page_1~widget_2",
      height: 720,
      scrolling: false,
    },
  });
  const saved = readComponentsInput({ version: 1, components: [component] });
  const normalized = saved.components[0];
  assert.equal(
    normalized?.properties.src,
    "/embed/dashboardsv3/dashboard_12?fullscreenWidget=page_1~widget_2",
  );
  assert.equal(normalized?.properties.height, 720);
  assert.equal(normalized?.properties.scrolling, false);

  const source = generate(component);
  const fixture = await readFile(new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/dashboard-embed-app.py",
    import.meta.url,
  ), "utf8");
  assert.equal(source, fixture);
  assert.match(source, /os\.environ\.get\('DATABRICKS_HOST', ''\)/);
  assert.match(source, /os\.environ\.get\('DATABRICKS_WORKSPACE_ID', ''\)/);
  assert.match(source, /urllib\.parse\.urlencode\(_vdab_dashboard_query\)/);
  assert.match(source, /components\.iframe\(_vdab_dashboard_src, height=720, scrolling=False\)/);
  assert.match(source, /_vdab_dashboard_workspace_id\.isascii\(\).*len\(_vdab_dashboard_workspace_id\) > 32/);
  assert.match(source, /individual data permissions/);
  assert.match(source, /workspace admin must allow this app domain/);
  assert.doesNotMatch(source, /former-workspace\.cloud\.databricks\.com|123456/);
  assert.doesNotMatch(source, /DATABRICKS_CLIENT_SECRET|DATABRICKS_TOKEN/);
});

test("DashboardEmbedInput_RejectsUnsafeURLsPropertiesAndComponentShape", () => {
  const invalidComponents = [
    createDashboardEmbed({ properties: { src: "http://workspace.cloud.databricks.com/embed/dashboardsv3/id" } }),
    createDashboardEmbed({ properties: { src: "https://user:pass@workspace.cloud.databricks.com/embed/dashboardsv3/id" } }),
    createDashboardEmbed({ properties: { src: "//workspace.cloud.databricks.com/embed/dashboardsv3/id" } }),
    createDashboardEmbed({ properties: { src: "https://workspace.cloud.databricks.com/dashboardsv3/id" } }),
    createDashboardEmbed({ properties: { src: "/embed/dashboardsv3/id/extra" } }),
    createDashboardEmbed({ properties: { src: "/embed/dashboardsv3/id?token=secret" } }),
    createDashboardEmbed({ properties: { src: "/embed/dashboardsv3/id?fullscreenWidget=invalid" } }),
    createDashboardEmbed({ properties: { src: "/embed/dashboardsv3/id", height: 299 } }),
    createDashboardEmbed({ properties: { src: "/embed/dashboardsv3/id", height: 2001 } }),
    createDashboardEmbed({ properties: { src: "/embed/dashboardsv3/id", scrolling: "false" } }),
    createDashboardEmbed({ properties: { src: "/embed/dashboardsv3/id", workspaceHost: "https://other.invalid" } }),
    createDashboardEmbed({ children: ["child"] }),
    createDashboardEmbed({ bindings: { workspaceUrl: "https://other.invalid" } }),
    createDashboardEmbed({ layout: { columns: 2 } }),
    createDashboardEmbed({ schemaVersion: 2 }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    );
  }
});

test("DashboardEmbedPreview_RejectsMalformedPersistedPropertiesAndUsesCurrentWorkspaceOnly", () => {
  const invalidProperties = [
    { src: "https://workspace.cloud.databricks.com/embed/dashboardsv3/id#fragment", height: 600, scrolling: true },
    { src: "/embed/dashboardsv3/id?target=https://other.invalid", height: 600, scrolling: true },
    { src: "/embed/dashboardsv3/id", height: 600.5, scrolling: true },
  ];
  for (const properties of invalidProperties) {
    assert.throws(
      () => generate(createDashboardEmbed({ properties })),
      (error: unknown) => error instanceof ApplicationError &&
        error.status === 422 && error.code === "invalid_dashboard_embed_properties",
    );
  }

  const empty = generate(createDashboardEmbed({ properties: { src: "" } }));
  assert.match(empty, /st\.info\('Use a published dashboard embed link/);
  assert.doesNotMatch(empty, /components\.iframe\(/);
});

function generate(component: ProjectComponent): string {
  return new ProjectPreviewGenerator().generate(project, {
    projectId: project.id,
    version: 1,
    components: [component],
  }).files[0]?.content ?? "";
}

function createDashboardEmbed(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "dashboard-embed-main",
    type: "DashboardEmbed",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "dashboardEmbed1",
    description: null,
    properties: { src: "/embed/dashboardsv3/dashboard_12", height: 600, scrolling: true },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}
