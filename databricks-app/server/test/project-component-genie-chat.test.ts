import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";

const project: ProjectSummary = {
  id: "project-genie-chat",
  name: "Workspace Genie",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  callerRole: "owner",
};

test("GenieChatSave_NormalizesDefaultsAndMatchesViewerAuthorizedFixture", async () => {
  const component = createGenieChat({
    properties: {
      genieSpaceId: "0123456789abcdef0123456789abcdef",
      genieSpaceTitle: "Revenue Genie",
      title: "Revenue questions",
      showBorder: true,
      chatTotalHeightPixels: 720,
    },
  });
  const saved = readComponentsInput({ version: 1, components: [component] });
  assert.deepEqual(saved.components[0]?.properties, component.properties);

  const source = generate(component);
  const fixture = await readFile(new URL(
    "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/genie-chat-app.py",
    import.meta.url,
  ), "utf8");
  assert.equal(source, fixture);
  assert.match(source, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
  assert.match(source, /os\.environ\.get\('DATABRICKS_HOST', ''\)/);
  assert.match(source, /start-conversation/);
  assert.match(source, /\/attachments\/\{urllib\.parse\.quote\(safe_attachment_id/);
  assert.match(source, /_VDAB_GENIE_MAX_HISTORY = 200/);
  assert.match(source, /_VDAB_GENIE_MAX_HISTORY_BYTES = 5000000/);
  assert.match(source, /_VDAB_GENIE_MAX_RESULT_BYTES = 200000/);
  assert.match(source, /_VDAB_GENIE_MAX_ATTACHMENTS = 20/);
  assert.match(source, /_VDAB_GENIE_POLL_WINDOW_SECONDS = 30/);
  assert.match(source, /_VDAB_GENIE_MAX_WAIT_SECONDS = 600/);
  assert.match(source, /class _VDABGenieNoRedirectHandler/);
  assert.match(source, /_VDAB_GENIE_OPENER\.open\(request, timeout=20\)/);
  assert.doesNotMatch(source, /urllib\.request\.urlopen/);
  assert.match(source, /statement_response/);
  assert.doesNotMatch(source, /WorkspaceClient|genie_space_app_resource|DATABRICKS_TOKEN|DATABRICKS_CLIENT_SECRET/);
  assert.doesNotMatch(source, /response\.text|error\.read\(|next_chunk_internal_link/);
});

test("GenieChatInput_NormalizesUnselectedSpaceDefaultsAndRejectsUnsafePropertiesAndShape", () => {
  const defaulted = readComponentsInput({
    version: 1,
    components: [createGenieChat({ properties: { title: "Support" } })],
  });
  assert.deepEqual(defaulted.components[0]?.properties, {
    genieSpaceId: "",
    genieSpaceTitle: "",
    title: "Support",
    showBorder: false,
    chatTotalHeightPixels: 600,
  });

  const invalidComponents = [
    createGenieChat({ properties: { genieSpaceId: "not-an-id", genieSpaceTitle: "Revenue", title: "Chat", showBorder: false, chatTotalHeightPixels: 600 } }),
    createGenieChat({ properties: { genieSpaceId: "0123456789abcdef0123456789abcdef", genieSpaceTitle: "", title: "Chat", showBorder: false, chatTotalHeightPixels: 600 } }),
    createGenieChat({ properties: { genieSpaceId: "", genieSpaceTitle: "Revenue", title: "Chat", showBorder: false, chatTotalHeightPixels: 600 } }),
    createGenieChat({ properties: { ...selectedProperties(), workspaceHost: "https://outside.invalid" } }),
    createGenieChat({ properties: { ...selectedProperties(), title: "" } }),
    createGenieChat({ properties: { ...selectedProperties(), showBorder: "true" } }),
    createGenieChat({ properties: { ...selectedProperties(), chatTotalHeightPixels: 2001 } }),
    createGenieChat({ properties: { ...selectedProperties(), databricksAccessToken: "secret" } }),
    createGenieChat({ children: ["nested"] }),
    createGenieChat({ bindings: { workspaceUrl: "https://outside.invalid" } }),
    createGenieChat({ layout: { columns: 2 } }),
    createGenieChat({ schemaVersion: 2 }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    );
  }
});

test("GenieChatPreview_RejectsMalformedSavedPropertiesAndRequiresCurrentWorkspaceSpace", () => {
  const invalidProperties = [
    { ...selectedProperties(), genieSpaceId: "outside" },
    { ...selectedProperties(), genieSpaceTitle: "" },
    { ...selectedProperties(), chatTotalHeightPixels: 300.5 },
    { ...selectedProperties(), servicePrincipalToken: "secret" },
  ];

  for (const properties of invalidProperties) {
    assert.throws(
      () => generate(createGenieChat({ properties })),
      (error: unknown) => error instanceof ApplicationError &&
        error.status === 422 && error.code === "invalid_genie_chat_properties",
    );
  }

  const incomplete = generate(createGenieChat({ properties: { ...selectedProperties(), genieSpaceId: "", genieSpaceTitle: "" } }));
  assert.match(incomplete, /Select a Genie space from the current workspace/);
  assert.doesNotMatch(incomplete, /WorkspaceClient|genie_space_app_resource/);
});

function generate(component: ProjectComponent): string {
  return new ProjectPreviewGenerator().generate(project, {
    projectId: project.id,
    version: 1,
    components: [component],
  }).files[0]?.content ?? "";
}

function selectedProperties() {
  return {
    genieSpaceId: "0123456789abcdef0123456789abcdef",
    genieSpaceTitle: "Revenue Genie",
    title: "Revenue questions",
    showBorder: true,
    chatTotalHeightPixels: 720,
  };
}

function createGenieChat(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "genie-chat-main",
    type: "GenieChat",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "genieChat1",
    description: null,
    properties: selectedProperties(),
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}
