import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { createWorkspaceExecutionResourcesClient } from "../src/workspace-execution-resources-client.ts";

const WORKSPACE_HOST = "https://dbc-example.cloud.databricks.com";

test("WorkspaceExecutionResourcesClient_ListJobsPagesWithCallerTokenAndPinnedHost", async () => {
  const requests: Array<{ url: URL; authorization: string | null }> = [];
  const client = createWorkspaceExecutionResourcesClient(WORKSPACE_HOST, async (input, init) => {
    const url = new URL(input.toString());
    requests.push({ url, authorization: new Headers(init?.headers).get("authorization") });
    return requests.length === 1
      ? jsonResponse({
          jobs: [
            { job_id: 21, settings: { name: "Zebra refresh" } },
            { job_id: 12, settings: { name: "Alpha refresh" } },
          ],
          next_page_token: "next-page",
        })
      : jsonResponse({ jobs: [{ job_id: 12, settings: { name: "Alpha refresh" } }] });
  });

  const jobs = await client.listJobs(caller);

  assert.deepEqual(jobs, [
    { jobId: "12", name: "Alpha refresh" },
    { jobId: "21", name: "Zebra refresh" },
  ]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.url.origin, WORKSPACE_HOST);
  assert.equal(requests[0]?.url.pathname, "/api/2.2/jobs/list");
  assert.equal(requests[0]?.url.searchParams.get("limit"), "100");
  assert.equal(requests[1]?.url.searchParams.get("page_token"), "next-page");
  assert.ok(requests.every((request) => request.authorization === "Bearer caller-token"));
});

test("WorkspaceExecutionResourcesClient_ListWarehousesUsesSqlPaginationAndState", async () => {
  const requests: URL[] = [];
  const client = createWorkspaceExecutionResourcesClient(WORKSPACE_HOST, async (input) => {
    requests.push(new URL(input.toString()));
    return requests.length === 1
      ? jsonResponse({
          warehouses: [
            { id: "warehouse-b", name: "Zebra SQL", state: "STOPPED" },
            { id: "warehouse-a", name: "Alpha SQL", state: "RUNNING" },
          ],
          next_page_token: "warehouse-next",
        })
      : jsonResponse({ warehouses: [{ id: "warehouse-c", name: "Shared SQL", state: "STARTING" }] });
  });

  const warehouses = await client.listSqlWarehouses(caller);

  assert.deepEqual(warehouses, [
    { id: "warehouse-a", name: "Alpha SQL", state: "running" },
    { id: "warehouse-c", name: "Shared SQL", state: "starting" },
    { id: "warehouse-b", name: "Zebra SQL", state: "stopped" },
  ]);
  assert.equal(requests[0]?.pathname, "/api/2.0/sql/warehouses");
  assert.equal(requests[0]?.searchParams.get("page_size"), "100");
  assert.equal(requests[1]?.searchParams.get("page_token"), "warehouse-next");
});

test("WorkspaceExecutionResourcesClient_DeniedUserRequestNeverRetriesWithAppIdentity", async () => {
  let requestCount = 0;
  const client = createWorkspaceExecutionResourcesClient(WORKSPACE_HOST, async () => {
    requestCount += 1;
    return new Response("forbidden", { status: 403 });
  });

  await assert.rejects(client.listJobs(caller), {
    status: 403,
    code: "databricks_resource_access_denied",
  });
  assert.equal(requestCount, 1);
});

test("WorkspaceExecutionResourcesClient_RejectsInvalidRecordsAndUnpinnedHosts", async () => {
  const invalidClient = createWorkspaceExecutionResourcesClient(WORKSPACE_HOST, async () =>
    jsonResponse({ jobs: [{ job_id: 1, settings: { name: "\u0000hidden" } }] }),
  );

  await assert.rejects(invalidClient.listJobs(caller), { status: 502 });
  assert.throws(
    () => createWorkspaceExecutionResourcesClient("https://attacker.example/path"),
    /HTTPS workspace origin/,
  );
});

test("WorkspaceExecutionResourcesClient_RequiresForwardedUserTokenBeforeFetching", async () => {
  let requestCount = 0;
  const client = createWorkspaceExecutionResourcesClient(WORKSPACE_HOST, async () => {
    requestCount += 1;
    return jsonResponse({ jobs: [] });
  });

  await assert.rejects(
    client.listSqlWarehouses({ ...caller, databricksAccessToken: null }),
    { status: 401, code: "databricks_session_required" },
  );
  assert.equal(requestCount, 0);
});

test("WorkspaceExecutionResourcesClient_PropagatesCallerCancellation", async () => {
  const controller = new AbortController();
  const client = createWorkspaceExecutionResourcesClient(WORKSPACE_HOST, async (_input, init) => {
    assert.ok(init?.signal);
    controller.abort();
    throw controller.signal.reason;
  });

  await assert.rejects(client.listJobs(caller, controller.signal));
});

const caller: CallerIdentity = {
  userId: "workspace-user",
  preferredUsername: null,
  email: null,
  workspaceId: "workspace-1",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: "caller-token",
};

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
