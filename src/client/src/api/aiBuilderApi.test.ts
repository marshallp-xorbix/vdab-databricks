import { afterEach, describe, expect, it, vi } from "vitest";
import { AiBuilderApiError, generateAiBuilderProposal } from "./aiBuilderApi";
import type { IAiBuilderRequest } from "../models/AiBuilder";

afterEach(() => vi.unstubAllGlobals());

describe("aiBuilderApi", () => {
  it("posts project context and streams progress plus a validated proposal", async () => {
    const progressMessages: string[] = [];
    const controller = new AbortController();
    const request = createRequest();
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([
      "event: progress\ndata: {\"message\":\"Planning the change\"}\n\n",
      `event: result\ndata: ${JSON.stringify({
        assistantMessage: "Added a save button.",
        proposal: {
          components: [buttonComponent],
          workflow: { version: 1, workflows: [] },
          customModulesSource: "# modules\n",
        },
        version: 3,
      })}\n\n`,
    ]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateAiBuilderProposal(
      "project/one",
      request,
      (message) => progressMessages.push(message),
      controller.signal,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project%2Fone/ai-builder",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
      }),
    );
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual(request);
    expect(progressMessages).toEqual(["Planning the change"]);
    expect(result).toEqual({
      assistantMessage: "Added a save button.",
      proposal: {
        components: [buttonComponent],
        workflow: { version: 1, workflows: [] },
        customModulesSource: "# modules\n",
      },
      version: 3,
    });
  });

  it("accepts text-only turns with no proposal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([
      `event: result\ndata: ${JSON.stringify({
        assistantMessage: "What should the button do?",
        proposal: null,
        version: 3,
      })}\n\n`,
    ])));

    await expect(generateAiBuilderProposal("project-one", createRequest())).resolves.toEqual({
      assistantMessage: "What should the button do?",
      proposal: null,
      version: 3,
    });
  });

  it("surfaces RFC 9457 Problem Details from stream errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([
      "event: error\ndata: {\"title\":\"Endpoint unavailable\",\"status\":503,\"detail\":\"Try another endpoint.\"}\n\n",
    ])));

    await expect(generateAiBuilderProposal("project-one", createRequest())).rejects.toMatchObject({
      name: "AiBuilderApiError",
      message: "Try another endpoint.",
      problem: {
        title: "Endpoint unavailable",
        status: 503,
        detail: "Try another endpoint.",
      },
    } satisfies Partial<AiBuilderApiError>);
  });

  it("rejects malformed proposals and streams without a result", async () => {
    const malformedProposal = {
      assistantMessage: "Here is a proposal.",
      proposal: { components: [{ key: "broken" }], workflow: { version: 1, workflows: [] }, customModulesSource: "" },
      version: 3,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([
      `event: result\ndata: ${JSON.stringify(malformedProposal)}\n\n`,
    ])));
    await expect(generateAiBuilderProposal("project-one", createRequest())).rejects.toThrow(
      "AI Builder returned an invalid project component.",
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([
      "event: progress\ndata: {\"message\":\"Still working\"}\n\n",
    ])));
    await expect(generateAiBuilderProposal("project-one", createRequest())).rejects.toThrow(
      "The AI Builder stream ended without a result event.",
    );
  });

  it("maps HTTP Problem Details before the event stream begins", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ title: "Project changed", status: 409, detail: "Reload and retry." }),
      { status: 409, headers: { "content-type": "application/problem+json" } },
    )));

    await expect(generateAiBuilderProposal("project-one", createRequest())).rejects.toMatchObject({
      message: "Reload and retry.",
      problem: { title: "Project changed", status: 409, detail: "Reload and retry." },
    });
  });
});

const buttonComponent = {
  key: "save-button",
  type: "Button",
  schemaVersion: 1,
  componentVersion: 1,
  codeName: "saveButton",
  description: null,
  properties: { label: "Save" },
  bindings: null,
  children: [],
  layout: null,
};

function createRequest(): IAiBuilderRequest {
  return {
    version: 3,
    endpointName: "builder-model",
    prompt: "Add a save button",
    history: [{ role: "user", content: "Create a form" }],
    components: [],
    workflow: { version: 1, workflows: [] },
    customModulesSource: "# modules\n",
  };
}

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

