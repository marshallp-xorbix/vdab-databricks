import assert from "node:assert/strict";
import test from "node:test";
import { MAX_WORKSPACE_JSON_RESPONSE_BYTES } from "../src/bounded-json-response.ts";
import { createWorkspaceAppsClient } from "../src/workspace-apps-client.ts";
import type { CallerIdentity } from "../src/contracts.ts";

const WORKSPACE_HOST = "https://dbc-example.cloud.databricks.com";
const FORWARDED_TOKEN = "caller-token-never-return-this";

test("WorkspaceAppsClient_RuntimeUrl_ReturnsOnlyTheRequestedDatabricksApp", async () => {
  const validUrl = "https://orders-dashboard-123.aws.databricksapps.com";
  const createClient = (url: string) => createWorkspaceAppsClient(WORKSPACE_HOST, async () => Response.json({ name: "orders-dashboard", url, app_status: { state: "RUNNING" }, compute_status: { state: "ACTIVE" } }));
  assert.equal((await createClient(validUrl).getApp(createTestCaller(), "orders-dashboard")).url, validUrl);
  for (const url of ["javascript:alert(1)", "https://evil.example", "https://other-app-123.aws.databricksapps.com", "https://orders-dashboard-123.aws.databricksapps.com.evil.example", `${validUrl}/?token=secret`, `https://user:secret@orders-dashboard-123.aws.databricksapps.com`]) {
    await assert.rejects(createClient(url).getApp(createTestCaller(), "orders-dashboard"), { code: "databricks_invalid_response", status: 502 });
  }
});

test("WorkspaceAppsClient_ListsCallerVisibleApps_UsingPinnedWorkspaceAndUserToken", async () => {
  let requestedUrl = "";
  let authorizationHeader: string | null = null;
  let redirectMode: RequestRedirect | undefined;
  const workspaceAppsClient = createWorkspaceAppsClient(
    WORKSPACE_HOST,
    async (input, init) => {
      requestedUrl = input.toString();
      authorizationHeader = new Headers(init?.headers).get("authorization");
      redirectMode = init?.redirect;

      return new Response(
        JSON.stringify({
          apps: [
            {
              name: "orders-dashboard",
              description: "Orders",
              app_status: { state: "RUNNING" },
              compute_status: { state: "ACTIVE" },
            },
          ],
          next_page_token: "page-two",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );

  const result = await workspaceAppsClient.listApps(createTestCaller(), {
    pageSize: 25,
    pageToken: "page-one",
  });

  const parsedUrl = new URL(requestedUrl);
  assert.equal(parsedUrl.origin, "https://dbc-example.cloud.databricks.com");
  assert.equal(parsedUrl.pathname, "/api/2.0/apps");
  assert.equal(parsedUrl.searchParams.get("page_size"), "25");
  assert.equal(parsedUrl.searchParams.get("page_token"), "page-one");
  assert.equal(authorizationHeader, "Bearer caller-token-never-return-this");
  assert.equal(redirectMode, "error");
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    name: "orders-dashboard",
    description: "Orders",
    appState: "RUNNING",
    computeState: "ACTIVE",
  });
  assert.equal(result.nextPageToken, "page-two");
  assert.doesNotMatch(JSON.stringify(result), /caller-token/);
});

test("WorkspaceAppsClient_ControlsOneAppWithCallerTokenAndPinnedWorkspace", async () => {
  const requests: Array<{ url: string; method: string; authorization: string | null }> = [];
  const workspaceAppsClient = createWorkspaceAppsClient(
    WORKSPACE_HOST,
    async (input, init) => {
      requests.push({
        url: input.toString(),
        method: init?.method ?? "GET",
        authorization: new Headers(init?.headers).get("authorization"),
      });
      return new Response(
        JSON.stringify({
          name: "orders-dashboard",
          app_status: { state: "RUNNING" },
          compute_status: { state: "ACTIVE" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );

  const result = await workspaceAppsClient.startApp(
    createTestCaller(),
    "orders-dashboard",
  );

  assert.deepEqual(requests, [
    {
      url: "https://dbc-example.cloud.databricks.com/api/2.0/apps/orders-dashboard/start",
      method: "POST",
      authorization: "Bearer caller-token-never-return-this",
    },
  ]);
  assert.deepEqual(result, {
    name: "orders-dashboard",
    description: null,
    appState: "RUNNING",
    computeState: "ACTIVE",
  });
  assert.doesNotMatch(JSON.stringify(result), /caller-token/);
});

test("WorkspaceAppsClient_RejectsInvalidAppNameBeforeRemoteCall", async () => {
  let callCount = 0;
  const workspaceAppsClient = createWorkspaceAppsClient(
    WORKSPACE_HOST,
    async () => {
      callCount += 1;
      return new Response("{}", { status: 200 });
    },
  );

  await assert.rejects(
    () => workspaceAppsClient.stopApp(createTestCaller(), "../other-app"),
    { code: "invalid_app_name", status: 400 },
  );
  assert.equal(callCount, 0);
});

test("WorkspaceAppsClient_RejectsOversizedResponseWithSanitizedError", async () => {
  const workspaceAppsClient = createWorkspaceAppsClient(
    WORKSPACE_HOST,
    async () =>
      new Response("{}", {
        status: 200,
        headers: {
          "content-length": String(MAX_WORKSPACE_JSON_RESPONSE_BYTES + 1),
        },
      }),
  );

  await assert.rejects(
    () =>
      workspaceAppsClient.listApps(createTestCaller(), {
        pageSize: 10,
        pageToken: null,
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "databricks_invalid_response" &&
      !error.message.includes("content-length"),
  );
});

test("WorkspaceAppsClient_RejectsMissingUserToken_WithoutCallingDatabricks", async () => {
  let callCount = 0;
  const workspaceAppsClient = createWorkspaceAppsClient(
    WORKSPACE_HOST,
    async () => {
      callCount += 1;
      return new Response(JSON.stringify({ apps: [] }), { status: 200 });
    },
  );

  await assert.rejects(
    () =>
      workspaceAppsClient.listApps(createTestCaller(null), {
        pageSize: 100,
        pageToken: null,
      }),
    { code: "databricks_session_required" },
  );

  assert.equal(callCount, 0);
});

test("WorkspaceAppsClient_MapsForbiddenScopeOrPermission_WithoutFallback", async () => {
  const authorizationHeaders: string[] = [];
  const workspaceAppsClient = createWorkspaceAppsClient(
    WORKSPACE_HOST,
    async (_input, init) => {
      authorizationHeaders.push(
        new Headers(init?.headers).get("authorization") ?? "",
      );

      return new Response("denied", { status: 403 });
    },
  );

  await assert.rejects(
    () =>
      workspaceAppsClient.listApps(createTestCaller(), {
        pageSize: 10,
        pageToken: null,
      }),
    { code: "databricks_apps_access_denied", status: 403 },
  );

  assert.deepEqual(authorizationHeaders, [
    "Bearer caller-token-never-return-this",
  ]);
});

test("WorkspaceAppsClient_RejectsInvalidPaginationBeforeRemoteCall", async () => {
  let callCount = 0;
  const workspaceAppsClient = createWorkspaceAppsClient(
    WORKSPACE_HOST,
    async () => {
      callCount += 1;
      return new Response(JSON.stringify({ apps: [] }), { status: 200 });
    },
  );

  await assert.rejects(
    () =>
      workspaceAppsClient.listApps(createTestCaller(), {
        pageSize: 101,
        pageToken: null,
      }),
    { code: "invalid_page_size", status: 400 },
  );

  assert.equal(callCount, 0);
});

test("WorkspaceAppsClient_PinsEveryRequestToConfiguredWorkspaceHost", async () => {
  let requestedUrl = "";
  const workspaceAppsClient = createWorkspaceAppsClient(
    WORKSPACE_HOST,
    async (input) => {
      requestedUrl = input.toString();
      return new Response(JSON.stringify({ apps: [] }), { status: 200 });
    },
  );

  await workspaceAppsClient.listApps(createTestCaller(), {
    pageSize: 1,
    pageToken: null,
  });

  assert.equal(new URL(requestedUrl).origin, WORKSPACE_HOST);
});

test("WorkspaceAppsClient_RejectsMalformedResponseInsteadOfReturningPartialData", async () => {
  const workspaceAppsClient = createWorkspaceAppsClient(
    WORKSPACE_HOST,
    async () =>
      new Response(
        JSON.stringify({
          apps: [{ name: "valid-app" }, { description: "missing name" }],
          next_page_token: 42,
        }),
        { status: 200 },
      ),
  );

  await assert.rejects(
    () =>
      workspaceAppsClient.listApps(createTestCaller(), {
        pageSize: 10,
        pageToken: null,
      }),
    { code: "databricks_invalid_response", status: 502 },
  );
});

function createTestCaller(
  accessToken: string | null = FORWARDED_TOKEN,
): CallerIdentity {
  return {
    userId: "databricks-user-17",
    preferredUsername: "pat@example.com",
    email: "pat@example.com",
    workspaceId: "test-workspace",
    authenticationMode: "databricks",
    isInstallationAdmin: false,
    databricksAccessToken: accessToken,
  };
}
