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
  id: "project-flow-field-story",
  name: "Pipeline view",
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
    files: [{ path: "app.py", content: "const payload = __FLOW_FIELD_PAYLOAD__" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({ items: [{ name: "main" }], authenticationMode: "databricks" });
  listWorkspaceSchemasMock.mockResolvedValue({ items: [{ name: "sales" }], authenticationMode: "databricks" });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{
      name: "flows",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "source_stage", type: "STRING", dataType: "STRING" },
        { name: "destination_stage", type: "STRING", dataType: "STRING" },
        { name: "flow_volume", type: "BIGINT", dataType: "LONG" },
        { name: "stage_order", type: "INT", dataType: "INTEGER" },
        { name: "event_time", type: "TIMESTAMP", dataType: "TIMESTAMP" },
        { name: "conversion", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "drop_count", type: "BIGINT", dataType: "LONG" },
        { name: "avg_time", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "status", type: "STRING", dataType: "STRING" },
      ],
    }],
    authenticationMode: "databricks",
  });
});

describe("FlowFieldStory standalone project flow", () => {
  it("adds, maps, configures, saves, previews, and reopens the story", async () => {
    const user = userEvent.setup();
    const firstEditor = renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add Flow Field story" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Sales pipeline");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "sales");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "flows");

    const mappedFields: Array<[string, string]> = [
      ["Source stage column", "source_stage"],
      ["Destination stage column", "destination_stage"],
      ["Flow volume column", "flow_volume"],
      ["Stage order column", "stage_order"],
      ["Latest-period time field column", "event_time"],
      ["Conversion percentage column", "conversion"],
      ["Drop-off count column", "drop_count"],
      ["Average time in stage column", "avg_time"],
      ["Status column", "status"],
    ];
    for (const [label, column] of mappedFields) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
      await user.selectOptions(screen.getByLabelText(label), column);
    }
    await user.selectOptions(screen.getByLabelText("Flow volume aggregation"), "avg");
    await user.click(screen.getByLabelText("Show drop-offs"));
    await user.click(screen.getByLabelText("Show labels"));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "FlowFieldStory",
      codeName: "flowFieldStory1",
      properties: {
        title: "Sales pipeline",
        sourceStage: { field: "source_stage" },
        destinationStage: { field: "destination_stage" },
        flowVolume: { field: "flow_volume", transform: "avg" },
        stageOrder: { field: "stage_order" },
        timeField: { field: "event_time" },
        conversionPct: { field: "conversion" },
        dropOffCount: { field: "drop_count" },
        avgTimeInStage: { field: "avg_time" },
        status: { field: "status" },
        showDropOffs: false,
        showLabels: false,
      },
      bindings: {
        unityCatalogTable: {
          source: { resource: { catalog: "main", schema: "sales", table: "flows" } },
        },
      },
    });

    await user.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview")).toHaveTextContent("__FLOW_FIELD_PAYLOAD__");

    firstEditor.unmount();
    renderProjectEditorPage();
    expect(await screen.findByLabelText("Title", {}, { timeout: 10_000 }))
      .toHaveValue("Sales pipeline");
    expect(screen.getByLabelText("Source stage column")).toHaveValue("source_stage");
    expect(screen.getByLabelText("Latest-period time field column")).toHaveValue("event_time");
    expect(screen.getByLabelText("Flow volume aggregation")).toHaveValue("avg");
    expect(screen.getByLabelText("Show drop-offs")).not.toBeChecked();
    expect(screen.getByLabelText("Show labels")).not.toBeChecked();
  }, 30_000);
});

function renderProjectEditorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps/:appId", element: <ProjectEditorPage /> }],
    { initialEntries: ["/apps/project-flow-field-story"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
