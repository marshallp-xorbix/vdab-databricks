import assert from "node:assert/strict";
import test from "node:test";
import { readAiBuilderCompletion } from "../src/ai-builder-stream.ts";

test("AiBuilderStream_ParsesChunkedToolArgumentsAndStreamsProgress", async () => {
  const args = JSON.stringify({
    assistantMessage: "Added a title.",
    operationsJson: JSON.stringify([{ type: "deleteWorkflow", codeName: "obsolete" }]),
  });
  const chunks = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: "Working" } }] })}\r\n\r\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "apply_project_operations", arguments: args } }] } }] })}\r\n\r\n`,
    "data: [DONE]\r\n\r\n",
  ];
  const progress: string[] = [];
  const result = await readAiBuilderCompletion(
    createStreamResponse(chunks),
    new AbortController().signal,
    (message) => progress.push(message),
  );

  assert.equal(result.assistantMessage, "Working");
  assert.equal(result.toolName, "apply_project_operations");
  assert.equal(result.toolArgumentsJson, args);
  assert.deepEqual(progress, ["Working"]);
});

test("AiBuilderStream_ReturnsTextOnlyAnswerWithoutAProposal", async () => {
  const result = await readAiBuilderCompletion(
    createStreamResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "No edits needed." } }] })}\n\n`,
      "data: [DONE]\n\n",
    ]),
    new AbortController().signal,
    () => undefined,
  );

  assert.deepEqual(result, { assistantMessage: "No edits needed.", toolName: null, toolArgumentsJson: null });
});

test("AiBuilderStream_RejectsParallelToolCallsAndInvalidEvents", async () => {
  const parallel = createStreamResponse([
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 1, function: { name: "apply_project_operations" } }] } }] })}\n\n`,
  ]);
  await assert.rejects(
    readAiBuilderCompletion(parallel, new AbortController().signal, () => undefined),
    (error: unknown) => isApplicationError(error, 502),
  );

  const malformed = createStreamResponse(["data: {not-json}\n\n"]);
  await assert.rejects(
    readAiBuilderCompletion(malformed, new AbortController().signal, () => undefined),
    (error: unknown) => isApplicationError(error, 502),
  );

  const unsupportedTool = createStreamResponse([
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "propose_project_changes" } }] } }] })}\n\n`,
  ]);
  await assert.rejects(
    readAiBuilderCompletion(unsupportedTool, new AbortController().signal, () => undefined),
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
