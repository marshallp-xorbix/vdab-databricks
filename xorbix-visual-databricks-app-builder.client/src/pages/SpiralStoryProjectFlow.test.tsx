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
import {
  listWorkspaceCatalogs,
  listWorkspaceSchemas,
  listWorkspaceTables,
} from "../api/workspaceResourcesApi";
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
  listWorkspaceCatalogs: vi.fn(), listWorkspaceSchemas: vi.fn(), listWorkspaceTables: vi.fn(),
}));

const getProjectMock = vi.mocked(getProject);
const generateProjectPreviewMock = vi.mocked(generateProjectPreview);
const getProjectComponentsMock = vi.mocked(getProjectComponents);
const replaceProjectComponentsMock = vi.mocked(replaceProjectComponents);
const listWorkspaceCatalogsMock = vi.mocked(listWorkspaceCatalogs);
const listWorkspaceSchemasMock = vi.mocked(listWorkspaceSchemas);
const listWorkspaceTablesMock = vi.mocked(listWorkspaceTables);
const project: IProject = {
  id: "project-spiral-story",
  name: "Journey tracker",
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
    files: [{ path: "app.py", content: "const payload = __SPIRAL_PAYLOAD__" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({ items: [{ name: "main" }], authenticationMode: "databricks" });
  listWorkspaceSchemasMock.mockResolvedValue({ items: [{ name: "analytics" }], authenticationMode: "databricks" });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{
      name: "journey_milestones",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "journey", type: "STRING", dataType: "STRING" },
        { name: "stage", type: "STRING", dataType: "STRING" },
        { name: "milestone_date", type: "DATE", dataType: "DATE" },
        { name: "progress", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "metric", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
        { name: "target_date", type: "DATE", dataType: "DATE" },
        { name: "actual_date", type: "DATE", dataType: "DATE" },
        { name: "status", type: "STRING", dataType: "STRING" },
        { name: "risk", type: "INT", dataType: "INTEGER" },
        { name: "owner", type: "STRING", dataType: "STRING" },
        { name: "achievement", type: "STRING", dataType: "STRING" },
        { name: "cost", type: "BIGINT", dataType: "LONG" },
      ],
    }],
    authenticationMode: "databricks",
  });
});

describe("SpiralStory standalone project flow", () => {
  it("adds, maps, configures, saves, previews, and reopens the story", async () => {
    const user = userEvent.setup();
    const firstEditor = await renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add Spiral Story" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Journey Tracker");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "analytics");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "journey_milestones");

    for (const [label, column] of [
      ["Journey name column", "journey"], ["Stage / milestone column", "stage"],
      ["Timeline column", "milestone_date"], ["Progress % column", "progress"],
      ["Metric value column", "metric"], ["Target date column", "target_date"],
      ["Actual date column", "actual_date"], ["Status column", "status"],
      ["Risk score column", "risk"], ["Owner column", "owner"],
      ["Key achievement column", "achievement"], ["Cost column", "cost"],
    ]) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
      await user.selectOptions(screen.getByLabelText(label), column);
    }
    await user.selectOptions(screen.getByLabelText("Progress % aggregation"), "max");
    await user.selectOptions(screen.getByLabelText("Metric value aggregation"), "avg");
    await user.selectOptions(screen.getByLabelText("Risk score aggregation"), "count");
    await user.selectOptions(screen.getByLabelText("Cost aggregation"), "min");
    await user.click(screen.getByLabelText("Show milestone labels"));
    await user.click(screen.getByLabelText("Show high-risk glow"));
    await user.click(screen.getByLabelText("Show schedule variance"));
    await user.click(screen.getByLabelText("Space milestones by timeline"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "SpiralStory",
      codeName: "spiralStory1",
      properties: {
        title: "Journey Tracker",
        journeyName: { field: "journey" },
        stage: { field: "stage" },
        timelineField: { field: "milestone_date" },
        progressPct: { field: "progress", transform: "max" },
        metricValue: { field: "metric", transform: "avg" },
        targetDate: { field: "target_date" },
        actualDate: { field: "actual_date" },
        status: { field: "status" },
        riskScore: { field: "risk", transform: "count" },
        owner: { field: "owner" },
        keyAchievement: { field: "achievement" },
        cost: { field: "cost", transform: "min" },
        showLabels: false,
        showRiskGlow: false,
        showVariance: false,
        spaceByTimeline: true,
      },
      bindings: {
        unityCatalogTable: {
          source: { resource: { catalog: "main", schema: "analytics", table: "journey_milestones" } },
        },
      },
    });

    await user.click(screen.getAllByRole("link", { name: "Code" })[0]!);
    expect(await screen.findByLabelText("Generated app code")).toHaveTextContent("__SPIRAL_PAYLOAD__");

    firstEditor.unmount();
    await renderProjectEditorPage({ selectFirstComponent: true });
    expect(await screen.findByLabelText("Title")).toHaveValue("Journey Tracker");
    expect(screen.getByLabelText("Journey name column")).toHaveValue("journey");
    expect(screen.getByLabelText("Progress % aggregation")).toHaveValue("max");
    expect(screen.getByLabelText("Cost aggregation")).toHaveValue("min");
    expect(screen.getByLabelText("Show milestone labels")).not.toBeChecked();
    expect(screen.getByLabelText("Show high-risk glow")).not.toBeChecked();
    expect(screen.getByLabelText("Show schedule variance")).not.toBeChecked();
    expect(screen.getByLabelText("Space milestones by timeline")).toBeChecked();
  }, 30_000);
});

async function renderProjectEditorPage(options: { selectFirstComponent?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps", element: <StandaloneAppLayout />, children: [{ path: ":appId", element: <ProjectEditorPage /> }, { index: true, element: <h1>Project list route</h1> }] }],
    { initialEntries: ["/apps/project-spiral-story"] },
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
