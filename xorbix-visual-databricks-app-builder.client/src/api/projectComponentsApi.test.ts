import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateProjectPreview,
  getProjectComponents,
  replaceProjectComponents,
} from "./projectComponentsApi";

const component = {
  key: "customer-name",
  type: "TextInput",
  schemaVersion: 1,
  componentVersion: 1,
  codeName: "customerName",
  description: null,
  properties: { label: "Customer name" },
  bindings: null,
  children: [],
  layout: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("projectComponentsApi", () => {
  it("loads and validates the ordered component aggregate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        projectId: "project-1",
        version: 3,
        components: [component],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const result = await getProjectComponents("project-1", controller.signal);

    expect(result.components[0]).toMatchObject(component);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/components",
      expect.objectContaining({
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }),
    );
  });

  it("replaces components using the project version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        projectId: "project-1",
        version: 4,
        components: [component],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await replaceProjectComponents({
      projectId: "project-1",
      version: 3,
      components: [component],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/components",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ version: 3, components: [component] }),
      }),
    );
  });

  it("requests preview without sending workspace authority", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        projectId: "project-1",
        version: 4,
        previewOnly: true,
        files: [{ path: "app.py", content: "import streamlit as st\\n" }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateProjectPreview("project-1");

    expect(result.previewOnly).toBe(true);
    expect(result.files[0]?.path).toBe("app.py");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/preview",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("rejects malformed component and preview responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ components: [] })));
    await expect(getProjectComponents("project-1")).rejects.toThrow(
      "invalid component document",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          projectId: "project-1",
          version: 2,
          previewOnly: false,
          files: [],
        }),
      ),
    );
    await expect(generateProjectPreview("project-1")).rejects.toThrow(
      "invalid preview",
    );
  });
});
