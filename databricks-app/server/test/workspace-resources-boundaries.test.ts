import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import { createWorkspaceResourcesClient } from "../src/workspace-resources-client.ts";

const WORKSPACE_HOST = "https://dbc-example.cloud.databricks.com";
const FORWARDED_TOKEN = "caller-token-never-return-this";


test("WorkspaceResourcesClient_ReportsMoreSummariesWhenPageExceedsRequestedLimit", async () => {
  const client = createWorkspaceResourcesClient(WORKSPACE_HOST, async () =>
    Response.json({
      tables: [
        { full_name: "main.default.first" },
        { full_name: "main.default.second" },
        { full_name: "main.default.third" },
      ],
    }),
  );

  assert.deepEqual(await client.listTableSummaries(createCaller(), "main", 2), {
    items: [
      { fullName: "main.default.first" },
      { fullName: "main.default.second" },
    ],
    hasMore: true,
  });
});

test("WorkspaceResourcesClient_RejectsInvalidTableSummaryLimitsAndNames", async () => {
  let callCount = 0;
  const client = createWorkspaceResourcesClient(WORKSPACE_HOST, async () => {
    callCount += 1;
    return Response.json({ tables: [{ full_name: "invalid" }] });
  });

  await assert.rejects(
    () => client.listTableSummaries(createCaller(), "main", 0),
    { code: "invalid_table_summary_limit", status: 400 },
  );
  await assert.rejects(
    () => client.listTableSummaries(createCaller(), "main", 2),
    { code: "databricks_invalid_response", status: 502 },
  );
  assert.equal(callCount, 1);
});

test("WorkspaceResourcesClient_MapsTableSummaryDenialWithoutIdentityFallback", async () => {
  const authorization: string[] = [];
  let bodyCancelled = false;
  const deniedResponse = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("upstream details"));
      },
      cancel() {
        bodyCancelled = true;
      },
    }),
    { status: 403 },
  );
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (_input, init) => {
      authorization.push(new Headers(init?.headers).get("authorization") ?? "");
      return deniedResponse;
    },
  );

  await assert.rejects(
    () => client.listTableSummaries(createCaller(), "main", 10),
    (error: unknown) =>
      error instanceof ApplicationError && error.status === 403,
  );
  assert.deepEqual(authorization, [`Bearer ${FORWARDED_TOKEN}`]);
  assert.equal(bodyCancelled, true);
});

test("WorkspaceResourcesClient_PropagatesAbortedTableSummaryRequest", async () => {
  const controller = new AbortController();
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (_input, init) => {
      assert.equal(init?.signal?.aborted, false);
      controller.abort();
      throw controller.signal.reason;
    },
  );

  await assert.rejects(() =>
    client.listTableSummaries(createCaller(), "main", 10, controller.signal),
  );
});

test("WorkspaceResourcesClient_RejectsMissingTokenAndInvalidNamesBeforeNetworkCall", async () => {
  let callCount = 0;
  const client = createWorkspaceResourcesClient(WORKSPACE_HOST, async () => {
    callCount += 1;
    return Response.json({ schemas: [] });
  });

  await assert.rejects(() => client.listCatalogs(createCaller(null)), {
    code: "databricks_session_required",
    status: 401,
  });
  await assert.rejects(
    () => client.listSchemas(createCaller(), "../external"),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "invalid_workspace_resource_name" &&
      error.status === 400,
  );

  assert.equal(callCount, 0);
});

test("WorkspaceResourcesClient_MapsDeniedScopeOrPermission_WithoutAppIdentityFallback", async () => {
  const authorizationHeaders: string[] = [];
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (_input, init) => {
      authorizationHeaders.push(
        new Headers(init?.headers).get("authorization") ?? "",
      );
      return new Response("sensitive upstream response", { status: 403 });
    },
  );

  await assert.rejects(
    () => client.listCatalogs(createCaller()),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_resource_access_denied" &&
      error.status === 403 &&
      error.message ===
        "Confirm the app has the required user authorization scope and that you can access this Unity Catalog resource.",
  );

  assert.deepEqual(authorizationHeaders, [`Bearer ${FORWARDED_TOKEN}`]);
});

test("WorkspaceResourcesClient_MapsGenieDenial_WithoutAppIdentityFallback", async () => {
  const authorizationHeaders: string[] = [];
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (_input, init) => {
      authorizationHeaders.push(
        new Headers(init?.headers).get("authorization") ?? "",
      );
      return new Response("sensitive Genie response", { status: 403 });
    },
  );

  await assert.rejects(
    () => client.listGenieSpaces(createCaller()),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_resource_access_denied" &&
      error.status === 403 &&
      error.message ===
        "Confirm the Genie user authorization scope and your access to the Genie space.",
  );

  assert.deepEqual(authorizationHeaders, [`Bearer ${FORWARDED_TOKEN}`]);
});

test("WorkspaceResourcesClient_MapsServingEndpointDenialWithoutIdentityFallback", async () => {
  const authorizationHeaders: string[] = [];
  const client = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async (_input, init) => {
      authorizationHeaders.push(
        new Headers(init?.headers).get("authorization") ?? "",
      );
      return new Response("upstream secret", { status: 403 });
    },
  );

  await assert.rejects(
    () => client.listServingEndpoints(createCaller()),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_resource_access_denied" &&
      error.status === 403 &&
      error.message ===
        "Confirm the model-serving user authorization scope and your permission to query the serving endpoint.",
  );

  assert.deepEqual(authorizationHeaders, [`Bearer ${FORWARDED_TOKEN}`]);
});

test("WorkspaceResourcesClient_RejectsMalformedPageInsteadOfReturningPartialResults", async () => {
  const client = createWorkspaceResourcesClient(WORKSPACE_HOST, async () =>
    Response.json({ schemas: [{ description: "missing name" }] }),
  );

  await assert.rejects(() => client.listSchemas(createCaller(), "main"), {
    code: "databricks_invalid_response",
    status: 502,
  });
});

test("WorkspaceResourcesClient_RejectsUnsafeResourceNamesFromWorkspace", async () => {
  const client = createWorkspaceResourcesClient(WORKSPACE_HOST, async () =>
    Response.json({ volumes: [{ name: "uploads/nested" }] }),
  );

  await assert.rejects(
    () => client.listVolumes(createCaller(), "main", "default"),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "databricks_invalid_response" &&
      error.status === 502,
  );
});

test("WorkspaceResourcesClient_RejectsInvalidOrOversizedServingEndpointResponses", async () => {
  const invalidEndpointClient = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async () =>
      Response.json({ endpoints: [{ name: "https://outside.invalid" }] }),
  );
  const oversizedResponseClient = createWorkspaceResourcesClient(
    WORKSPACE_HOST,
    async () => new Response("x".repeat(4_000_001), { status: 200 }),
  );

  await assert.rejects(
    () => invalidEndpointClient.listServingEndpoints(createCaller()),
    { code: "databricks_invalid_response", status: 502 },
  );
  await assert.rejects(
    () => oversizedResponseClient.listServingEndpoints(createCaller()),
    { code: "databricks_invalid_response", status: 502 },
  );
});

function createCaller(
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
