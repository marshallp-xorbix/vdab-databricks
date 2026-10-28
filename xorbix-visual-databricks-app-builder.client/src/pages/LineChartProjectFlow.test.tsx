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
  id: "project-line-chart",
  name: "Sales over time",
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
    files: [{ path: "app.py", content: "st.vega_lite_chart" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({ items: [{ name: "main" }], authenticationMode: "databricks" });
  listWorkspaceSchemasMock.mockResolvedValue({ items: [{ name: "sales" }], authenticationMode: "databricks" });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{
      name: "orders",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "region", type: "STRING", dataType: "STRING" },
        { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
        { name: "sold_at", type: "TIMESTAMP", dataType: "TIMESTAMP" },
      ],
    }],
    authenticationMode: "databricks",
  });
});

describe("LineChart standalone project flow", () => {
  it("adds, binds, configures, saves, previews, and reopens raw points", async () => {
    const user = userEvent.setup();
    const firstEditor = await renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add Line Chart" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Revenue over time");
    fireEvent.change(screen.getByLabelText("Series color"), { target: { value: "#2f77cc" } });
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "sales");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "orders");
    await waitFor(() => expect(screen.getAllByLabelText("Column")).toHaveLength(2));
    const axisFields = screen.getAllByLabelText("Column");
    await user.selectOptions(axisFields[0] as HTMLSelectElement, "sold_at");
    await user.selectOptions(axisFields[1] as HTMLSelectElement, "revenue");
    await user.selectOptions(screen.getByLabelText("Aggregation"), "none");
    const axisTitles = screen.getAllByLabelText("Axis title");
    await user.type(axisTitles[0] as HTMLInputElement, "Sale date");
    await user.type(axisTitles[1] as HTMLInputElement, "Revenue");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "LineChart",
      codeName: "lineChart1",
      properties: {
        title: "Revenue over time",
        seriesColor: "#2f77cc",
        xAxis: { field: "sold_at", displayName: "Sale date", scaleType: "continuous", transform: "none" },
        yAxis: { field: "revenue", displayName: "Revenue", transform: "none" },
      },
      bindings: {
        unityCatalogTable: {
          source: {
            resource: {
              catalog: "main",
              schema: "sales",
              table: "orders",
            },
          },
        },
      },
    });

    await user.click(screen.getAllByRole("link", { name: "Code" })[0]!);
    expect(await screen.findByLabelText("Generated app code")).toHaveTextContent("st.vega_lite_chart");

    firstEditor.unmount();
    await renderProjectEditorPage({ selectFirstComponent: true });
    expect(await screen.findByLabelText("Title")).toHaveValue("Revenue over time");
    expect(screen.getByLabelText("Series color")).toHaveValue("#2f77cc");
    expect(screen.getByLabelText("Current-workspace catalog")).toHaveValue("main");
    expect(await screen.findByLabelText("Schema")).toHaveValue("sales");
    expect(await screen.findByLabelText("Table")).toHaveValue("orders");
    expect(screen.getAllByLabelText("Column")[0]).toHaveValue("sold_at");
    expect(screen.getAllByLabelText("Column")[1]).toHaveValue("revenue");
    expect(screen.getByLabelText("Aggregation")).toHaveValue("none");
  }, 20_000);
});

async function renderProjectEditorPage(options: { selectFirstComponent?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps", element: <StandaloneAppLayout />, children: [{ path: ":appId", element: <ProjectEditorPage /> }, { index: true, element: <h1>Project list route</h1> }] }],
    { initialEntries: ["/apps/project-line-chart"] },
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
