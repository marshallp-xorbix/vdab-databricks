import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject, exportProject, importProject, listProjects, updateProject } from "./projectsApi";

const project = {
  id: "project-1",
  name: "Revenue",
  description: null,
  version: 1,
  createdBy: "user-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("projectsApi", () => {
  it("lists and validates the project response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ items: [project] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listProjects();

    expect(result.items[0]).toMatchObject(project);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("creates a project using only editable metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(project));
    vi.stubGlobal("fetch", fetchMock);

    await createProject({ name: "Revenue", description: null });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Revenue", description: null }),
      }),
    );
  });

  it("saves metadata with the optimistic version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ ...project, version: 2 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateProject({
      id: "project-1",
      name: "Revenue updated",
      description: "Current quarter",
      version: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          name: "Revenue updated",
          description: "Current quarter",
          version: 1,
        }),
      }),
    );
  });

  it("rejects malformed project payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ items: [{ id: "missing-fields" }] })),
    );

    await expect(listProjects()).rejects.toThrow("invalid project");
  });

  it("exports a validated standalone archive from the project route", async () => {
    const bundle = {
      format: "vdab-project",
      schemaVersion: 1,
      exportedAt: "2026-10-20T00:00:00.000Z",
      project: { name: "Revenue", components: [] },
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(bundle));
    vi.stubGlobal("fetch", fetchMock);

    await expect(exportProject("project-1")).resolves.toMatchObject(bundle);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/export",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("imports the selected archive and validates unresolved references", async () => {
    const result = {
      project,
      requiresChildAppSelection: true,
      unresolvedResources: [{ key: "resource_1", kind: "databricksJob", label: "Refresh" }],
    };
    const bundle = { format: "vdab-project", schemaVersion: 1, project: {} };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(result, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(importProject(bundle)).resolves.toMatchObject(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/import",
      expect.objectContaining({ method: "POST", body: JSON.stringify(bundle) }),
    );
  });
});
