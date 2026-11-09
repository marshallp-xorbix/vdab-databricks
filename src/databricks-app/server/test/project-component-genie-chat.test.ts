import assert from "node:assert/strict";
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

test("GenieChatSave_NormalizesDefaultsAndUsesAppResourceEnvBinding", () => {
  const component = createGenieChat({
    properties: {
      genieSpaceAppResourceName: "sales-genie",
      title: "Revenue questions",
      showBorder: true,
      chatTotalHeightPixels: 720,
    },
  });
  const saved = readComponentsInput({ version: 1, components: [component] });
  assert.deepEqual(saved.components[0]?.properties, component.properties);

  const source = generate(component);
  assert.match(source, /GENIE_SPACE_SALES_GENIE/);
  assert.match(source, /os\.environ\[genie_space_env_var\]/);
  assert.match(source, /st\.context\.headers\.get\('x-forwarded-access-token'\)/);
  assert.match(source, /_VDAB_GENIE_MAX_HISTORY = 200/);
  assert.doesNotMatch(source, /WorkspaceClient|DATABRICKS_TOKEN|DATABRICKS_CLIENT_SECRET/);
});

test("GenieChatInput_NormalizesUnselectedResourceDefaultsAndRejectsUnsafeProperties", () => {
  const defaulted = readComponentsInput({
    version: 1,
    components: [createGenieChat({ properties: { title: "Support" } })],
  });
  assert.deepEqual(defaulted.components[0]?.properties, {
    genieSpaceAppResourceName: "",
    title: "Support",
    showBorder: false,
    chatTotalHeightPixels: 600,
  });

  const invalidComponents = [
    createGenieChat({
      properties: {
        genieSpaceAppResourceName: "bad/name",
        title: "Chat",
        showBorder: false,
        chatTotalHeightPixels: 600,
      },
    }),
    createGenieChat({
      properties: { ...selectedProperties(), workspaceHost: "https://outside.invalid" },
    }),
    createGenieChat({ properties: { ...selectedProperties(), title: "" } }),
    createGenieChat({ properties: { ...selectedProperties(), showBorder: "true" } }),
    createGenieChat({
      properties: { ...selectedProperties(), chatTotalHeightPixels: 2001 },
    }),
    createGenieChat({
      properties: { ...selectedProperties(), databricksAccessToken: "secret" },
    }),
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

test("GenieChatPreview_RejectsMalformedSavedPropertiesAndExplainsMissingResource", () => {
  const invalidProperties = [
    { ...selectedProperties(), genieSpaceAppResourceName: "bad/name" },
    { ...selectedProperties(), chatTotalHeightPixels: 300.5 },
    { ...selectedProperties(), servicePrincipalToken: "secret" },
  ];

  for (const properties of invalidProperties) {
    assert.throws(
      () => generate(createGenieChat({ properties })),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_genie_chat_properties",
    );
  }

  const incomplete = generate(
    createGenieChat({
      properties: { ...selectedProperties(), genieSpaceAppResourceName: "" },
    }),
  );
  assert.match(incomplete, /Bind this Genie Chat to a Genie space app resource/);
  assert.doesNotMatch(incomplete, /WorkspaceClient/);
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

function selectedProperties() {
  return {
    genieSpaceAppResourceName: "sales-genie",
    title: "Revenue questions",
    showBorder: true,
    chatTotalHeightPixels: 720,
  };
}

function createGenieChat(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
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
