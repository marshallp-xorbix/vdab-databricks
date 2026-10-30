import assert from "node:assert/strict";
import test from "node:test";
import type {
  CallerIdentity,
  ProjectDeploymentSourceFile,
} from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import {
  createDeploymentSourcePath,
  validateGeneratedSource,
} from "../src/deployment-source-validation.ts";

const CALLER: CallerIdentity = {
  userId: "editor-1",
  preferredUsername: "editor@example.test",
  email: "editor@example.test",
  workspaceId: "workspace-1",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: null,
};
const SOURCE_PATH =
  "/Workspace/Users/editor@example.test/.vdab/deployments/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";

test("DeploymentSourceValidation_ValidBundleRequiresAppEntryPoint", () => {
  const sourceFiles: ProjectDeploymentSourceFile[] = [
    { path: "app.py", content: "import streamlit as st\nst.title('Demo')\n" },
    { path: "pages/home.py", content: "st.write('Home')\n" },
  ];

  assert.doesNotThrow(() => validateGeneratedSource(SOURCE_PATH, sourceFiles));
});

test("DeploymentSourceValidation_AcceptsNestedAsyncpgLicenseNotice", () => {
  const sourceFiles: ProjectDeploymentSourceFile[] = [
    { path: "app.py", content: "print('ok')" },
    {
      path: "THIRD_PARTY_NOTICES/asyncpg-0.32.0-LICENSE.txt",
      content:
        "Copyright (C) 2016-present the asyncpg authors and contributors.\n",
    },
  ];

  assert.doesNotThrow(() => validateGeneratedSource(SOURCE_PATH, sourceFiles));
});

test("DeploymentSourceValidation_RejectsTraversalDuplicatesAndMissingApp", () => {
  const hostileBundles: ProjectDeploymentSourceFile[][] = [
    [{ path: "../app.py", content: "print('x')" }],
    [
      { path: "app.py", content: "one" },
      { path: "app.py", content: "two" },
    ],
    [{ path: "requirements.txt", content: "streamlit" }],
  ];

  for (const sourceFiles of hostileBundles) {
    assert.throws(
      () => validateGeneratedSource(SOURCE_PATH, sourceFiles),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "invalid_generated_source",
    );
  }
});

test("DeploymentSourceValidation_RejectsWorkspaceAuthority", () => {
  assert.throws(
    () =>
      validateGeneratedSource("https://other-workspace.example", [
        { path: "app.py", content: "print('ok')" },
      ]),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "invalid_deployment_source_path",
  );
});

test("DeploymentSourceValidation_RejectsCommonSecretPatterns", () => {
  const secretBundles: ProjectDeploymentSourceFile[][] = [
    [
      {
        path: "app.py",
        content: "token = 'Bearer abcdefghijklmnopqrstuvwxyz'",
      },
    ],
    [{ path: "app.py", content: "-----BEGIN PRIVATE KEY-----" }],
  ];

  for (const sourceFiles of secretBundles) {
    assert.throws(
      () => validateGeneratedSource(SOURCE_PATH, sourceFiles),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "invalid_generated_source",
    );
  }
});

test("DeploymentSourceValidation_CreatesCallerOwnedStableFolder", () => {
  const projectId = "11111111-1111-4111-8111-111111111111";
  const deploymentId = "22222222-2222-4222-8222-222222222222";

  assert.equal(
    createDeploymentSourcePath(CALLER, projectId, deploymentId),
    SOURCE_PATH,
  );
  assert.throws(
    () =>
      createDeploymentSourcePath(
        { ...CALLER, email: null, preferredUsername: null },
        projectId,
        deploymentId,
      ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "deployment_source_identity_unavailable",
  );
});

test("DeploymentSourceValidation_ConfiguredFolder_IsolatesProjectAndAttemptSnapshots", () => {
  const projectId = "11111111-1111-4111-8111-111111111111";
  const deploymentId = "22222222-2222-4222-8222-222222222222";
  const path = createDeploymentSourcePath(CALLER, projectId, deploymentId, "/Workspace/Shared/parity-demo/");
  assert.equal(path, `/Workspace/Shared/parity-demo/.vdab/deployments/${projectId}/${deploymentId}`);
  assert.doesNotThrow(() => validateGeneratedSource(path, [{ path: "app.py", content: "print('ok')" }]));
  assert.throws(() => createDeploymentSourcePath(CALLER, projectId, deploymentId, "/Workspace/Shared/../other"));
});
