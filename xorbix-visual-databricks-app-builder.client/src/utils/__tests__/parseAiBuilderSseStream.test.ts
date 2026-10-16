import { describe, expect, it } from "vitest";
import {
  parseAiBuilderSseBuffer,
  parseAiBuilderSseLine,
} from "../parseAiBuilderSseStream";

describe("parseAiBuilderSseStream", () => {
  it("parses progress events", () => {
    const event = parseAiBuilderSseLine('data: {"type":"progress","message":"Adding button..."}');

    expect(event).toEqual({ type: "progress", message: "Adding button..." });
  });

  it("parses result events and defaults status", () => {
    const event = parseAiBuilderSseLine(
      'data: {"type":"result","result":{"operations":[],"explanation":"done"}}',
    );

    expect(event?.type).toBe("result");
    if (event?.type === "result") {
      expect(event.result.status).toBe("completed");
    }
  });

  it("returns structured stream error events", () => {
    const event = parseAiBuilderSseLine(
      'data: {"type":"error","message":"failed","reason":{"code":"modelUnavailable","title":"Unavailable","message":"Try again"}}',
    );

    expect(event).toEqual({
      type: "error",
      message: "Try again",
      reason: {
        code: "modelUnavailable",
        title: "Unavailable",
        message: "Try again",
      },
    });
  });

  it("parses buffered result lines", () => {
    const result = parseAiBuilderSseBuffer(
      'data: {"type":"progress","message":"working"}\ndata: {"type":"result","result":{"status":"partial","operations":[{"op":"add"}],"explanation":"partial"}}\n',
    );

    expect(result?.status).toBe("partial");
    expect(result?.operations).toHaveLength(1);
  });
});
