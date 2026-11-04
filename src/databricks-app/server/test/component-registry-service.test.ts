import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import {
  ComponentRegistryService,
  validateComponentRegistry,
} from "../src/component-registry/component-registry-service.ts";

const registryFixturePath = resolve(
  import.meta.dirname,
  "./fixtures/contracts/http-v1/component-definitions-response.json",
);

test("ComponentRegistryService_ReturnsAllDefinitionsMatchingGoldenFixture", async () => {
  const service = new ComponentRegistryService();
  const registry = service.getRegistry();
  const fixtureText = await readFile(registryFixturePath, "utf8");
  const fixture: unknown = JSON.parse(fixtureText);

  assert.equal(registry.version, 1);
  assert.equal(registry.components.length, 33);
  assert.equal(new Set(registry.components.map((entry) => entry.type)).size, 33);
  assert.deepEqual(registry, fixture);
});

test("ComponentRegistryService_PreservesEightStoryDefaultsAndCurrentWorkspaceBindings", () => {
  const registry = new ComponentRegistryService().getRegistry();
  const stories = registry.components.filter((component) =>
    component.type.endsWith("Story"),
  );
  const storyTypes = stories.map((component) => component.type);

  assert.deepEqual(storyTypes, [
    "AmoebaStory",
    "NetworkWebStory",
    "TerrainStory",
    "HeatMapStory",
    "PulseWaveStory",
    "FlowFieldStory",
    "HoneycombStory",
    "SpiralStory",
  ]);
  assert.ok(stories.every((component) =>
    component.supportedBindings?.includes("unityCatalogTable"),
  ));
  assert.deepEqual(
    registry.bindingSchemas.map((schema) => schema.type),
    [
      "unityCatalogTable",
      "databricksVolume",
      "lakebaseProvisionedDatabase",
      "lakebaseAutoscaling",
    ],
  );
  const lakebaseSchema = registry.bindingSchemas.find(
    (schema) => schema.type === "lakebaseAutoscaling",
  );

  assert.deepEqual(lakebaseSchema?.defaultConfig.source, {
    kind: "resource",
    valueType: "table",
    resource: {
      type: "lakebaseAutoscaling",
      projectId: null,
      branchId: null,
      endpointId: null,
      database: null,
      catalog: null,
      schema: null,
      table: null,
      primaryKeyColumn: null,
    },
  });
});

test("ComponentRegistryService_ReturnsIndependentDefinitionCopies", () => {
  const service = new ComponentRegistryService();
  const firstDefinition = service.getDefinition("AmoebaStory");

  firstDefinition.props.title = "Caller mutation";

  assert.equal(service.getDefinition("AmoebaStory").props.title, "Amoeba Story");
});

test("ComponentRegistryService_UnknownTypeReturnsSanitizedNotFound", () => {
  const service = new ComponentRegistryService();

  assert.throws(
    () => service.getDefinition("UnknownComponent"),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 404 &&
      error.code === "component_definition_not_found" &&
      !error.message.includes("UnknownComponent"),
  );
});

test("ComponentRegistryService_RejectsAuthorityFieldsAndExternalHosts", () => {
  const service = new ComponentRegistryService();
  const hostileRegistry = structuredClone(
    service.getRegistry(),
  ) as unknown as MutableRegistry;
  const firstComponent = hostileRegistry.components[0];

  assert.ok(firstComponent);
  firstComponent.props.workspaceHost = "https://foreign.example.com";

  assert.throws(
    () => validateComponentRegistry(hostileRegistry),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 500 &&
      error.code === "component_registry_invalid" &&
      !error.message.includes("foreign.example.com"),
  );
});

test("ComponentRegistryService_RejectsUnknownBindingTypes", () => {
  const service = new ComponentRegistryService();
  const hostileRegistry = structuredClone(
    service.getRegistry(),
  ) as unknown as MutableRegistry;
  const firstBinding = hostileRegistry.bindingSchemas[0];

  assert.ok(firstBinding);
  firstBinding.type = "externalWorkspaceConnection";

  assert.throws(
    () => validateComponentRegistry(hostileRegistry),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 500 &&
      error.code === "component_registry_invalid",
  );
});

test("ComponentRegistryService_RejectsSnakeCaseAuthorityFieldsAndUnknownComponentBindings", () => {
  const service = new ComponentRegistryService();
  const hostileRegistry = structuredClone(
    service.getRegistry(),
  ) as unknown as MutableRegistry;
  const firstComponent = hostileRegistry.components[0];

  assert.ok(firstComponent);
  firstComponent.props.workspace_id = "other-workspace";
  firstComponent.supportedBindings = ["externalWorkspaceConnection"];

  assert.throws(
    () => validateComponentRegistry(hostileRegistry),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 500 &&
      error.code === "component_registry_invalid",
  );
});

interface MutableRegistry {
  components: Array<{
    props: Record<string, unknown>;
  } & Record<string, unknown>>;
  bindingSchemas: Array<Record<string, unknown>>;
  version: number;
}
