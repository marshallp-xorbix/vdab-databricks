import { afterEach, describe, expect, it, vi } from "vitest";
import { getProjectCustomModules, replaceProjectCustomModules } from "./projectCustomModulesApi";

afterEach(() => vi.unstubAllGlobals());

describe("projectCustomModulesApi", () => {
  it("loads a validated module document through the project route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      projectId: "project/one",
      version: 3,
      source: "def example(ctx):\n    return None\n",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const document = await getProjectCustomModules("project/one");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project%2Fone/custom-modules",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(document).toEqual({
      projectId: "project/one",
      version: 3,
      source: "def example(ctx):\n    return None\n",
    });
  });

  it("saves source against the current shared project version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      projectId: "project-1",
      version: 4,
      source: "# updated",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await replaceProjectCustomModules({
      projectId: "project-1",
      version: 3,
      source: "# updated",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      expectedVersion: 3,
      source: "# updated",
    });
  });
});
