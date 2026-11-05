import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import {
  CALLER,
  createClientHarness,
  jsonResponse,
} from "./workspace-app-deployment-client-test-support.ts";

test("WorkspaceAppDeploymentClient_CreateApp_SendsMultipleRequiredResources", async () => {
  const resources = [
    {
      name: "vdab-pg-0123456789abcdef",
      description: "Lakebase one",
      postgres: {
        branch: "projects/project-one/branches/branch-one",
        database:
          "projects/project-one/branches/branch-one/databases/database-one",
        permission: "CAN_CONNECT_AND_CREATE" as const,
      },
    },
    {
      name: "vdab-db-fedcba9876543210",
      description: "Lakebase two",
      database: {
        instance_name: "existing-instance",
        database_name: "databricks_postgres",
        permission: "CAN_CONNECT_AND_CREATE" as const,
      },
    },
    {
      name: "vdab-wh-0123456789abcdef",
      description: "VDAB default SQL warehouse",
      sql_warehouse: {
        id: "warehouse-123",
        permission: "CAN_USE" as const,
      },
    },
  ];

  const response = jsonResponse({
    id: "child-app-id",
    name: "child-app",
    space: null,
    resources,
  });
  const harness = createClientHarness([response]);
  const app = await harness.client.createApp(
    CALLER,
    "child-app",
    "marker",
    [],
    resources,
    null,
  );
  const requestBody = JSON.parse(String(harness.calls[0]?.init.body)) as Record<
    string,
    unknown
  >;

  assert.deepEqual(app.resources, resources);
  assert.deepEqual(requestBody.resources, resources);
  assert.equal(Object.hasOwn(requestBody, "space"), false);
});

test("WorkspaceAppDeploymentClient_CreateApp_SendsReadOnlySecretIdentifiersOnly", async () => {
  const secretResource = {
    name: "vdab-sec-0123456789abcdef",
    description: "VDAB secret read binding",
    secret: {
      scope: "service-scope",
      key: "api-key",
      permission: "READ" as const,
    },
  };
  const harness = createClientHarness([
    jsonResponse({
      id: "child-app-id",
      name: "child-app",
      space: null,
      resources: [secretResource],
    }),
  ]);

  await harness.client.createApp(
    CALLER,
    "child-app",
    "marker",
    [],
    [secretResource],
    null,
  );

  const requestBody = JSON.parse(String(harness.calls[0]?.init.body));
  assert.deepEqual(requestBody.resources, [secretResource]);
  assert.equal(JSON.stringify(requestBody).includes("secret-value"), false);
});

test("WorkspaceAppDeploymentClient_CreateApp_RejectsDuplicateResourceKeysBeforeMutation", async () => {
  const resource = {
    name: "vdab-pg-0123456789abcdef",
    description: "Lakebase database",
    postgres: {
      database:
        "projects/project-one/branches/branch-one/databases/database-one",
      permission: "CAN_CONNECT_AND_CREATE" as const,
    },
  };
  const harness = createClientHarness([]);

  await assert.rejects(
    harness.client.createApp(
      CALLER,
      "child-app",
      "marker",
      [],
      [resource, resource],
      null,
    ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "invalid_child_app_resource",
  );

  assert.equal(harness.calls.length, 0);
});

test("WorkspaceAppDeploymentClient_RoundTripsAdditionalDatabricksResourceKinds", async () => {
  const resources = [
    { name: "job-one", description: "Job", job: { id: "123", permission: "CAN_MANAGE_RUN" as const } },
    { name: "experiment-one", description: "Experiment", experiment: { experiment_id: "456", permission: "CAN_EDIT" as const } },
    { name: "genie-one", description: "Genie", genie_space: { name: "Sales", space_id: "abc123", permission: "CAN_RUN" as const } },
    { name: "serving-one", description: "Serving", serving_endpoint: { name: "model-endpoint", permission: "CAN_QUERY" as const } },
    { name: "catalog-one", description: "Catalog", uc_securable: { securable_full_name: "main.sales.orders", securable_type: "TABLE" as const, permission: "SELECT" as const } },
  ];
  const harness = createClientHarness([jsonResponse({ id: "child-app-id", name: "child-app", space: null, resources })]);
  const app = await harness.client.createApp(CALLER, "child-app", "marker", [], resources, null);
  const requestBody = JSON.parse(String(harness.calls[0]?.init.body)) as { resources: unknown[] };

  assert.deepEqual(requestBody.resources, resources);
  assert.deepEqual(app.resources, resources);
  assert.equal(app.unsupportedResourceCount, 0);
});
