import { afterEach, describe, expect, it, vi } from "vitest";
import { listProjectCollaborators, revokeProjectCollaborator } from "./projectCollaboratorsApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("projectCollaboratorsApi", () => {
  it("lists and validates collaborator grants", async () => {
    const grant = {
      userId: "editor@example.com",
      role: "editor",
      grantedBy: "owner@example.com",
      createdAt: "2026-10-20T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ items: [grant] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjectCollaborators("project/1")).resolves.toMatchObject([grant]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project%2F1/collaborators",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("rejects malformed grants", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ items: [{ userId: "editor" }] })));

    await expect(listProjectCollaborators("project-1")).rejects.toThrow("invalid grant");
  });

  it("deletes one encoded grant and requires a no-content response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(revokeProjectCollaborator("project-1", "user/a@example.com")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/collaborators/user%2Fa%40example.com",
      { method: "DELETE", credentials: "same-origin" },
    );
  });
});
