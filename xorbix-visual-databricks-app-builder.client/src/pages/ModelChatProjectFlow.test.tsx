import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProject } from "../api/projectsApi";
import {
  generateProjectPreview,
  getProjectComponents,
  replaceProjectComponents,
} from "../api/projectComponentsApi";
import { listWorkspaceServingEndpoints } from "../api/workspaceResourcesApi";
import type { IProject } from "../models/Project";
import type { IProjectComponent } from "../models/ProjectComponents";
import { SettingsProvider } from "../context/SettingsContext";
import { ThemeProvider } from "../context/ThemeContext";
import StandaloneAppLayout from "../layouts/StandaloneAppLayout";
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
  listWorkspaceServingEndpoints: vi.fn(),
}));

const getProjectMock = vi.mocked(getProject);
const generateProjectPreviewMock = vi.mocked(generateProjectPreview);
const getProjectComponentsMock = vi.mocked(getProjectComponents);
const replaceProjectComponentsMock = vi.mocked(replaceProjectComponents);
const listWorkspaceServingEndpointsMock = vi.mocked(listWorkspaceServingEndpoints);
const project: IProject = {
  id: "project-model-chat",
  name: "Workspace model chat",
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
    files: [{ path: "app.py", content: "_vdab_render_model_chat('modelChat1')" }],
  });
  listWorkspaceServingEndpointsMock.mockResolvedValue({
    items: [{ name: "support-chat", readiness: "ready", permissionLevel: "CAN_QUERY" }],
    authenticationMode: "databricks",
  });
});

describe("ModelChat standalone project flow", () => {
  it("adds, selects, configures, saves, previews, and reopens a workspace endpoint", async () => {
    const user = userEvent.setup();
    const firstEditor = await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Model Chat" }));
    await user.selectOptions(
      await screen.findByLabelText("Serving endpoint in this workspace"),
      "support-chat",
    );
    await user.clear(screen.getByLabelText("Chat title"));
    await user.type(screen.getByLabelText("Chat title"), "Support questions");
    await user.clear(screen.getByLabelText("Chat height (px)"));
    await user.type(screen.getByLabelText("Chat height (px)"), "720");
    await user.click(screen.getByLabelText("Show chat border"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "ModelChat",
      properties: {
        servingEndpointName: "support-chat",
        title: "Support questions",
        showBorder: true,
        chatTotalHeightPixels: 720,
      },
      bindings: null,
      children: [],
      layout: null,
    });
    expect(JSON.stringify(savedComponents)).not.toMatch(/workspaceHost|workspaceUrl|accessToken|AppResource/);

    await user.click(screen.getAllByRole("link", { name: "Code" })[0]!);
    expect(await screen.findByLabelText("Generated app code")).toHaveTextContent("_vdab_render_model_chat");
    expect(generateProjectPreviewMock).toHaveBeenCalled();

    firstEditor.unmount();
    await renderProjectEditorPage({ selectFirstComponent: true });
    expect(await screen.findByLabelText("Serving endpoint in this workspace")).toHaveValue("support-chat");
    expect(screen.getByLabelText("Chat title")).toHaveValue("Support questions");
    expect(screen.getByLabelText("Chat height (px)")).toHaveValue(720);
    expect(screen.getByLabelText("Show chat border")).toBeChecked();
    expect(screen.getByText(/model-serving user authorization scope/)).toBeInTheDocument();
  });
});

async function renderProjectEditorPage(options: { selectFirstComponent?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps", element: <StandaloneAppLayout />, children: [{ path: ":appId", element: <ProjectEditorPage /> }, { index: true, element: <h1>Project list route</h1> }] }],
    { initialEntries: ["/apps/project-model-chat"] },
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
