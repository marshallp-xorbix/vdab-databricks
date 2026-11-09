import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectSummary } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { readComponentsInput } from "../src/db/project-components-input.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { ProjectPreviewGenerator } from "../src/generation/project-preview-generator.ts";

const project: ProjectSummary = {
  id: "project-model-chat",
  name: "Support assistant",
  description: null,
  version: 1,
  createdBy: "owner-1",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  callerRole: "owner",
};

test("ModelChatSave_NormalizesDefaultsAndUsesAppResourceEnvBinding", () => {
  const component = createModelChat({
    properties: {
      servingEndpointAppResourceName: "support-chat",
      title: "Support chat",
      showBorder: true,
      chatTotalHeightPixels: 720,
    },
  });
  const saved = readComponentsInput({ version: 1, components: [component] });
  assert.deepEqual(saved.components[0]?.properties, component.properties);

  const source = generate(component);
  assert.match(source, /SERVING_ENDPOINT_SUPPORT_CHAT/);
  assert.match(source, /os\.environ\[serving_endpoint_env_var\]/);
  assert.match(source, /st\.context\.headers\.get\('x-forwarded-access-token', ''\)/);
  assert.match(source, /\/serving-endpoints\/\{endpoint_path\}\/invocations/);
  assert.doesNotMatch(
    source,
    /WorkspaceClient|DATABRICKS_TOKEN|DATABRICKS_CLIENT_SECRET/,
  );
});

test("ModelChatInput_NormalizesUnselectedDefaultsAndRejectsUnsafeProperties", () => {
  const saved = readComponentsInput({
    version: 1,
    components: [createModelChat({ properties: { title: "Support" } })],
  });
  assert.deepEqual(saved.components[0]?.properties, {
    servingEndpointAppResourceName: "",
    title: "Support",
    showBorder: false,
    chatTotalHeightPixels: 600,
  });

  const invalidComponents = [
    createModelChat({
      properties: {
        ...selectedProperties(),
        servingEndpointAppResourceName: "https://outside.invalid",
      },
    }),
    createModelChat({
      properties: {
        ...selectedProperties(),
        servingEndpointAppResourceName: "endpoint/name",
      },
    }),
    createModelChat({
      properties: { ...selectedProperties(), workspaceHost: "https://outside.invalid" },
    }),
    createModelChat({ properties: { ...selectedProperties(), title: "" } }),
    createModelChat({ properties: { ...selectedProperties(), showBorder: "true" } }),
    createModelChat({
      properties: { ...selectedProperties(), chatTotalHeightPixels: 2001 },
    }),
    createModelChat({
      properties: { ...selectedProperties(), databricksAccessToken: "secret" },
    }),
    createModelChat({ children: ["nested"] }),
    createModelChat({ bindings: { workspaceUrl: "https://outside.invalid" } }),
    createModelChat({ layout: { columns: 2 } }),
    createModelChat({ schemaVersion: 2 }),
  ];

  for (const component of invalidComponents) {
    assert.throws(
      () => readComponentsInput({ version: 1, components: [component] }),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
      JSON.stringify(component),
    );
  }
});

test("ModelChatPreview_RejectsMalformedPropertiesAndExplainsMissingResource", () => {
  const invalidProperties = [
    { ...selectedProperties(), servingEndpointAppResourceName: "outside/name" },
    { ...selectedProperties(), chatTotalHeightPixels: 300.5 },
    { ...selectedProperties(), servicePrincipalToken: "secret" },
  ];

  for (const properties of invalidProperties) {
    assert.throws(
      () => generate(createModelChat({ properties })),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.status === 422 &&
        error.code === "invalid_model_chat_properties",
    );
  }

  const incomplete = generate(
    createModelChat({ properties: { title: "Choose an endpoint" } }),
  );
  assert.match(
    incomplete,
    /Bind this Model Chat to a serving endpoint app resource/,
  );
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
    servingEndpointAppResourceName: "support-chat",
    title: "Support chat",
    showBorder: true,
    chatTotalHeightPixels: 720,
  };
}

function createModelChat(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "model-chat-main",
    type: "ModelChat",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "modelChat1",
    description: null,
    properties: selectedProperties(),
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}
