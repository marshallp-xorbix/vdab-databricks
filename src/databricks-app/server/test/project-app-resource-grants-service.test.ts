import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity, WorkspaceAppResource } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { createHarness } from "./project-deployment-test-support.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CALLER: CallerIdentity = {
  userId: "editor-1",
  preferredUsername: "editor@example.test",
  email: "editor@example.test",
  workspaceId: "test-workspace",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: "caller-token",
};

test("ProjectAppResourceGrantsService_UpdatesCallerAuthorizedGrantsAndAudits", async () => {
  const harness = createHarness();
  await deployNewApp(harness.service);
  const secret = createSecretResource();

  const result = await harness.service.updateResourceGrants(
    CALLER,
    "request-2",
    PROJECT_ID,
    { resources: [secret] },
  );

  assert.deepEqual(result, { appName: "project-child", resourceCount: 1 });
  assert.deepEqual(
    harness.workspace.apps.get("project-child")?.resources,
    [secret],
  );
  assert.ok(
    harness.repository.auditActions.includes(
      "child_app.resource_grants.update_submitted",
    ),
  );
});

test("ProjectAppResourceGrantsService_RejectsRemovingProjectRequiredResources", async () => {
  const requiredResource: WorkspaceAppResource = {
    name: "required-warehouse",
    description: "Required SQL warehouse",
    sql_warehouse: { id: "warehouse-123", permission: "CAN_USE" },
  };
  const harness = createHarness({
    requirements: {
      userApiScopes: ["sql"],
      appResources: [requiredResource],
      blockers: [],
    },
  });
  await deployNewApp(harness.service);

  await assert.rejects(
    harness.service.updateResourceGrants(
      CALLER,
      "request-2",
      PROJECT_ID,
      { resources: [] },
    ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "required_app_resource_grant_missing",
  );
  assert.deepEqual(
    harness.workspace.apps.get("project-child")?.resources,
    [requiredResource],
  );
});

test("ProjectAppResourceGrantsService_RejectsUnsupportedResourcesWithoutOverwrite", async () => {
  const harness = createHarness();
  await deployNewApp(harness.service);
  const childApp = harness.workspace.apps.get("project-child");
  assert.ok(childApp);
  childApp.unsupportedResourceCount = 1;

  await assert.rejects(
    harness.service.updateResourceGrants(
      CALLER,
      "request-2",
      PROJECT_ID,
      { resources: [] },
    ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "unsupported_app_resources_present",
  );
  assert.deepEqual(childApp.resources, []);
});

test("ProjectAppResourceGrantsService_RejectsViewersBeforeWorkspaceMutation", async () => {
  const harness = createHarness({ callerRole: "viewer" });

  await assert.rejects(
    harness.service.updateResourceGrants(
      CALLER,
      "request-2",
      PROJECT_ID,
      { resources: [createSecretResource()] },
    ),
    (error: unknown) =>
      error instanceof ApplicationError && error.status === 403,
  );
  assert.equal(harness.workspace.apps.size, 0);
});

async function deployNewApp(
  service: ReturnType<typeof createHarness>["service"],
): Promise<void> {
  await service.deploy(CALLER, "request-1", PROJECT_ID, {
    mode: "createNew",
    appName: "project-child",
    confirmOverwrite: false,
  });
}

function createSecretResource(): WorkspaceAppResource {
  return {
    name: "service-api",
    description: "VDAB secret resource grant",
    secret: { scope: "service-scope", key: "api-key", permission: "READ" },
  };
}
