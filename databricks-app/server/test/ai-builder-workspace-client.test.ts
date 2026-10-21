import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import { AiBuilderWorkspaceClient } from "../src/ai-builder-workspace-client.ts";

const CALLER: CallerIdentity = {
  userId: "ai-user",
  preferredUsername: "ai-user",
  email: "ai@example.com",
  workspaceId: "workspace-1",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: "forwarded-user-token",
};

test("AiBuilderWorkspaceClient_UsesPinnedWorkspaceAndForwardedCallerToken", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const client = new AiBuilderWorkspaceClient("https://workspace.example/", async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return createStreamResponse();
  });
  await client.invoke(CALLER, "customer-model", [], new AbortController().signal);

  assert.equal(requestUrl, "https://workspace.example/serving-endpoints/customer-model/invocations");
  assert.equal(requestInit?.redirect, "error");
  assert.equal(new Headers(requestInit?.headers).get("authorization"), "Bearer forwarded-user-token");
  assert.equal(JSON.parse(String(requestInit?.body)).stream, true);
  assert.doesNotMatch(JSON.stringify(requestInit?.body), /forwarded-user-token/);
});

test("AiBuilderWorkspaceClient_DeniesLocalIdentityWithoutCallingEndpoint", async () => {
  let callCount = 0;
  const client = new AiBuilderWorkspaceClient("https://workspace.example/", async () => {
    callCount += 1;
    return createStreamResponse();
  });
  await assert.rejects(
    client.invoke({ ...CALLER, authenticationMode: "local-test", databricksAccessToken: null }, "customer-model", [], new AbortController().signal),
    (error: unknown) => isApplicationError(error, 401),
  );
  assert.equal(callCount, 0);
});

test("AiBuilderWorkspaceClient_MapsEndpointPermissionFailureWithoutUpstreamBody", async () => {
  const client = new AiBuilderWorkspaceClient("https://workspace.example/", async () =>
    new Response("caller secret and endpoint details", { status: 403 }),
  );
  await assert.rejects(
    client.invoke(CALLER, "customer-model", [], new AbortController().signal),
    (error: unknown) => error instanceof Error &&
      "status" in error && error.status === 403 &&
      !error.message.includes("caller secret"),
  );
});

function createStreamResponse(): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
}

function isApplicationError(value: unknown, expectedStatus: number): boolean {
  return value instanceof Error && "status" in value && value.status === expectedStatus;
}
