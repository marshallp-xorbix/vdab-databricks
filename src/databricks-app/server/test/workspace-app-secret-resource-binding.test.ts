import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import { readStartProjectDeploymentInput } from "../src/db/project-deployment-input.ts";
import { readDeploymentAppResourceArray } from "../src/db/project-deployment-repository-mapping.ts";
import { addGeneratedAppManifest } from "../src/generated-app-manifest.ts";
import {
  createWorkspaceSecretAppResource,
  resolveWorkspaceSecretResources,
  workspaceSecretEnvironmentVariable,
} from "../src/workspace-app-secret-resource-binding.ts";
import { validateWorkspaceAppResources } from "../src/workspace-app-resource-validation.ts";

test("WorkspaceSecretResourceBinding_UsesUserSelectedKeyAndReadOnlyGrants", () => {
  const resource = createWorkspaceSecretAppResource(
    "service-api",
    "api-scope",
    "api-key",
  );

  assert.deepEqual(
    createWorkspaceSecretAppResource("service-api", "api-scope", "api-key"),
    resource,
  );
  assert.equal(resource.name, "service-api");
  assert.deepEqual(resource.secret, {
    scope: "api-scope",
    key: "api-key",
    permission: "READ",
  });
  assert.match(workspaceSecretEnvironmentVariable(resource), /^VDAB_SECRET_/);
  assert.deepEqual(validateWorkspaceAppResources([resource]), [resource]);
});

test("WorkspaceSecretResourceBinding_ResolvesOnlyExplicitExistingReadGrants", () => {
  const existing = createWorkspaceSecretAppResource(
    "service-api",
    "api-scope",
    "api-key",
  );
  const selected = resolveWorkspaceSecretResources(
    [
      {
        name: existing.name,
        scope: existing.secret.scope,
        key: existing.secret.key,
      },
    ],
    [existing],
  );

  assert.deepEqual(selected, [existing]);
  assert.throws(
    () =>
      resolveWorkspaceSecretResources(
        [{ name: existing.name, scope: "other-scope", key: "api-key" }],
        [existing],
      ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "invalid_child_app_secret_resource",
  );
  assert.throws(
    () =>
      resolveWorkspaceSecretResources(
        [{ name: "unselected", scope: "api-scope", key: "api-key" }],
        [existing],
      ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "invalid_child_app_secret_resource",
  );
});

test("WorkspaceSecretResourceBinding_UsesValueFromWithoutStoringASecretValue", () => {
  const resource = createWorkspaceSecretAppResource(
    "service-api",
    "api-scope",
    "api-key",
  );
  const environmentVariable = workspaceSecretEnvironmentVariable(resource);
  const files = addGeneratedAppManifest(
    [{ path: "app.py", content: "import os\n" }],
    [resource],
  );
  const manifest = files[0]?.content ?? "";

  assert.match(manifest, new RegExp(`name: ${environmentVariable}`));
  assert.match(manifest, new RegExp(`valueFrom: ${resource.name}`));
  assert.doesNotMatch(manifest, /api-key-value|secret_value|value:/i);
  assert.deepEqual(
    readDeploymentAppResourceArray(JSON.stringify([resource])),
    [resource],
  );
});

test("ProjectDeploymentInput_RejectsSecretValuesAndUnknownSecretFields", () => {
  const request = {
    mode: "createNew",
    appName: "child-app",
    confirmOverwrite: false,
    secretResources: [{ name: "service-api", scope: "api-scope", key: "api-key" }],
  };
  assert.deepEqual(readStartProjectDeploymentInput(request).secretResources, [
    { name: "service-api", scope: "api-scope", key: "api-key" },
  ]);
  assert.throws(() =>
    readStartProjectDeploymentInput({
      ...request,
      secretResources: [
        {
          name: "service-api",
          scope: "api-scope",
          key: "api-key",
          value: "secret-value",
        },
      ],
    }),
  );
  assert.throws(() =>
    readStartProjectDeploymentInput({
      ...request,
      secretResources: [{ name: "", scope: "api-scope", key: "api-key" }],
    }),
  );
});
