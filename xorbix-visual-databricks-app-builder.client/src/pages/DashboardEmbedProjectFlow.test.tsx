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
import type { IProject } from "../models/Project";
import type { IProjectComponent } from "../models/ProjectComponents";
import ProjectEditorPage from "./ProjectEditorPage";

vi.mock("../api/projectsApi", () => ({ getProject: vi.fn(), updateProject: vi.fn() }));
vi.mock("../api/projectComponentsApi", () => ({
  generateProjectPreview: vi.fn(), getProjectComponents: vi.fn(), replaceProjectComponents: vi.fn(),
}));

const getProjectMock = vi.mocked(getProject);
const generateProjectPreviewMock = vi.mocked(generateProjectPreview);
const getProjectComponentsMock = vi.mocked(getProjectComponents);
const replaceProjectComponentsMock = vi.mocked(replaceProjectComponents);
const project: IProject = {
  id: "project-dashboard-embed",
  name: "Quarterly overview",
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
    files: [{ path: "app.py", content: "components.iframe(_vdab_dashboard_src)" }],
  });
});

describe("DashboardEmbed standalone project flow", () => {
  it("adds, configures, saves, previews, and reopens a current-workspace embed", async () => {
    const user = userEvent.setup();
    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add dashboard embed" }));

    const urlInput = screen.getByLabelText("Published dashboard embed URL");
    await user.type(
      urlInput,
      "https://former-workspace.cloud.databricks.com/embed/dashboardsv3/revenue_12?o=999999&fullscreenWidget=page_1~chart_2",
    );
    await user.clear(screen.getByLabelText("Height (px)"));
    await user.type(screen.getByLabelText("Height (px)"), "720");
    await user.click(screen.getByLabelText("Allow dashboard scrolling"));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "DashboardEmbed",
      properties: {
        src: "/embed/dashboardsv3/revenue_12?fullscreenWidget=page_1~chart_2",
        height: 720,
        scrolling: false,
      },
      bindings: null,
      children: [],
      layout: null,
    });

    await user.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview")).toHaveTextContent("components.iframe");
    expect(generateProjectPreviewMock).toHaveBeenCalled();

    firstEditor.unmount();
    renderProjectEditorPage();
    expect(await screen.findByLabelText("Published dashboard embed URL")).toHaveValue(
      "/embed/dashboardsv3/revenue_12?fullscreenWidget=page_1~chart_2",
    );
    expect(screen.getByLabelText("Height (px)")).toHaveValue(720);
    expect(screen.getByLabelText("Allow dashboard scrolling")).not.toBeChecked();
    expect(screen.getByText(/individual data permissions/)).toBeInTheDocument();
  }, 15_000);
});

function renderProjectEditorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps/:appId", element: <ProjectEditorPage /> }],
    { initialEntries: ["/apps/project-dashboard-embed"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
