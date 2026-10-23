import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
} from "../src/db/project-components-contract.ts";
import { PROJECT_COMPONENT_TYPES } from "../src/db/project-components-contract.ts";
import { ProjectComponentsService } from "../src/db/project-components-service.ts";
import type { ProjectComponentsRepository } from "../src/db/project-components-repository.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";
import {
  caller,
  RecordingComponentsRepository,
  validTextInput,
} from "./project-components-service-test-support.ts";

test("ProjectComponentsService_AcceptsCompleteAndIncompleteFileUploadVolumeBindings", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-file-upload", "project-1", {
    version: 3,
    components: [
      {
        key: "upload",
        type: "FileUpload",
        schemaVersion: 1,
        properties: { label: "Select files" },
        bindings: {
          databricksVolume: {
            bindingType: "databricksVolume",
            source: {
              kind: "resource",
              valueType: "file",
              resource: {
                type: "databricksVolume",
                catalog: "main",
                schema: "landing",
                volume: "incoming",
                filePath: "imports/2026",
              },
            },
          },
        },
      },
      {
        key: "incomplete-upload",
        type: "FileUpload",
        schemaVersion: 1,
        properties: { label: "Choose a destination later" },
        bindings: {
          databricksVolume: {
            bindingType: "databricksVolume",
            source: {
              kind: "resource",
              valueType: "file",
              resource: {
                type: "databricksVolume",
                catalog: "main",
                schema: null,
                volume: null,
                filePath: "",
              },
            },
          },
        },
      },
    ],
  });

  assert.equal(result.components[0]?.properties.label, "Select files");
  assert.deepEqual(
    result.components[0]?.bindings?.databricksVolume,
    repository.lastComponents[0]?.bindings?.databricksVolume,
  );
  assert.equal(result.components[1]?.bindings?.databricksVolume !== null, true);
});

test("ProjectComponentsService_AcceptsCompleteAndIncompleteUnityCatalogDataWindowBindings", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const binding = (catalog: string | null, schema: string | null, table: string | null) => ({
    unityCatalogTable: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          catalog,
          schema,
          table,
          primaryKeyColumn: null,
          columns: [{ name: "customer name", type: "STRING" }],
        },
      },
    },
  });
  const components: unknown[] = [
    {
      key: "data-window-complete",
      type: "DataWindow",
      schemaVersion: 1,
      properties: {
        label: "Customers",
        maxRows: 100,
        scrollable: true,
        placeholder: "(missing)",
        width: 800,
        hideIndex: false,
        height: "content",
      },
      bindings: binding("main", "default", "customers"),
    },
    {
      key: "data-window-incomplete",
      type: "DataWindow",
      schemaVersion: 1,
      properties: { label: "Choose table" },
      bindings: binding("main", null, null),
    },
  ];

  const result = await service.replaceComponents(
    caller,
    "request-data-window",
    "project-1",
    { version: 3, components },
  );

  assert.equal(result.components[0]?.properties.maxRows, 100);
  assert.deepEqual(result.components[0]?.bindings, repository.lastComponents[0]?.bindings);
  assert.equal(result.components[1]?.bindings?.unityCatalogTable !== null, true);
});

test("ProjectComponentsService_PersistsAutoscalingDatabaseIdAndRejectsUnsafeIds", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const component = {
    key: "lakebase-data-window",
    type: "DataWindow",
    schemaVersion: 1,
    properties: { label: "Lakebase table" },
    bindings: {
      lakebaseAutoscaling: {
        bindingType: "lakebaseAutoscaling",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "lakebaseAutoscaling",
            database: "appdb",
            databaseId: "database-one",
            projectId: "project-one",
            branchId: "branch-one",
            endpointId: "endpoint-one",
            schema: "public",
            table: "orders",
            columns: [{ name: "order_id", type: "BIGINT" }],
          },
        },
      },
    },
  };

  const saved = await service.replaceComponents(
    caller,
    "request-lakebase-binding",
    "project-1",
    { version: 3, components: [component] },
  );
  const resource = saved.components[0]?.bindings?.lakebaseAutoscaling as {
    source: { resource: { databaseId: string } };
  } | undefined;
  assert.equal(resource?.source.resource.databaseId, "database-one");

  const unsafeComponent = structuredClone(component);
  const unsafeBinding = unsafeComponent.bindings.lakebaseAutoscaling.source.resource;
  unsafeBinding.databaseId = "database/other-workspace";
  await assert.rejects(
    () => service.replaceComponents(
      caller,
      "request-lakebase-binding-invalid",
      "project-1",
      { version: 3, components: [unsafeComponent] },
    ),
    (error: unknown) => typeof error === "object" && error !== null &&
      "code" in error && error.code === "invalid_component_aggregate",
  );
  assert.equal(repository.replaceCalls, 1);
});

test("ProjectComponentsService_RejectsInvalidDataWindowPropertiesAndAuthorityBinding", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const invalidComponents = [
    { key: "bad-label", type: "DataWindow", schemaVersion: 1, properties: { label: " " } },
    { key: "bad-rows", type: "DataWindow", schemaVersion: 1, properties: { maxRows: -1 } },
    { key: "bad-width", type: "DataWindow", schemaVersion: 1, properties: { width: "wide" } },
    {
      key: "authority-binding",
      type: "DataWindow",
      schemaVersion: 1,
      properties: { label: "Table" },
      bindings: { unityCatalogTable: { workspaceHost: "https://outside.invalid" } },
    },
  ];

  for (const component of invalidComponents) {
    await assert.rejects(
      () => service.replaceComponents(
        caller,
        "request-data-window-invalid",
        "project-1",
        { version: 3, components: [component] },
      ),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_SavesEditableDataWindowOptionsAndPrimaryKeyBinding", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const component = {
    key: "editable-customers",
    type: "EditableDataWindow",
    schemaVersion: 1,
    properties: {
      label: "Editable customers",
      maxRows: 75,
      scrollable: false,
      placeholder: "No rows",
      disabled: false,
      numRows: "dynamic",
      hideIndex: true,
      width: "stretch",
      height: "content",
    },
    bindings: {
      unityCatalogTable: {
        bindingType: "unityCatalogTable",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "unityCatalogTable",
            catalog: "main",
            schema: "default",
            table: "customers",
            dataSourceFormat: "DELTA",
            primaryKeyColumn: "customer_id",
            columns: [
              { name: "customer_id", type: "BIGINT", dataType: "LONG" },
              { name: "customer name", type: "STRING", dataType: "STRING" },
            ],
          },
        },
      },
    },
  };

  const result = await service.replaceComponents(
    caller,
    "request-editable-data-window",
    "project-1",
    { version: 3, components: [component] },
  );

  assert.equal(result.components[0]?.properties.numRows, "dynamic");
  assert.equal(result.components[0]?.properties.disabled, false);
  assert.equal(result.components[0]?.bindings?.unityCatalogTable !== undefined, true);
});

test("ProjectComponentsService_RejectsEditableDataWindowWithoutValidPrimaryKeyOrOptions", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const binding = (primaryKeyColumn: string | null) => ({
    unityCatalogTable: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          catalog: "main",
          schema: "default",
          table: "customers",
          dataSourceFormat: "DELTA",
          primaryKeyColumn,
          columns: [{ name: "customer_id", type: "BIGINT", dataType: "LONG" }],
        },
      },
    },
  });
  const invalidComponents: unknown[] = [
    { key: "bad-mode", type: "EditableDataWindow", schemaVersion: 1, properties: { numRows: "unbounded" } },
    { key: "bad-disabled", type: "EditableDataWindow", schemaVersion: 1, properties: { disabled: "false" } },
    { key: "missing-key", type: "EditableDataWindow", schemaVersion: 1, properties: {}, bindings: binding(null) },
    { key: "unknown-key", type: "EditableDataWindow", schemaVersion: 1, properties: {}, bindings: binding("missing") },
  ];

  for (const component of invalidComponents) {
    await assert.rejects(
      () => service.replaceComponents(
        caller,
        "request-editable-data-window-invalid",
        "project-1",
        { version: 3, components: [component] },
      ),
      (error: unknown) =>
        typeof error === "object" && error !== null &&
        "code" in error && error.code === "invalid_component_aggregate",
    );
  }
  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_RejectsUnsafeFileUploadBindingsAndLabels", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const volumeBinding = (filePath: string) => ({
    databricksVolume: {
      bindingType: "databricksVolume",
      source: {
        kind: "resource",
        valueType: "file",
        resource: {
          type: "databricksVolume",
          catalog: "main",
          schema: "landing",
          volume: "incoming",
          filePath,
        },
      },
    },
  });
  const invalidRequests: unknown[] = [
    { label: "  " },
    { label: "Upload", workspaceHost: "https://outside.invalid" },
  ].map((properties) => ({
    version: 3,
    components: [{ key: "upload", type: "FileUpload", schemaVersion: 1, properties }],
  }));

  for (const filePath of ["../escape", "a/../../escape", "/absolute", "folder\\name"]) {
    invalidRequests.push({
      version: 3,
      components: [{
        key: "upload",
        type: "FileUpload",
        schemaVersion: 1,
        properties: { label: "Upload" },
        bindings: volumeBinding(filePath),
      }],
    });
  }

  const invalidResourceNameBinding = volumeBinding("imports");
  invalidResourceNameBinding.databricksVolume.source.resource.catalog = "main/other";
  invalidRequests.push({
    version: 3,
    components: [{
      key: "upload",
      type: "FileUpload",
      schemaVersion: 1,
      properties: { label: "Upload" },
      bindings: invalidResourceNameBinding,
    }],
  });

  invalidRequests.push({
    version: 3,
    components: [{
      key: "upload",
      type: "FileUpload",
      schemaVersion: 1,
      properties: { label: "Upload" },
      bindings: {
        databricksVolume: {
          ...volumeBinding("imports").databricksVolume,
          workspaceHost: "https://outside.invalid",
        },
      },
    }],
  });

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-file-upload-invalid", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

