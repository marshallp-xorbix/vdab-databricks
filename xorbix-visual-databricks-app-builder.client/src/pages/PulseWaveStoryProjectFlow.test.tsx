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
  generateProjectPreview: vi.fn(),
  getProjectComponents: vi.fn(),
  replaceProjectComponents: vi.fn(),
}));
vi.mock("../api/workspaceResourcesApi", () => ({
  listWorkspaceCatalogs: vi.fn(),
  listWorkspaceSchemas: vi.fn(),
  listWorkspaceTables: vi.fn(),
}));

const getProjectMock = vi.mocked(getProject);
const generateProjectPreviewMock = vi.mocked(generateProjectPreview);
const getProjectComponentsMock = vi.mocked(getProjectComponents);
const replaceProjectComponentsMock = vi.mocked(replaceProjectComponents);
const listWorkspaceCatalogsMock = vi.mocked(listWorkspaceCatalogs);
const listWorkspaceSchemasMock = vi.mocked(listWorkspaceSchemas);
const listWorkspaceTablesMock = vi.mocked(listWorkspaceTables);
const project: IProject = {
  id: "project-pulse-wave-story",
  name: "Weekly revenue",
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
    files: [{ path: "app.py", content: "const payload = __PULSE_WAVE_PAYLOAD__" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({ items: [{ name: "main" }], authenticationMode: "databricks" });
  listWorkspaceSchemasMock.mockResolvedValue({ items: [{ name: "analytics" }], authenticationMode: "databricks" });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{
      name: "weekly_revenue",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "period", type: "DATE", dataType: "DATE" },
        { name: "revenue", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "target_revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
        { name: "event_name", type: "STRING", dataType: "STRING" },
        { name: "event_type", type: "STRING", dataType: "STRING" },
        { name: "impact_score", type: "INT", dataType: "INTEGER" },
      ],
    }],
    authenticationMode: "databricks",
  });
});

describe("PulseWaveStory standalone project flow", () => {
  it("adds, maps, configures, saves, previews, and reopens the story", async () => {
    const user = userEvent.setup();
    const firstEditor = await renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add Pulse Wave Story" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Weekly revenue pulse");
    await user.clear(screen.getByLabelText("Metric name"));
    await user.type(screen.getByLabelText("Metric name"), "Net revenue");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "analytics");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "weekly_revenue");

    for (const [label, column] of [
      ["Time period column", "period"],
      ["Metric value column", "revenue"],
      ["Baseline / target column", "target_revenue"],
      ["Event name column", "event_name"],
      ["Event type column", "event_type"],
      ["Impact score column", "impact_score"],
    ]) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
      await user.selectOptions(screen.getByLabelText(label), column);
    }
    await user.selectOptions(screen.getByLabelText("Metric value aggregation"), "max");
    await user.selectOptions(screen.getByLabelText("Baseline / target aggregation"), "min");
    await user.selectOptions(screen.getByLabelText("Impact score aggregation"), "sum");
    await user.selectOptions(screen.getByLabelText("Metric aggregation default"), "avg");
    await user.click(screen.getByLabelText("Show baseline"));
    await user.click(screen.getByLabelText("Show events"));
    await user.click(screen.getByLabelText("Show anomaly markers"));
    await user.click(screen.getByLabelText("Fill under wave"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "PulseWaveStory",
      codeName: "pulseWaveStory1",
      properties: {
        title: "Weekly revenue pulse",
        metricName: "Net revenue",
        timeField: { field: "period" },
        metricValue: { field: "revenue", transform: "max" },
        baselineValue: { field: "target_revenue", transform: "min" },
        eventName: { field: "event_name" },
        eventType: { field: "event_type" },
        impactScore: { field: "impact_score", transform: "sum" },
        aggregationMethod: "avg",
        showBaseline: false,
        showEvents: false,
        showAnomalyMarkers: false,
        fillUnderWave: false,
      },
      bindings: {
        unityCatalogTable: {
          source: { resource: { catalog: "main", schema: "analytics", table: "weekly_revenue" } },
        },
      },
    });

    await user.click(screen.getAllByRole("link", { name: "Code" })[0]!);
    expect(await screen.findByLabelText("Generated app code")).toHaveTextContent("__PULSE_WAVE_PAYLOAD__");

    firstEditor.unmount();
    await renderProjectEditorPage({ selectFirstComponent: true });
    expect(await screen.findByLabelText("Title")).toHaveValue("Weekly revenue pulse");
    expect(screen.getByLabelText("Metric name")).toHaveValue("Net revenue");
    expect(screen.getByLabelText("Time period column")).toHaveValue("period");
    expect(screen.getByLabelText("Metric value aggregation")).toHaveValue("max");
    expect(screen.getByLabelText("Baseline / target aggregation")).toHaveValue("min");
    expect(screen.getByLabelText("Show baseline")).not.toBeChecked();
    expect(screen.getByLabelText("Show events")).not.toBeChecked();
    expect(screen.getByLabelText("Show anomaly markers")).not.toBeChecked();
    expect(screen.getByLabelText("Fill under wave")).not.toBeChecked();
  }, 30_000);
});

async function renderProjectEditorPage(options: { selectFirstComponent?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps", element: <StandaloneAppLayout />, children: [{ path: ":appId", element: <ProjectEditorPage /> }, { index: true, element: <h1>Project list route</h1> }] }],
    { initialEntries: ["/apps/project-pulse-wave-story"] },
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
