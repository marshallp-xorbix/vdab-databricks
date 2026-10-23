import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { createHarness, makeApp } from "./project-deployment-test-support.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CALLER: CallerIdentity = {
  userId: "editor-1",
  preferredUsername: "editor@example.test",
  email: "editor@example.test",
  workspaceId: "test-workspace",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: "caller-token-never-record-or-return",
};

test("ProjectDeploymentService_RequiresFilesScopeForGeneratedUploadApp", async () => {
  const harness = createHarness({
    requirements: {
      userApiScopes: ["files"],
      appResources: [],
      blockers: [],
    },
  });

  await harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
    mode: "createNew",
    appName: "upload-child",
    confirmOverwrite: false,
  });

  assert.deepEqual(harness.workspace.createdApps[0]?.userApiScopes, ["files"]);
  assert.deepEqual(harness.repository.records[0]?.requiredUserApiScopes, [
    "files",
  ]);
});

test("ProjectDeploymentService_BlocksLinkWhenUploadAppLacksFilesScope", async () => {
  const harness = createHarness({
    requirements: {
      userApiScopes: ["files"],
      appResources: [],
      blockers: [],
    },
  });
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
