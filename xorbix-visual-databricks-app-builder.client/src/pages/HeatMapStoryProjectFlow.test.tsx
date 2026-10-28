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
  id: "project-heat-map-story",
  name: "State revenue",
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
    files: [{ path: "app.py", content: "const payload = __HEAT_MAP_PAYLOAD__" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({ items: [{ name: "main" }], authenticationMode: "databricks" });
  listWorkspaceSchemasMock.mockResolvedValue({ items: [{ name: "sales" }], authenticationMode: "databricks" });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{
      name: "state_sales",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "state_code", type: "STRING", dataType: "STRING" },
        { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
        { name: "order_month", type: "DATE", dataType: "DATE" },
        { name: "units", type: "BIGINT", dataType: "LONG" },
        { name: "growth_pct", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "target", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "risk", type: "INT", dataType: "INTEGER" },
        { name: "region", type: "STRING", dataType: "STRING" },
        { name: "forecast", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "notes", type: "STRING", dataType: "STRING" },
      ],
    }],
    authenticationMode: "databricks",
  });
});

describe("HeatMapStory standalone project flow", () => {
  it("adds, maps, configures, saves, previews, and reopens the story", async () => {
    const user = userEvent.setup();
    const firstEditor = await renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add Heat Map Story" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Revenue by state");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "sales");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "state_sales");

    const mappedFields: Array<[string, string]> = [
      ["Geographic area column", "state_code"],
      ["Metric value column", "revenue"],
      ["Time field column", "order_month"],
      ["Secondary metric column", "units"],
      ["Change % column", "growth_pct"],
      ["Target value column", "target"],
      ["Risk score column", "risk"],
      ["Category / segment column", "region"],
      ["Forecast value column", "forecast"],
      ["Notes column", "notes"],
    ];
    for (const [label, column] of mappedFields) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
      await user.selectOptions(screen.getByLabelText(label), column);
    }
    await user.selectOptions(screen.getByLabelText("Color scale"), "diverging");
    await user.selectOptions(screen.getByLabelText("Default aggregation"), "avg");
    await user.click(screen.getByLabelText("Show state labels"));
    await user.click(screen.getByLabelText("Show metric legend"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "HeatMapStory",
      codeName: "heatMapStory1",
      properties: {
        title: "Revenue by state",
        geographicArea: { field: "state_code" },
        metricValue: { field: "revenue" },
        timeField: { field: "order_month" },
        secondaryMetric: { field: "units" },
        changePct: { field: "growth_pct" },
        targetValue: { field: "target" },
        riskScore: { field: "risk" },
        category: { field: "region" },
        forecastValue: { field: "forecast" },
        notes: { field: "notes" },
        aggregationMethod: "avg",
        colorScale: "diverging",
        showLabels: false,
        showLegend: false,
      },
      bindings: {
        unityCatalogTable: {
          source: { resource: { catalog: "main", schema: "sales", table: "state_sales" } },
        },
      },
    });

    await user.click(screen.getAllByRole("link", { name: "Code" })[0]!);
    expect(await screen.findByLabelText("Generated app code")).toHaveTextContent("__HEAT_MAP_PAYLOAD__");

    firstEditor.unmount();
    await renderProjectEditorPage({ selectFirstComponent: true });
    expect(await screen.findByLabelText("Title")).toHaveValue("Revenue by state");
    expect(screen.getByLabelText("Geographic area column")).toHaveValue("state_code");
    expect(screen.getByLabelText("Time field column")).toHaveValue("order_month");
    expect(screen.getByLabelText("Metric value aggregation")).toHaveValue("sum");
    expect(screen.getByLabelText("Default aggregation")).toHaveValue("avg");
    expect(screen.getByLabelText("Color scale")).toHaveValue("diverging");
    expect(screen.getByLabelText("Show state labels")).not.toBeChecked();
    expect(screen.getByLabelText("Show metric legend")).not.toBeChecked();
  }, 30_000);
});

async function renderProjectEditorPage(options: { selectFirstComponent?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps", element: <StandaloneAppLayout />, children: [{ path: ":appId", element: <ProjectEditorPage /> }, { index: true, element: <h1>Project list route</h1> }] }],
    { initialEntries: ["/apps/project-heat-map-story"] },
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
