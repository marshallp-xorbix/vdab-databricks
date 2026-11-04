import assert from "node:assert/strict";
import test from "node:test";
import { createAppHarness } from "./http-app-test-support.ts";

test("ProjectDeploymentSettings_CreateUpdateAndReopen_PreservesTargetAndFolder", async () => {
  const app = await createAppHarness();
  const settings = {
    mode: "createNew",
    appName: "parity-demo",
    workspacePath: null,
  };
  try {
    const created = await fetch(`${app.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Parity demo",
        deploymentSettings: settings,
      }),
    });
    const project = await created.json();
    assert.equal(created.status, 201);
    assert.deepEqual(project.deploymentSettings, settings);

    const updatedSettings = {
      ...settings,
      workspacePath: "/Workspace/Shared/parity-demo",
    };
    const updated = await fetch(
      `${app.baseUrl}/api/v1/projects/${project.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          description: null,
          version: project.version,
          deploymentSettings: updatedSettings,
        }),
      },
    );
    assert.equal(updated.status, 200);
    const reopened = await fetch(
      `${app.baseUrl}/api/v1/projects/${project.id}`,
    );
    assert.deepEqual(
      (await reopened.json()).deploymentSettings,
      updatedSettings,
    );
  } finally {
    await app.dispose();
  }
});

test("ProjectDeploymentSettings_HostileNestedInput_RejectsWithoutCreatingProject", async () => {
  const app = await createAppHarness();
  const settings = {
    mode: "createNew",
    appName: "parity-demo",
    workspacePath: null,
  };
  const invalidSettings = [
    { ...settings, workspaceUrl: "https://foreign.example" },
    { ...settings, accessToken: "must-never-be-stored" },
    { ...settings, appName: "Bad Name" },
    { ...settings, mode: "unknown" },
    ...[
      "https://foreign.example/Workspace/folder",
      "/Workspace/../Shared/app",
      "/Workspace/Shared/./app",
      "/Workspace/Shared//app",
      "/Workspace/Shared/%2e%2e/app",
      "/Workspace/Shared/app?host=other",
      "/Workspace/Shared/app\\other",
    ].map((workspacePath) => ({ ...settings, workspacePath })),
  ];
  try {
    for (const deploymentSettings of invalidSettings) {
      const response = await fetch(`${app.baseUrl}/api/v1/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Invalid", deploymentSettings }),
      });
      assert.equal(response.status, 400);
    }
    const listed = await fetch(`${app.baseUrl}/api/v1/projects`);
    assert.deepEqual((await listed.json()).items, []);
  } finally {
    await app.dispose();
  }
});
