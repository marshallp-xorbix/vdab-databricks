import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { MAX_APPS_PER_WORKSPACE } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { ProjectDeploymentService } from "../src/project-deployment-service.ts";
import { createAutoscalingAppResourceBinding } from "../src/lakebase-app-resource-binding.ts";
import { createSqlWarehouseAppResourceBinding } from "../src/sql-warehouse-app-resource-binding.ts";
import type { WorkspaceAppDetails } from "../src/workspace-app-deployment-client.ts";
import { createHarness, makeApp } from "./project-deployment-test-support.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LAKEBASE_APP_RESOURCES: WorkspaceAppDetails["resources"] = [
  createAutoscalingAppResourceBinding({
    projectId: "project-one",
    branchId: "branch-one",
    endpointId: "endpoint-one",
    databaseId: "database-one",
  }).resource,
];
const CALLER: CallerIdentity = {
  userId: "editor-1",
  preferredUsername: "editor@example.test",
  email: "editor@example.test",
  workspaceId: "test-workspace",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: "caller-token-never-record-or-return",
};

test("ProjectDeploymentService_CreateNewApp_PersistsImmutableSnapshotAndSubmitsWithUserScopes", async () => {
  const harness = createHarness();

  const result = await harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
    mode: "createNew",
    appName: "project-child",
    confirmOverwrite: false,
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.appName, "project-child");
  assert.ok(
    result.sourceCodePath?.startsWith(
      "/Workspace/Users/editor@example.test/.vdab/deployments/",
    ),
  );
  assert.equal(harness.workspace.createdApps.length, 1);
  assert.deepEqual(harness.workspace.createdApps[0]?.userApiScopes, ["sql"]);
  assert.equal(harness.workspace.uploads.length, 1);
  assert.equal(harness.workspace.uploads[0]?.files[0]?.path, "app.yaml");
  assert.equal(
    harness.workspace.uploads[0]?.files[0]?.content,
    "command: ['streamlit', 'run', 'app.py']\n",
  );
  assert.equal(harness.workspace.submittedPaths[0], result.sourceCodePath);
  assert.deepEqual(
    harness.repository.auditActions.filter((action) =>
      action.startsWith("deployment.app."),
    ),
    ["deployment.app.created"],
  );
  const history = await harness.service.listHistory(
    CALLER,
    "request-1",
    PROJECT_ID,
  );
  assert.equal(history.childApp?.appId, "app-1");
  assert.equal(history.items.length, 1);
  assert.equal(
    JSON.stringify(history).includes(CALLER.databricksAccessToken ?? ""),
    false,
  );
  assert.equal(JSON.stringify(history).includes("generated-secret"), false);
});

test("ProjectDeploymentService_MissingInstalledAppSpace_BlocksBeforeWorkspaceMutation", async () => {
  const harness = createHarness();
  harness.workspace.getInstalledAppSpace = async () => {
    throw new ApplicationError(
      502,
      "databricks_invalid_response",
      "Invalid Databricks response",
      "Databricks returned an invalid child App response.",
    );
  };

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "createNew",
      appName: "project-child",
      confirmOverwrite: false,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_invalid_response",
  );

  assert.equal(harness.repository.records.length, 0);
  assert.equal(harness.workspace.createdApps.length, 0);
  assert.equal(harness.workspace.uploads.length, 0);
  assert.equal(harness.workspace.submittedPaths.length, 0);
});

test("ProjectDeploymentService_ConfiguredWorkspaceFolder_UploadsAndDeploysThatSnapshot", async () => {
  const harness = createHarness({ deploymentSettings: { mode: "createNew", appName: "project-child", workspacePath: "/Workspace/Shared/parity-demo" } });
  const result = await harness.service.deploy(CALLER, "request-folder", PROJECT_ID, { mode: "createNew", appName: "project-child", confirmOverwrite: false });
  assert.ok(result.sourceCodePath?.startsWith(`/Workspace/Shared/parity-demo/.vdab/deployments/${PROJECT_ID}/`));
  assert.equal(harness.workspace.submittedPaths[0], result.sourceCodePath);
});

test("ProjectDeploymentService_LinkExisting_RequiresExplicitReplacementAndRejectsGitSource", async () => {
  const harness = createHarness();
  harness.workspace.apps.set(
    "existing-child",
    makeApp({ name: "existing-child", usesGitSource: true }),
  );

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "linkExisting",
      appName: "existing-child",
      confirmOverwrite: false,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "deployment_overwrite_confirmation_required",
  );
  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "linkExisting",
      appName: "existing-child",
      confirmOverwrite: true,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "git_source_deployment_not_supported",
  );
  assert.equal(harness.workspace.uploads.length, 0);
  assert.equal(harness.workspace.createdApps.length, 0);
});

test("ProjectDeploymentService_MissingUserScope_RejectsExistingAppBeforeSnapshotOrUpload", async () => {
  const harness = createHarness();
  harness.workspace.apps.set(
    "existing-child",
    makeApp({ name: "existing-child", userApiScopes: [] }),
  );

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "linkExisting",
      appName: "existing-child",
      confirmOverwrite: true,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "child_app_scopes_missing",
  );
  assert.equal(harness.repository.records.length, 0);
  assert.equal(harness.workspace.uploads.length, 0);
});

test("ProjectDeploymentService_LinkExistingRequiresMatchingLakebaseResourceBeforeSnapshot", async () => {
  const harness = createHarness({
    requirements: {
      userApiScopes: ["postgres"],
      appResources: LAKEBASE_APP_RESOURCES,
      blockers: [],
    },
  });
  harness.workspace.apps.set(
    "existing-child",
    makeApp({
      name: "existing-child",
      userApiScopes: ["postgres"],
    }),
  );

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "linkExisting",
      appName: "existing-child",
      confirmOverwrite: true,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "child_app_resources_missing",
  );

  assert.equal(harness.repository.records.length, 0);
  assert.equal(harness.workspace.uploads.length, 0);
});

test("ProjectDeploymentService_LinkExistingRejectsExtraManagedResourcesBeforeSnapshot", async () => {
  const warehouse =
    createSqlWarehouseAppResourceBinding("warehouse-123").resource;
  const harness = createHarness({
    requirements: {
      userApiScopes: ["postgres"],
      appResources: LAKEBASE_APP_RESOURCES,
      blockers: [],
    },
  });
  harness.workspace.apps.set(
    "existing-child",
    makeApp({
      name: "existing-child",
      userApiScopes: ["postgres"],
      resources: [...LAKEBASE_APP_RESOURCES, warehouse],
    }),
  );

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "linkExisting",
      appName: "existing-child",
      confirmOverwrite: true,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "child_app_resources_missing",
  );
  assert.equal(harness.repository.records.length, 0);
  assert.equal(harness.workspace.uploads.length, 0);
});

test("ProjectDeploymentService_CreateNewBindsInstalledDefaultSqlWarehouse", async () => {
  const warehouse =
    createSqlWarehouseAppResourceBinding("warehouse-123").resource;
  const harness = createHarness({
    requirements: {
      userApiScopes: ["sql"],
      appResources: [warehouse],
      blockers: [],
    },
  });

  await harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
    mode: "createNew",
    appName: "project-child",
    confirmOverwrite: false,
  });

  assert.deepEqual(harness.workspace.createdAppResources, [warehouse]);
  assert.ok(
    harness.workspace.uploads[0]?.files[0]?.content.includes(
      `valueFrom: ${warehouse.name}`,
    ),
  );
  assert.ok(
    harness.workspace.uploads[0]?.files[0]?.content.includes(
      "name: DATABRICKS_SQL_WAREHOUSE_ID",
    ),
  );
  assert.deepEqual(harness.repository.records[0]?.requiredAppResources, [
    warehouse,
  ]);
});

test("ProjectDeploymentService_CreateNewInheritsInstalledAppSpace", async () => {
  const harness = createHarness({ appSpaceName: "team-apps" });

  await harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
    mode: "createNew",
    appName: "project-child",
    confirmOverwrite: false,
  });

  assert.equal(harness.workspace.createdApps[0]?.spaceName, "team-apps");
  assert.equal(
    harness.workspace.apps.get("project-child")?.spaceName,
    "team-apps",
  );
});

test("ProjectDeploymentService_LinkExistingRejectsDifferentAppSpaceBeforeSnapshot", async () => {
  const harness = createHarness({ appSpaceName: "team-apps" });
  harness.workspace.apps.set(
    "existing-child",
    makeApp({ name: "existing-child", spaceName: "finance-apps" }),
  );

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "linkExisting",
      appName: "existing-child",
      confirmOverwrite: true,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "child_app_space_mismatch",
  );

  assert.equal(harness.repository.records.length, 0);
  assert.equal(harness.workspace.uploads.length, 0);
});

test("ProjectDeploymentService_LinkExistingUsesEffectiveAppSpaceScopes", async () => {
  const harness = createHarness({ appSpaceName: "team-apps" });
  harness.workspace.apps.set(
    "existing-child",
    makeApp({
      name: "existing-child",
      spaceName: "team-apps",
      effectiveUserApiScopes: [],
    }),
  );

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "linkExisting",
      appName: "existing-child",
      confirmOverwrite: true,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "child_app_scopes_missing",
  );

  assert.equal(harness.repository.records.length, 0);
});

test("ProjectDeploymentService_LinkExistingBlocksWhenAppSpaceScopesAreUnavailable", async () => {
  const harness = createHarness({ appSpaceName: "team-apps" });
  harness.workspace.apps.set(
    "existing-child",
    makeApp({
      name: "existing-child",
      spaceName: "team-apps",
      effectiveUserApiScopes: null,
    }),
  );

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "linkExisting",
      appName: "existing-child",
      confirmOverwrite: true,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "child_app_scope_policy_unavailable",
  );

  assert.equal(harness.repository.records.length, 0);
});

test("ProjectDeploymentService_CreateAndRetryUsesPersistedLakebaseResourceBinding", async () => {
  const harness = createHarness({
    requirements: {
      userApiScopes: ["postgres"],
      appResources: LAKEBASE_APP_RESOURCES,
      blockers: [],
    },
  });
  harness.workspace.nextDeploymentState = "failed";

  const initial = await harness.service.deploy(
    CALLER,
    "request-1",
    PROJECT_ID,
    {
      mode: "createNew",
      appName: "project-child",
      confirmOverwrite: false,
    },
  );
  assert.deepEqual(
    harness.workspace.createdAppResources,
    LAKEBASE_APP_RESOURCES,
  );
  assert.deepEqual(
    harness.repository.records[0]?.requiredAppResources,
    LAKEBASE_APP_RESOURCES,
  );

  const retried = await harness.service.retry(
    CALLER,
    "request-2",
    PROJECT_ID,
    initial.id,
    {
      confirmOverwrite: true,
    },
  );

  assert.equal(retried.status, "succeeded");
  assert.deepEqual(
    harness.repository.records[1]?.requiredAppResources,
    LAKEBASE_APP_RESOURCES,
  );
  assert.equal(harness.workspace.createdApps.length, 1);
});

test("ProjectDeploymentService_UnsupportedJobsWorkflow_BlocksBeforeWorkspaceMutation", async () => {
  const harness = createHarness({
    requirements: {
      userApiScopes: [],
      appResources: [],
      blockers: [
        {
          code: "jobs_user_authorization_scope_unavailable",
          detail: "Jobs scope is not documented.",
        },
      ],
    },
  });

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "createNew",
      appName: "project-child",
      confirmOverwrite: false,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "jobs_user_authorization_scope_unavailable",
  );
  assert.equal(harness.workspace.apps.size, 0);
  assert.equal(harness.repository.records.length, 0);
});

test("ProjectDeploymentService_FailedDeployment_CanRetryFromSavedSnapshotAndRollbackLatestSuccess", async () => {
  const harness = createHarness();
  harness.workspace.nextDeploymentState = "failed";
  const initial = await harness.service.deploy(
    CALLER,
    "request-1",
    PROJECT_ID,
    {
      mode: "createNew",
      appName: "project-child",
      confirmOverwrite: false,
    },
  );
  assert.equal(initial.status, "failed");

  const retry = await harness.service.retry(
    CALLER,
    "request-2",
    PROJECT_ID,
    initial.id,
    {
      confirmOverwrite: true,
    },
  );
  assert.equal(retry.status, "succeeded");
  assert.equal(retry.attemptOf, initial.id);
  assert.equal(harness.workspace.uploads.length, 2);
  assert.deepEqual(
    harness.workspace.uploads[0]?.files,
    harness.workspace.uploads[1]?.files,
  );

  const rollback = await harness.service.rollback(
    CALLER,
    "request-3",
    PROJECT_ID,
    retry.id,
    {
      confirmOverwrite: true,
    },
  );
  assert.equal(rollback.status, "succeeded");
  assert.equal(rollback.attemptOf, retry.id);
  assert.equal(harness.workspace.uploads.length, 3);
});

test("ProjectDeploymentService_ViewerCannotDeploy", async () => {
  const harness = createHarness({ callerRole: "viewer" });

  await assert.rejects(
    harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
      mode: "createNew",
      appName: "project-child",
      confirmOverwrite: false,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "project_edit_permission_required",
  );
  assert.equal(harness.repository.records.length, 0);
  assert.equal(harness.workspace.apps.size, 0);
});

test("ProjectDeploymentService_CreateNewAtWorkspaceLimit_BlocksBeforeRecordingOrCreating", async () => {
  const harness = createHarness();
  for (let appIndex = 0; appIndex < MAX_APPS_PER_WORKSPACE; appIndex += 1) {
    const appName = `workspace-app-${appIndex}`;
    harness.workspace.apps.set(appName, makeApp({ name: appName }));
  }

  await assert.rejects(
    harness.service.deploy(CALLER, "request-limit", PROJECT_ID, {
      mode: "createNew",
      appName: "project-child",
      confirmOverwrite: false,
    }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "workspace_app_limit_reached",
  );

  assert.equal(harness.repository.records.length, 0);
  assert.equal(harness.workspace.createdApps.length, 0);
  assert.equal(harness.workspace.uploads.length, 0);
});
