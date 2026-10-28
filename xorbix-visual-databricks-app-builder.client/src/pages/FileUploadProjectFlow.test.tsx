import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProject, updateProject } from "../api/projectsApi";
import {
  generateProjectPreview,
  getProjectComponents,
  replaceProjectComponents,
} from "../api/projectComponentsApi";
import {
  listWorkspaceCatalogs,
  listWorkspaceSchemas,
  listWorkspaceVolumes,
} from "../api/workspaceResourcesApi";
import type { IProject } from "../models/Project";
import type { IProjectComponent } from "../models/ProjectComponents";
import { SettingsProvider } from "../context/SettingsContext";
import { ThemeProvider } from "../context/ThemeContext";
import StandaloneAppLayout from "../layouts/StandaloneAppLayout";
import ProjectEditorPage from "./ProjectEditorPage";

vi.mock("../api/projectsApi", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock("../api/projectComponentsApi", () => ({
  generateProjectPreview: vi.fn(),
  getProjectComponents: vi.fn(),
  replaceProjectComponents: vi.fn(),
}));
vi.mock("../api/workspaceResourcesApi", () => ({
  listWorkspaceCatalogs: vi.fn(),
  listWorkspaceSchemas: vi.fn(),
  listWorkspaceVolumes: vi.fn(),
}));

const getProjectMock = vi.mocked(getProject);
const updateProjectMock = vi.mocked(updateProject);
const generateProjectPreviewMock = vi.mocked(generateProjectPreview);
const getProjectComponentsMock = vi.mocked(getProjectComponents);
const replaceProjectComponentsMock = vi.mocked(replaceProjectComponents);
const listWorkspaceCatalogsMock = vi.mocked(listWorkspaceCatalogs);
const listWorkspaceSchemasMock = vi.mocked(listWorkspaceSchemas);
const listWorkspaceVolumesMock = vi.mocked(listWorkspaceVolumes);

const project: IProject = {
  id: "project-1",
  name: "File intake",
  description: null,
  version: 1,
  createdBy: "user-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

let savedComponents: IProjectComponent[] = [];

beforeEach(() => {
  savedComponents = [];
  getProjectMock.mockResolvedValue(project);
  updateProjectMock.mockResolvedValue(project);
  getProjectComponentsMock.mockImplementation(async () => ({
    projectId: project.id,
    version: savedComponents.length === 0 ? 1 : 2,
    components: savedComponents,
  }));
  replaceProjectComponentsMock.mockImplementation(async (input) => {
    savedComponents = input.components;
    return {
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    };
  });
  generateProjectPreviewMock.mockResolvedValue({
    projectId: project.id,
    version: 2,
    previewOnly: true,
    files: [{ path: "app.py", content: "st.file_uploader(accept_multiple_files=True)" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({
    items: [{ name: "main" }],
    authenticationMode: "databricks",
  });
  listWorkspaceSchemasMock.mockResolvedValue({
    items: [{ name: "landing" }],
    authenticationMode: "databricks",
  });
  listWorkspaceVolumesMock.mockResolvedValue({
    items: [{ name: "incoming" }],
    authenticationMode: "databricks",
  });
});

describe("FileUpload standalone project flow", () => {
  it("adds, binds, saves, previews, and reopens a Volume-backed uploader", async () => {
    const user = userEvent.setup();
    const firstEditor = await renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add File Upload" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Upload invoices");
    fireEvent.change(await screen.findByLabelText("Current-workspace catalog"), {
      target: { value: "main" },
    });
    await screen.findByRole("option", { name: "landing" });
    fireEvent.change(await screen.findByLabelText("Schema"), {
      target: { value: "landing" },
    });
    await screen.findByRole("option", { name: "incoming" });
    fireEvent.change(await screen.findByLabelText("Volume"), {
      target: { value: "incoming" },
    });
    await user.type(screen.getByLabelText("Destination folder"), "imports/2026");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components).toHaveLength(1);
    expect(savedInput?.components[0]).toMatchObject({
      type: "FileUpload",
      codeName: "fileUpload1",
      properties: { label: "Upload invoices" },
      bindings: {
        databricksVolume: {
          bindingType: "databricksVolume",
          source: {
            kind: "resource",
            valueType: "file",
            resource: {
              type: "databricksVolume",
              catalog: "main",
              schema: "landing",
              volume: "incoming",
              filePath: "imports/2026",
            },
          },
        },
      },
    });

    await user.click(screen.getAllByRole("link", { name: "Code" })[0]!);
    expect(await screen.findByLabelText("Generated app code"))
      .toHaveTextContent("st.file_uploader");

    firstEditor.unmount();
    await renderProjectEditorPage({ selectFirstComponent: true });

    expect(await screen.findByLabelText("Label")).toHaveValue("Upload invoices");
    expect(screen.getByLabelText("Current-workspace catalog")).toHaveValue("main");
    expect(screen.getByLabelText("Schema")).toHaveValue("landing");
    expect(screen.getByLabelText("Volume")).toHaveValue("incoming");
    expect(screen.getByLabelText("Destination folder")).toHaveValue("imports/2026");
  }, 20_000);
});

async function renderProjectEditorPage(options: { selectFirstComponent?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps", element: <StandaloneAppLayout />, children: [{ path: ":appId", element: <ProjectEditorPage /> }, { index: true, element: <h1>Project list route</h1> }] }],
    { initialEntries: ["/apps/project-1"] },
  );

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          <RouterProvider router={router} />
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>,  );
  fireEvent.doubleClick(await screen.findByText("Main Page", { exact: true }));
  if (options.selectFirstComponent) {
    (await screen.findByRole("button", { name: /^Select / })).click();
  }
  return rendered;
}
