import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import { MAX_WORKSPACE_JSON_RESPONSE_BYTES } from "../src/bounded-json-response.ts";
import { createWorkspaceAppDeploymentClient } from "../src/workspace-app-deployment-client.ts";
import {
  CALLER,
  createClientHarness,
  jsonResponse,
  SOURCE_FILES,
  SOURCE_PATH,
} from "./workspace-app-deployment-client-test-support.ts";

test("WorkspaceAppDeploymentClient_GetApp_UsesTrustedHostAndCallerToken", async () => {
  const harness = createClientHarness([
    jsonResponse({
      id: "workspace-app-id",
      name: "child-app",
      description: "safe summary",
      app_status: { state: "RUNNING" },
      compute_status: { state: "ACTIVE" },
      url: "child-app.example.databricksapps.com",
      active_deployment: {
        deployment_id: "01ef0bda89f21f08a8351f41e4a9b948",
        source_code_path: SOURCE_PATH,
      },
      space: "team-apps",
      effective_user_api_scopes: ["sql:restricted-query"],
      user_api_scopes: ["sql"],
      resources: [
        {
          name: "api-key",
          description: "API key binding",
          secret: {
            scope: "service-scope",
            key: "api-key",
            permission: "READ",
          },
          value: "response-must-not-be-forwarded",
        },
      ],
    }),
  ]);

  const result = await harness.client.getApp(CALLER, "child-app");

  assert.equal(result?.appId, "workspace-app-id");
  assert.equal(result?.appUrl, "https://child-app.example.databricksapps.com/");
  assert.equal(result?.activeDeploymentId, "01ef0bda89f21f08a8351f41e4a9b948");
  assert.equal(result?.usesGitSource, false);
  assert.equal(result?.spaceName, "team-apps");
  assert.deepEqual(result?.effectiveUserApiScopes, ["sql:restricted-query"]);
  assert.deepEqual(result?.resources, [
    {
      name: "api-key",
      description: "API key binding",
      secret: { scope: "service-scope", key: "api-key", permission: "READ" },
    },
  ]);
  assert.equal(
    JSON.stringify(result).includes("response-must-not-be-forwarded"),
    false,
  );
  assert.equal(
    harness.calls[0]?.url,
    "https://workspace.example/api/2.0/apps/child-app",
  );
  assert.equal(
    new Headers(harness.calls[0]?.init.headers).get("authorization"),
    "Bearer caller-token",
  );
  assert.equal(harness.calls[0]?.init.redirect, "error");
});

test("WorkspaceAppDeploymentClient_GetApp_ReturnsNullForNotFound", async () => {
  const harness = createClientHarness([new Response(null, { status: 404 })]);

  assert.equal(await harness.client.getApp(CALLER, "missing-app"), null);
});

test("WorkspaceAppDeploymentClient_GetInstalledAppSpace_UsesTrustedAppNameAndCallerToken", async () => {
  const harness = createClientHarness([
    jsonResponse({ name: "vdab-app", space: "team-apps" }),
  ]);

  assert.equal(await harness.client.getInstalledAppSpace(CALLER), "team-apps");
  assert.equal(
    harness.calls[0]?.url,
    "https://workspace.example/api/2.0/apps/vdab-app",
  );
  assert.equal(
    new Headers(harness.calls[0]?.init.headers).get("authorization"),
    "Bearer caller-token",
  );
});

test("WorkspaceAppDeploymentClient_GetInstalledAppSpace_ReturnsNullForDefaultWorkspaceScope", async () => {
  const harness = createClientHarness([
    jsonResponse({ name: "vdab-app", space: null }),
  ]);

  assert.equal(await harness.client.getInstalledAppSpace(CALLER), null);
});

test("WorkspaceAppDeploymentClient_GetInstalledAppSpace_RejectsMissingSpaceMetadata", async () => {
  const harness = createClientHarness([jsonResponse({ name: "vdab-app" })]);

  await assert.rejects(
    harness.client.getInstalledAppSpace(CALLER),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_invalid_response",
  );
  assert.equal(harness.calls.length, 1);
});

test("WorkspaceAppDeploymentClient_GetApp_RejectsOversizedResponseWithoutLeakingBody", async () => {
  const harness = createClientHarness([
    new Response("workspace-internal-content-must-not-leak", {
      status: 200,
      headers: {
        "content-length": String(MAX_WORKSPACE_JSON_RESPONSE_BYTES + 1),
      },
    }),
  ]);

  await assert.rejects(
    harness.client.getApp(CALLER, "child-app"),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_invalid_response" &&
      !error.message.includes("workspace-internal-content"),
  );
});

test("WorkspaceAppDeploymentClient_CountAppsFollowsWorkspacePaginationWithCallerIdentity", async () => {
  const harness = createClientHarness([
    jsonResponse({
      apps: [{ name: "first-app" }],
      next_page_token: "next-page-token",
    }),
    jsonResponse({ apps: [{ name: "second-app" }] }),
  ]);

  assert.equal(await harness.client.countApps(CALLER), 2);
  const firstPage = new URL(harness.calls[0]?.url ?? "");
  const secondPage = new URL(harness.calls[1]?.url ?? "");
  assert.equal(firstPage.pathname, "/api/2.0/apps");
  assert.equal(firstPage.searchParams.get("page_size"), "100");
  assert.equal(firstPage.searchParams.has("page_token"), false);
  assert.equal(secondPage.searchParams.get("page_token"), "next-page-token");
  assert.equal(
    new Headers(harness.calls[1]?.init.headers).get("authorization"),
    "Bearer caller-token",
  );
});

test("WorkspaceAppDeploymentClient_CountAppsRejectsRepeatedPageToken", async () => {
  const harness = createClientHarness([
    jsonResponse({ apps: [], next_page_token: "repeated-token" }),
    jsonResponse({ apps: [], next_page_token: "repeated-token" }),
  ]);

  await assert.rejects(
    harness.client.countApps(CALLER),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_invalid_response",
  );
});

test("WorkspaceAppDeploymentClient_CreateApp_UsesNoComputeAndRequestedScopes", async () => {
  const resources = [
    {
      name: "vdab-pg-0123456789abcdef",
      description: "VDAB Lakebase Autoscaling",
      postgres: {
        database:
          "projects/project-one/branches/branch-one/databases/database-one",
        permission: "CAN_CONNECT_AND_CREATE" as const,
      },
    },
  ];
  const harness = createClientHarness([
    jsonResponse({
      id: "created-app-id",
      name: "child-app",
      space: "team-apps",
      effective_user_api_scopes: ["sql"],
      user_api_scopes: ["sql"],
      resources,
    }),
  ]);

  const result = await harness.client.createApp(
    CALLER,
    "child-app",
    "marker",
    ["sql"],
    resources,
    "team-apps",
  );
  const request = harness.calls[0];
  const requestBody = JSON.parse(String(request?.init.body)) as Record<
    string,
    unknown
  >;

  assert.equal(result.appId, "created-app-id");
  assert.equal(result.spaceName, "team-apps");
  assert.deepEqual(result.resources, resources);
  assert.equal(
    new URL(request?.url ?? "").searchParams.get("no_compute"),
    "true",
  );
  assert.deepEqual(requestBody, {
    name: "child-app",
    description: "marker",
    user_api_scopes: ["sql"],
    resources,
    space: "team-apps",
  });
});

test("WorkspaceAppDeploymentClient_CreateApp_RejectsNameConflict", async () => {
  const harness = createClientHarness([new Response("{}", { status: 409 })]);

  await assert.rejects(
    harness.client.createApp(CALLER, "child-app", "marker", [], [], null),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "child_app_name_conflict",
  );
});

test("WorkspaceAppDeploymentClient_UploadSource_ImportsImmutableRawFiles", async () => {
  const harness = createClientHarness([
    jsonResponse({}),
    jsonResponse({}),
    jsonResponse({}),
  ]);

  await harness.client.uploadSource(CALLER, SOURCE_PATH, SOURCE_FILES);

  assert.equal(
    harness.calls[0]?.url,
    "https://workspace.example/api/2.0/workspace/mkdirs",
  );
  const mkdirBody = JSON.parse(String(harness.calls[0]?.init.body)) as Record<
    string,
    unknown
  >;
  assert.deepEqual(mkdirBody, { path: SOURCE_PATH });
  const firstFile = JSON.parse(String(harness.calls[1]?.init.body)) as Record<
    string,
    unknown
  >;
  assert.deepEqual(firstFile, {
    format: "RAW",
    path: `${SOURCE_PATH}/app.py`,
    content: Buffer.from(SOURCE_FILES[0]?.content ?? "", "utf8").toString(
      "base64",
    ),
    overwrite: false,
  });
  assert.equal(
    new Headers(harness.calls[1]?.init.headers).get("authorization"),
    "Bearer caller-token",
  );
});

test("WorkspaceAppDeploymentClient_UploadSource_RejectsSecretsBeforeWorkspaceMutation", async () => {
  const harness = createClientHarness([]);
  const sourceFiles = [
    { path: "app.py", content: "api_key = 'super-secret-value-123'\n" },
  ];

  await assert.rejects(
    harness.client.uploadSource(CALLER, SOURCE_PATH, sourceFiles),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "invalid_generated_source",
  );
  assert.equal(harness.calls.length, 0);
});

test("WorkspaceAppDeploymentClient_CreateDeployment_UsesImmutableSnapshotAndMapsStatus", async () => {
  const harness = createClientHarness([
    jsonResponse({
      deployment_id: "01ef0bda89f21f08a8351f41e4a9b948",
      status: { state: "IN_PROGRESS" },
    }),
  ]);

  const result = await harness.client.createDeployment(
    CALLER,
    "child-app",
    SOURCE_PATH,
  );
  const requestBody = JSON.parse(String(harness.calls[0]?.init.body)) as Record<
    string,
    unknown
  >;

  assert.deepEqual(result, {
    deploymentId: "01ef0bda89f21f08a8351f41e4a9b948",
    state: "running",
  });
  assert.deepEqual(requestBody, {
    source_code_path: SOURCE_PATH,
    mode: "SNAPSHOT",
  });
});

test("WorkspaceAppDeploymentClient_GetDeployment_RejectsUnknownStatus", async () => {
  const harness = createClientHarness([
    jsonResponse({
      deployment_id: "01ef0bda89f21f08a8351f41e4a9b948",
      status: { state: "UNRECOGNIZED" },
    }),
  ]);

  await assert.rejects(
    harness.client.getDeployment(
      CALLER,
      "child-app",
      "01ef0bda89f21f08a8351f41e4a9b948",
    ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_invalid_response",
  );
});

test("WorkspaceAppDeploymentClient_WithoutCallerToken_DoesNotCallWorkspace", async () => {
  const harness = createClientHarness([]);

  await assert.rejects(
    harness.client.getApp(
      { ...CALLER, databricksAccessToken: null },
      "child-app",
    ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_session_required",
  );
  assert.equal(harness.calls.length, 0);
});

test("WorkspaceAppDeploymentClient_RejectsRedirectsAndSanitizesWorkspaceErrors", async () => {
  const harness = createClientHarness([
    new Response("internal workspace details", { status: 403 }),
  ]);

  await assert.rejects(
    harness.client.getApp(CALLER, "child-app"),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_deployment_access_denied" &&
      !error.message.includes("internal workspace details") &&
      !error.message.includes("caller-token"),
  );
  assert.equal(harness.calls[0]?.init.redirect, "error");
});

test("WorkspaceAppDeploymentClient_MapsResourceExhaustionWithoutBlindRetry", async () => {
  const harness = createClientHarness([new Response("{}", { status: 429 })]);

  await assert.rejects(
    harness.client.createApp(CALLER, "child-app", "marker", [], [], null),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 429 &&
      error.code === "databricks_resource_exhausted",
  );
  assert.equal(harness.calls.length, 1);
});

test("WorkspaceAppDeploymentClient_RejectsNonHttpsWorkspaceHost", () => {
  assert.throws(() =>
    createWorkspaceAppDeploymentClient("http://workspace.example", "vdab-app"),
  );
});
