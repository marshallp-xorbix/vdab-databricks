import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { createWorkspaceSecretAppResource } from "../src/workspace-app-secret-resource-binding.ts";
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

test("ProjectDeploymentService_CreateNewBindsReadOnlySecretWithoutPersistingValue", async () => {
  const harness = createHarness();

  await harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
    mode: "createNew",
    appName: "project-child",
    confirmOverwrite: false,
    secretResources: [
      { name: "service-api", scope: "service-scope", key: "api-key" },
    ],
  });

  const secret = harness.workspace.createdAppResources.find(
    (resource) => "secret" in resource,
  );
  assert.ok(secret && "secret" in secret);
  assert.equal(secret.secret.permission, "READ");
  assert.equal(secret.secret.scope, "service-scope");
  assert.equal(secret.secret.key, "api-key");
  assert.deepEqual(harness.repository.records[0]?.requiredAppResources, [
    secret,
  ]);
  const manifest = harness.workspace.uploads[0]?.files[0]?.content ?? "";
  assert.match(manifest, new RegExp(`valueFrom: ${secret.name}`));
  assert.doesNotMatch(manifest, /service-secret-value/);
  assert.equal(
    JSON.stringify(harness.repository.records[0]?.sourceFiles).includes(
      "service-secret-value",
    ),
    false,
  );
});

test("ProjectDeploymentService_LinkExistingRequiresSelectedExactSecretResource", async () => {
  const secret = createWorkspaceSecretAppResource(
    "api-key",
    "service-scope",
    "api-key",
  );
  const harness = createHarness();
  harness.workspace.apps.set(
    "existing-child",
    makeApp({ name: "existing-child", resources: [secret] }),
  );

  const result = await harness.service.deploy(CALLER, "request-1", PROJECT_ID, {
    mode: "linkExisting",
    appName: "existing-child",
    confirmOverwrite: true,
    secretResources: [
      { name: secret.name, scope: secret.secret.scope, key: secret.secret.key },
    ],
  });

  assert.equal(result.status, "succeeded");
  assert.deepEqual(harness.repository.records[0]?.requiredAppResources, [
    secret,
  ]);
  assert.ok(
    harness.workspace.uploads[0]?.files[0]?.content.includes(
      `valueFrom: ${secret.name}`,
    ),
  );
});

test("ProjectDeploymentService_LinkExistingRejectsUnselectedSecretBeforeSnapshot", async () => {
  const secret = createWorkspaceSecretAppResource(
    "api-key",
    "service-scope",
    "api-key",
  );
  const harness = createHarness();
  harness.workspace.apps.set(
    "existing-child",
    makeApp({ name: "existing-child", resources: [secret] }),
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

test("ProjectDeploymentService_TargetReturnsOnlySecretIdentifiersAndPermission", async () => {
  const secret = createWorkspaceSecretAppResource(
    "api-key",
    "service-scope",
    "api-key",
  );
  const harness = createHarness();
  harness.workspace.apps.set(
    "existing-child",
    makeApp({ name: "existing-child", resources: [secret] }),
  );

  const target = await harness.service.getWorkspaceAppDeploymentTarget(
    CALLER,
    "existing-child",
  );

  assert.deepEqual(target?.secretResources, [secret]);
  assert.equal("resources" in (target ?? {}), false);
  assert.equal(JSON.stringify(target).includes("secret-value"), false);
});
