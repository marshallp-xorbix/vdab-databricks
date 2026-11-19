import assert from "node:assert/strict";
import test from "node:test";
import { readAiBuilderCompletion } from "../src/ai-builder-stream.ts";
import { LocalTestAiBuilderWorkspaceClient } from "../src/local-test-ai-builder-client.ts";

test("AiBuilderStream_ParsesMultipleToolCallsAndStreamsProgress", async () => {
  const progress: string[] = [];
  const result = await readAiBuilderCompletion(
    createStreamResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Working" } }] })}\r\n\r\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: " on it" } }] })}\r\n\r\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{
        index: 0,
        id: "call-1",
        function: { name: "addModal", arguments: "{\"codeName\":\"workflowModal\"}" },
      }, {
        index: 1,
        id: "call-2",
        function: { name: "createWorkflow", arguments: "{\"workflowCodeName\":\"openModal\"}" },
      }] } }] })}\r\n\r\n`,
      "data: [DONE]\r\n\r\n",
    ]),
    new AbortController().signal,
    (message) => progress.push(message),
  );

  assert.equal(result.assistantMessage, "Working on it");
  assert.deepEqual(result.toolCalls.map((toolCall) => toolCall.name), ["addModal", "createWorkflow"]);
  assert.deepEqual(progress, ["Working", "Working on it"]);
});

test("LocalTestAiBuilder_ReturnsTypedToolCallsThenStops", async () => {
  const client = new LocalTestAiBuilderWorkspaceClient();
  const first = await readAiBuilderCompletion(
    await client.invoke(
      { authenticationMode: "local-test", userId: "local-editor" } as never,
      "sample-chat-endpoint",
      [],
      new AbortController().signal,
    ),
    new AbortController().signal,
    () => undefined,
  );
  assert.equal(first.toolCalls[0]?.name, "addLabel");
  assert.match(first.toolCalls[0]?.argumentsJson ?? "", /localTestTitle/);

  const second = await readAiBuilderCompletion(
    await client.invoke(
      { authenticationMode: "local-test", userId: "local-editor" } as never,
      "sample-chat-endpoint",
      [
        { role: "assistant", content: null, tool_calls: [{
          id: "local-add-label",
          type: "function",
          function: { name: "addLabel", arguments: "{}" },
        }] },
        { role: "tool", tool_call_id: "local-add-label", content: "local-test-title" },
      ],
      new AbortController().signal,
    ),
    new AbortController().signal,
    () => undefined,
  );
  assert.deepEqual(second.toolCalls, []);
  assert.match(second.assistantMessage, /local test title/i);
});

test("AiBuilderStream_ReturnsTextOnlyAnswerWithoutToolCalls", async () => {
  const result = await readAiBuilderCompletion(
    createStreamResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "No edits needed." } }] })}\n\n`,
      "data: [DONE]\n\n",
    ]),
    new AbortController().signal,
    () => undefined,
  );

  assert.deepEqual(result, { assistantMessage: "No edits needed.", toolCalls: [] });
});

test("AiBuilderStream_RejectsMalformedEvents", async () => {
  const malformed = createStreamResponse(["data: {not-json}\n\n"]);
  await assert.rejects(
    readAiBuilderCompletion(malformed, new AbortController().signal, () => undefined),
    (error: unknown) => isApplicationError(error, 502),
  );
});

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
}

function isApplicationError(value: unknown, expectedStatus: number): boolean {
  return value instanceof Error && "status" in value && value.status === expectedStatus;
}
