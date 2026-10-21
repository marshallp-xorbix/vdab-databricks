import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProject } from "../api/projectsApi";
import {
  generateProjectPreview,
  getProjectComponents,
  replaceProjectComponents,
} from "../api/projectComponentsApi";
import { listWorkspaceGenieSpaces } from "../api/workspaceResourcesApi";
import type { IProject } from "../models/Project";
import type { IProjectComponent } from "../models/ProjectComponents";
import ProjectEditorPage from "./ProjectEditorPage";

vi.mock("../api/projectsApi", () => ({ getProject: vi.fn(), updateProject: vi.fn() }));
vi.mock("../api/projectComponentsApi", () => ({
  generateProjectPreview: vi.fn(), getProjectComponents: vi.fn(), replaceProjectComponents: vi.fn(),
}));
vi.mock("../api/workspaceResourcesApi", () => ({
  listWorkspaceCatalogs: vi.fn(),
  listWorkspaceSchemas: vi.fn(),
  listWorkspaceTables: vi.fn(),
  listWorkspaceVolumes: vi.fn(),
  listWorkspaceGenieSpaces: vi.fn(),
}));

const getProjectMock = vi.mocked(getProject);
const generateProjectPreviewMock = vi.mocked(generateProjectPreview);
const getProjectComponentsMock = vi.mocked(getProjectComponents);
const replaceProjectComponentsMock = vi.mocked(replaceProjectComponents);
const listWorkspaceGenieSpacesMock = vi.mocked(listWorkspaceGenieSpaces);
const project: IProject = {
  id: "project-genie-chat",
  name: "Genie workspace chat",
  description: null,
  version: 1,
  createdBy: "user-1",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  callerRole: "owner",
};

let savedComponents: IProjectComponent[] = [];

beforeEach(() => {
  savedComponents = [];
  getProjectMock.mockResolvedValue(project);
  getProjectComponentsMock.mockImplementation(async () => ({
    projectId: project.id,
    version: savedComponents.length === 0 ? 1 : 2,
    components: savedComponents,
  }));
  replaceProjectComponentsMock.mockImplementation(async (input) => {
    savedComponents = input.components;
    return { projectId: input.projectId, version: input.version + 1, components: input.components };
  });
  generateProjectPreviewMock.mockResolvedValue({
    projectId: project.id,
    version: 2,
    previewOnly: true,
    files: [{ path: "app.py", content: "_vdab_render_genie_chat('genieChat1')" }],
  });
  listWorkspaceGenieSpacesMock.mockResolvedValue({
    items: [{ spaceId: "0123456789abcdef0123456789abcdef", title: "Revenue Genie" }],
    authenticationMode: "databricks",
  });
});

describe("GenieChat standalone project flow", () => {
  it("adds, selects, configures, saves, previews, and reopens a workspace Genie space", async () => {
    const user = userEvent.setup();
    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Genie chat" }));
    await user.selectOptions(
      await screen.findByLabelText("Genie space in this workspace"),
      "0123456789abcdef0123456789abcdef",
    );
    await user.clear(screen.getByLabelText("Chat title"));
    await user.type(screen.getByLabelText("Chat title"), "Revenue questions");
    await user.clear(screen.getByLabelText("Chat height (px)"));
    await user.type(screen.getByLabelText("Chat height (px)"), "720");
    await user.click(screen.getByLabelText("Show chat border"));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "GenieChat",
      properties: {
        genieSpaceId: "0123456789abcdef0123456789abcdef",
        genieSpaceTitle: "Revenue Genie",
        title: "Revenue questions",
        showBorder: true,
        chatTotalHeightPixels: 720,
      },
      bindings: null,
      children: [],
      layout: null,
    });

    await user.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview")).toHaveTextContent("_vdab_render_genie_chat");
    expect(generateProjectPreviewMock).toHaveBeenCalled();

    firstEditor.unmount();
    renderProjectEditorPage();
    expect(await screen.findByLabelText("Genie space in this workspace")).toHaveValue(
      "0123456789abcdef0123456789abcdef",
    );
    expect(screen.getByLabelText("Chat title")).toHaveValue("Revenue questions");
    expect(screen.getByLabelText("Chat height (px)")).toHaveValue(720);
    expect(screen.getByLabelText("Show chat border")).toBeChecked();
    expect(screen.getByText(/Genie user authorization scope/)).toBeInTheDocument();
  });
});

function renderProjectEditorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps/:appId", element: <ProjectEditorPage /> }],
    { initialEntries: ["/apps/project-genie-chat"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
