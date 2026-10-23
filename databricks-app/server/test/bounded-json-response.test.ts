import assert from "node:assert/strict";
import test from "node:test";
import {
  discardHttpResponseBody,
  readBoundedJsonResponse,
} from "../src/bounded-json-response.ts";

test("BoundedJsonResponse_ReadsValidJsonWithinLimit", async () => {
  const response = new Response(JSON.stringify({ name: "child-app" }));

  const result = await readBoundedJsonResponse(response, 100);

  assert.deepEqual(result, { name: "child-app" });
});

test("BoundedJsonResponse_RejectsDeclaredOversizeAndCancelsBody", async () => {
  let bodyCancelled = false;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4, 5]));
      },
      cancel() {
        bodyCancelled = true;
      },
    }),
    { headers: { "content-length": "5" } },
  );

  await assert.rejects(readBoundedJsonResponse(response, 4), /size limit/);

  assert.equal(bodyCancelled, true);
});

test("BoundedJsonResponse_RejectsStreamedOversizeWhenLengthIsUnknown", async () => {
  let bodyCancelled = false;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"data":"too large"}'));
      },
      cancel() {
        bodyCancelled = true;
      },
    }),
  );

  await assert.rejects(readBoundedJsonResponse(response, 8), /size limit/);

  assert.equal(bodyCancelled, true);
});

test("BoundedJsonResponse_RejectsMalformedJson", async () => {
  const response = new Response("not-json");

  await assert.rejects(readBoundedJsonResponse(response, 32), SyntaxError);
});

test("BoundedJsonResponse_CancelsBodyWhenCallerAborts", async () => {
  let bodyCancelled = false;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"name":"pending"}'));
      },
      cancel() {
        bodyCancelled = true;
      },
    }),
  );
  const controller = new AbortController();
  controller.abort(new Error("request canceled"));

  await assert.rejects(
    readBoundedJsonResponse(response, 64, controller.signal),
    /request canceled/,
  );

  assert.equal(bodyCancelled, true);
});

test("BoundedJsonResponse_DiscardsResponseBody", async () => {
  let bodyCancelled = false;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        bodyCancelled = true;
      },
    }),
  );

  await discardHttpResponseBody(response);

  assert.equal(bodyCancelled, true);
});
