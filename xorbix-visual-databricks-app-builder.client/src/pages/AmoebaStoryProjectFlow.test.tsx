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
  id: "project-amoeba-story",
  name: "Portfolio view",
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
    files: [{ path: "app.py", content: "components.html(story_html, height=560)" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({ items: [{ name: "main" }], authenticationMode: "databricks" });
  listWorkspaceSchemasMock.mockResolvedValue({ items: [{ name: "sales" }], authenticationMode: "databricks" });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{
      name: "portfolio",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "entity_id", type: "BIGINT", dataType: "BIGINT" },
        { name: "entity_name", type: "STRING", dataType: "STRING" },
        { name: "segment", type: "STRING", dataType: "STRING" },
        { name: "period", type: "TIMESTAMP", dataType: "TIMESTAMP" },
        { name: "size", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
        { name: "x_position", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "y_position", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "change_value", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "health", type: "DOUBLE", dataType: "DOUBLE" },
        { name: "risk", type: "DOUBLE", dataType: "DOUBLE" },
      ],
    }],
    authenticationMode: "databricks",
  });
});

describe("AmoebaStory standalone project flow", () => {
  it("adds, maps, configures, saves, previews, and reopens the interactive story", async () => {
    const user = userEvent.setup();
    const firstEditor = renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add Amoeba story" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Regional portfolio");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "sales");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "portfolio");

    const mappedFields: Array<[string, string]> = [
      ["Entity ID column", "entity_id"],
      ["Entity label column", "entity_name"],
      ["Category column", "segment"],
      ["Size column", "size"],
      ["X position column", "x_position"],
      ["Y position column", "y_position"],
      ["Change column", "change_value"],
      ["Time filter column", "period"],
      ["Health score column", "health"],
      ["Risk score column", "risk"],
    ];
    for (const [label, column] of mappedFields) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
      await user.selectOptions(screen.getByLabelText(label), column);
    }
    await user.selectOptions(screen.getByLabelText("X position aggregation"), "max");
    await user.selectOptions(screen.getByLabelText("Layout"), "scatter");
    await user.selectOptions(screen.getByLabelText("Size scale"), "log");
    await user.selectOptions(screen.getByLabelText("Color by"), "health_score");
    await user.selectOptions(screen.getByLabelText("Pulse by"), "none");
    await user.selectOptions(screen.getByLabelText("Pulse threshold direction"), "below");
    await user.selectOptions(screen.getByLabelText("Labels"), "full");
    await user.selectOptions(screen.getByLabelText("Animation"), "false");
    fireEvent.change(screen.getByLabelText("Minimum radius (px)"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("Maximum radius (px)"), { target: { value: "155" } });
    fireEvent.change(screen.getByLabelText("Pulse threshold"), { target: { value: "72" } });
    fireEvent.change(screen.getByLabelText("Shape variation"), { target: { value: "0.6" } });
    fireEvent.change(screen.getByLabelText("Animation speed"), { target: { value: "1.5" } });
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "AmoebaStory",
      codeName: "amoebaStory1",
      properties: {
        title: "Regional portfolio",
        entityId: { field: "entity_id" },
        entityLabel: { field: "entity_name" },
        category: { field: "segment" },
        sizeMetric: { field: "size" },
        xMetric: { field: "x_position", transform: "max" },
        yMetric: { field: "y_position" },
        changeMetric: { field: "change_value" },
        timeField: { field: "period" },
        healthScore: { field: "health" },
        riskScore: { field: "risk" },
        layoutMode: "scatter",
        sizeScale: "log",
        minRadiusPx: 24,
        maxRadiusPx: 155,
        colorBy: "health_score",
        pulseBy: "none",
        pulseThreshold: 72,
        pulseThresholdMode: "below",
        shapeVariation: 0.6,
        labelMode: "full",
        animationEnabled: false,
        animationSpeed: 1.5,
      },
      bindings: {
        unityCatalogTable: {
          source: { resource: { catalog: "main", schema: "sales", table: "portfolio" } },
        },
      },
    });

    await user.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview")).toHaveTextContent("components.html(story_html, height=560)");

    firstEditor.unmount();
    renderProjectEditorPage();
    expect(await screen.findByLabelText("Title")).toHaveValue("Regional portfolio");
    expect(screen.getByLabelText("Entity ID column")).toHaveValue("entity_id");
    expect(screen.getByLabelText("Time filter column")).toHaveValue("period");
    expect(screen.getByLabelText("Risk score column")).toHaveValue("risk");
    expect(screen.getByLabelText("Layout")).toHaveValue("scatter");
    expect(screen.getByLabelText("Animation")).toHaveValue("false");
    expect(screen.getByLabelText("Shape variation")).toHaveValue(0.6);
  }, 60_000);
});

function renderProjectEditorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps/:appId", element: <ProjectEditorPage /> }],
    { initialEntries: ["/apps/project-amoeba-story"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
