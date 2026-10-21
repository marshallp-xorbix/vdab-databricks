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
import {
  listWorkspaceCatalogs,
  listWorkspaceSchemas,
  listWorkspaceTables,
} from "../api/workspaceResourcesApi";
import type { IProject } from "../models/Project";
import type { IProjectComponent } from "../models/ProjectComponents";
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
  id: "project-honeycomb-story",
  name: "Portfolio health",
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
    files: [{ path: "app.py", content: "const payload = __HONEYCOMB_PAYLOAD__" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({ items: [{ name: "main" }], authenticationMode: "databricks" });
  listWorkspaceSchemasMock.mockResolvedValue({ items: [{ name: "sales" }], authenticationMode: "databricks" });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{
      name: "portfolio_items",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "item_id", type: "STRING", dataType: "STRING" },
        { name: "impact", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "priority", type: "STRING", dataType: "STRING" },
        { name: "progress", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "category", type: "STRING", dataType: "STRING" },
        { name: "snapshot_date", type: "DATE", dataType: "DATE" },
        { name: "trend", type: "STRING", dataType: "STRING" },
        { name: "risk", type: "INT", dataType: "INTEGER" },
        { name: "owner", type: "STRING", dataType: "STRING" },
        { name: "due_date", type: "DATE", dataType: "DATE" },
        { name: "investment", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
        { name: "benefit", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
        { name: "notes", type: "STRING", dataType: "STRING" },
        { name: "status", type: "STRING", dataType: "STRING" },
      ],
    }],
    authenticationMode: "databricks",
  });
});

describe("HoneycombStory standalone project flow", () => {
  it("adds, maps, configures, saves, previews, and reopens the story", async () => {
    const user = userEvent.setup();
    const firstEditor = renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add honeycomb story" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Portfolio delivery health");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "sales");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "portfolio_items");

    const mappedFields: Array<[string, string]> = [
      ["Item name column", "item_id"],
      ["Impact score column", "impact"],
      ["Priority level column", "priority"],
      ["Progress % column", "progress"],
      ["Category / pillar column", "category"],
      ["Time field column", "snapshot_date"],
      ["Trend column", "trend"],
      ["Notes column", "notes"],
      ["Risk score column", "risk"],
      ["Owner column", "owner"],
      ["Due date column", "due_date"],
      ["Investment column", "investment"],
      ["Benefit value column", "benefit"],
      ["Status column", "status"],
    ];
    for (const [label, column] of mappedFields) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
      await user.selectOptions(screen.getByLabelText(label), column);
    }
    await user.selectOptions(screen.getByLabelText("Impact score aggregation"), "max");
    await user.click(screen.getByLabelText("Show item labels"));
    await user.click(screen.getByLabelText("Highlight high-risk borders"));
    await user.click(screen.getByLabelText("Show trend arrows"));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "HoneycombStory",
      codeName: "honeycombStory1",
      properties: {
        title: "Portfolio delivery health",
        itemName: { field: "item_id" },
        impactScore: { field: "impact", transform: "max" },
        priorityLevel: { field: "priority" },
        progressPct: { field: "progress" },
        category: { field: "category" },
        timeField: { field: "snapshot_date" },
        trend: { field: "trend" },
        riskScore: { field: "risk" },
        owner: { field: "owner" },
        dueDate: { field: "due_date" },
        investment: { field: "investment" },
        benefitValue: { field: "benefit" },
        notes: { field: "notes" },
        status: { field: "status" },
        showLabels: false,
        showRiskBorders: false,
        showTrendArrows: false,
      },
      bindings: {
        unityCatalogTable: {
          source: { resource: { catalog: "main", schema: "sales", table: "portfolio_items" } },
        },
      },
    });

    await user.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview")).toHaveTextContent("__HONEYCOMB_PAYLOAD__");

    firstEditor.unmount();
    renderProjectEditorPage();
    expect(await screen.findByLabelText("Title")).toHaveValue("Portfolio delivery health");
    expect(screen.getByLabelText("Item name column")).toHaveValue("item_id");
    expect(screen.getByLabelText("Time field column")).toHaveValue("snapshot_date");
    expect(screen.getByLabelText("Impact score aggregation")).toHaveValue("max");
    expect(screen.getByLabelText("Show item labels")).not.toBeChecked();
    expect(screen.getByLabelText("Highlight high-risk borders")).not.toBeChecked();
    expect(screen.getByLabelText("Show trend arrows")).not.toBeChecked();
  }, 30_000);
});

function renderProjectEditorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps/:appId", element: <ProjectEditorPage /> }],
    { initialEntries: ["/apps/project-honeycomb-story"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
