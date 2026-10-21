import { afterEach, describe, expect, it, vi } from "vitest";
import { getProjectWorkflow, replaceProjectWorkflow } from "./projectWorkflowApi";

afterEach(() => vi.unstubAllGlobals());

describe("projectWorkflowApi", () => {
  it("loads a workflow through same-origin project routes and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(workflowDocument));
    vi.stubGlobal("fetch", fetchMock);

    const response = await getProjectWorkflow("project/one");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project%2Fone/workflow",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(response.version).toBe(4);
    expect(response.workflow.workflows[0]?.trigger).toEqual({
      componentKey: "submit",
      eventKey: "onClick",
    });
  });

  it("saves only portable workflow fields at the shared project version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(workflowDocument));
    vi.stubGlobal("fetch", fetchMock);

    const workflow = {
      version: 1 as const,
      workflows: [{
        codeName: "onClick",
        trigger: { componentKey: "submit", eventKey: "onClick" },
        nodes: [{
          id: "toast",
          actionType: "triggerToast" as const,
          schemaVersion: 1 as const,
          params: { body: "Saved", duration: { kind: "preset", value: "short" } },
        }],
        edges: [],
      }],
    };

    await replaceProjectWorkflow({ projectId: "project-one", version: 3, workflow });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.method).toBe("PUT");
    expect(request.credentials).toBe("same-origin");
    expect(JSON.parse(String(request.body))).toEqual({ version: 3, workflow });
    expect(String(request.body)).not.toMatch(/workspaceConnectionId|workspaceHost|accessToken/);
  });

  it("rejects malformed successful response bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ version: 1 })));

    await expect(getProjectWorkflow("project-one")).rejects.toThrow(
      "invalid workflow document",
    );
  });
});

const workflowDocument = {
  projectId: "project-one",
  version: 4,
  workflow: {
    version: 1,
    workflows: [{
      codeName: "onClick",
      trigger: { componentKey: "submit", eventKey: "onClick" },
      nodes: [],
      edges: [],
    }],
  },
};

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
