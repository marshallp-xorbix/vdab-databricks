import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("ModelChatSave_NormalizesDefaultsAndMatchesViewerAuthorizedFixture", async () => {
  const component = createModelChat({
    properties: {
      servingEndpointName: "support-chat",
      title: "Support chat",
      showBorder: true,
      chatTotalHeightPixels: 720,
    },
  });
  const saved = readComponentsInput({ version: 1, components: [component] });
  assert.deepEqual(saved.components[0]?.properties, component.properties);

  const source = generate(component);
  const fixture = await readFile(new URL(
    "./fixtures/contracts/generated/model-chat-app.py",
    import.meta.url,
  ), "utf8");
  assert.equal(source, fixture);
  assert.match(source, /st\.context\.headers\.get\('x-forwarded-access-token', ''\)/);
  assert.match(source, /os\.environ\.get\('DATABRICKS_HOST', ''\)/);
  assert.match(source, /\/serving-endpoints\/\{endpoint_path\}\/invocations/);
  assert.match(source, /'messages': messages/);
  assert.match(source, /response_body\.get\('choices'\)/);
  assert.match(source, /_VDAB_MODEL_CHAT_MAX_HISTORY = 40/);
  assert.match(source, /_VDAB_MODEL_CHAT_MAX_RESPONSE_BYTES = 300000/);
  assert.match(source, /class _VDABModelChatNoRedirectHandler/);
  assert.match(source, /max_chars=_VDAB_MODEL_CHAT_MAX_INPUT_CHARS/);
  assert.doesNotMatch(source, /WorkspaceClient|serving_endpoint_app_resource|DATABRICKS_TOKEN|DATABRICKS_CLIENT_SECRET|response\.text|error\.read\(/);
});

test("ModelChatInput_NormalizesUnselectedDefaultsAndRejectsUnsafePropertiesAndShape", () => {
  const saved = readComponentsInput({
    version: 1,
    components: [createModelChat({ properties: { title: "Support" } })],
  });
  assert.deepEqual(saved.components[0]?.properties, {
    servingEndpointName: "",
    title: "Support",
    showBorder: false,
    chatTotalHeightPixels: 600,
  });

  const invalidComponents = [
    createModelChat({ properties: { ...selectedProperties(), servingEndpointName: "https://outside.invalid" } }),
    createModelChat({ properties: { ...selectedProperties(), servingEndpointName: "endpoint/name" } }),
    createModelChat({ properties: { ...selectedProperties(), workspaceHost: "https://outside.invalid" } }),
    createModelChat({ properties: { ...selectedProperties(), title: "" } }),
    createModelChat({ properties: { ...selectedProperties(), showBorder: "true" } }),
    createModelChat({ properties: { ...selectedProperties(), chatTotalHeightPixels: 2001 } }),
    createModelChat({ properties: { ...selectedProperties(), databricksAccessToken: "secret" } }),
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

test("ModelChatPreview_RejectsMalformedPropertiesAndExplainsMissingEndpoint", () => {
  const invalidProperties = [
    { ...selectedProperties(), servingEndpointName: "outside/name" },
    { ...selectedProperties(), chatTotalHeightPixels: 300.5 },
    { ...selectedProperties(), servicePrincipalToken: "secret" },
  ];

  for (const properties of invalidProperties) {
    assert.throws(
      () => generate(createModelChat({ properties })),
      (error: unknown) => error instanceof ApplicationError &&
        error.status === 422 && error.code === "invalid_model_chat_properties",
    );
  }

  const incomplete = generate(createModelChat({ properties: { title: "Choose an endpoint" } }));
  assert.match(incomplete, /Select a serving endpoint from this workspace in the builder/);
  assert.doesNotMatch(incomplete, /WorkspaceClient|serving_endpoint_app_resource/);
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
    servingEndpointName: "support-chat",
    title: "Support chat",
    showBorder: true,
    chatTotalHeightPixels: 720,
  };
}

function createModelChat(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
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
