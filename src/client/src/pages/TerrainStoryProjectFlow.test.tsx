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
  id: "project-terrain-story",
  name: "Production dashboard",
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
    files: [{ path: "app.py", content: "const payload = __TERRAIN_PAYLOAD__" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({ items: [{ name: "main" }], authenticationMode: "databricks" });
  listWorkspaceSchemasMock.mockResolvedValue({ items: [{ name: "analytics" }], authenticationMode: "databricks" });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{
      name: "production_grid",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "line_name", type: "STRING", dataType: "STRING" },
        { name: "product_family", type: "STRING", dataType: "STRING" },
        { name: "report_month", type: "DATE", dataType: "DATE" },
        { name: "output_units", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "terrain_category", type: "STRING", dataType: "STRING" },
        { name: "risk_score", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "target_value", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "baseline_value", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "forecast_value", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "volume", type: "INT", dataType: "INTEGER" },
        { name: "status", type: "STRING", dataType: "STRING" },
        { name: "event_name", type: "STRING", dataType: "STRING" },
        { name: "event_date", type: "DATE", dataType: "DATE" },
        { name: "callout_text", type: "STRING", dataType: "STRING" },
      ],
    }],
    authenticationMode: "databricks",
  });
});

describe("TerrainStory standalone project flow", () => {
  it("adds, maps, configures, saves, previews, and reopens the story", async () => {
    const user = userEvent.setup();
    const firstEditor = await renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add Terrain Story" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Production output terrain");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "analytics");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "production_grid");

    for (const [label, column] of [
      ["X dimension column", "line_name"], ["Y dimension column", "product_family"],
      ["Height metric column", "output_units"], ["Time field column", "report_month"],
      ["Terrain category column", "terrain_category"], ["Risk score column", "risk_score"],
      ["Target value column", "target_value"], ["Baseline value column", "baseline_value"],
      ["Forecast value column", "forecast_value"], ["Volume metric column", "volume"],
      ["Status column", "status"], ["Event name column", "event_name"],
      ["Event date column", "event_date"], ["Callout text column", "callout_text"],
    ]) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
      await user.selectOptions(screen.getByLabelText(label), column);
    }
    await user.selectOptions(screen.getByLabelText("Height metric aggregation"), "max");
    await user.selectOptions(screen.getByLabelText("Terrain mode"), "ridge");
    await user.selectOptions(screen.getByLabelText("Height fallback aggregation"), "min");
    await user.clear(screen.getByLabelText("Height scale"));
    await user.type(screen.getByLabelText("Height scale"), "2.4");
    await user.selectOptions(screen.getByLabelText("Interpolation"), "none");
    await user.clear(screen.getByLabelText("Grid resolution"));
    await user.type(screen.getByLabelText("Grid resolution"), "80");
    await user.selectOptions(screen.getByLabelText("Color by"), "variance");
    await user.selectOptions(screen.getByLabelText("Camera preset"), "top");
    await user.click(screen.getByLabelText("Show peak labels"));
    await user.click(screen.getByLabelText("Show valley labels"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "TerrainStory",
      properties: {
        title: "Production output terrain",
        xDimension: { field: "line_name" },
        yDimension: { field: "product_family" },
        heightMetric: { field: "output_units", transform: "max" },
        timeField: { field: "report_month" },
        terrainCategory: { field: "terrain_category" },
        riskScore: { field: "risk_score" },
        targetValue: { field: "target_value" },
        baselineValue: { field: "baseline_value" },
        forecastValue: { field: "forecast_value" },
        volumeMetric: { field: "volume" },
        status: { field: "status" },
        eventName: { field: "event_name" },
        eventDate: { field: "event_date" },
        calloutText: { field: "callout_text" },
        terrainMode: "ridge",
        heightScale: 2.4,
        interpolation: "none",
        gridResolution: 80,
        colorBy: "variance",
        showPeakLabels: false,
        showValleyLabels: false,
        cameraPreset: "top",
        aggregationMethod: "min",
      },
      bindings: {
        unityCatalogTable: {
          source: { resource: { catalog: "main", schema: "analytics", table: "production_grid" } },
        },
      },
    });

    await user.click(screen.getAllByRole("link", { name: "Code" })[0]!);
    expect(await screen.findByLabelText("Generated app code")).toHaveTextContent("__TERRAIN_PAYLOAD__");

    firstEditor.unmount();
    await renderProjectEditorPage({ selectFirstComponent: true });
    expect(await screen.findByLabelText("Title")).toHaveValue("Production output terrain");
    expect(screen.getByLabelText("Height metric column")).toHaveValue("output_units");
    expect(screen.getByLabelText("Height metric aggregation")).toHaveValue("max");
    expect(screen.getByLabelText("Terrain mode")).toHaveValue("ridge");
    expect(screen.getByLabelText("Height scale")).toHaveValue(2.4);
    expect(screen.getByLabelText("Grid resolution")).toHaveValue(80);
    expect(screen.getByLabelText("Camera preset")).toHaveValue("top");
    expect(screen.getByLabelText("Show peak labels")).not.toBeChecked();
    expect(screen.getByLabelText("Show valley labels")).not.toBeChecked();
  }, 60_000);
});

async function renderProjectEditorPage(options: { selectFirstComponent?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps", element: <StandaloneAppLayout />, children: [{ path: ":appId", element: <ProjectEditorPage /> }, { index: true, element: <h1>Project list route</h1> }] }],
    { initialEntries: ["/apps/project-terrain-story"] },
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
