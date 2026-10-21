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
  id: "project-network-web-story",
  name: "Supply chain graph",
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
    files: [{ path: "app.py", content: "const payload = __NETWORK_WEB_PAYLOAD__" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({ items: [{ name: "main" }], authenticationMode: "databricks" });
  listWorkspaceSchemasMock.mockResolvedValue({ items: [{ name: "supply" }], authenticationMode: "databricks" });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{ name: "network_edges", dataSourceFormat: "DELTA", columns: [
      { name: "source_id", type: "BIGINT", dataType: "BIGINT" },
      { name: "source_label", type: "STRING", dataType: "STRING" },
      { name: "target_id", type: "BIGINT", dataType: "BIGINT" },
      { name: "target_label", type: "STRING", dataType: "STRING" },
      { name: "relationship_type", type: "STRING", dataType: "STRING" },
      { name: "weight", type: "DOUBLE", dataType: "DOUBLE" },
      { name: "snapshot_date", type: "DATE", dataType: "DATE" },
      { name: "direction", type: "STRING", dataType: "STRING" },
      { name: "edge_value", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
      { name: "frequency", type: "INT", dataType: "INTEGER" },
      { name: "edge_risk", type: "DOUBLE", dataType: "DOUBLE" },
      { name: "edge_status", type: "STRING", dataType: "STRING" },
      { name: "source_category", type: "STRING", dataType: "STRING" },
      { name: "target_category", type: "STRING", dataType: "STRING" },
      { name: "source_value", type: "DOUBLE", dataType: "DOUBLE" },
      { name: "target_value", type: "DOUBLE", dataType: "DOUBLE" },
      { name: "source_health", type: "DOUBLE", dataType: "DOUBLE" },
      { name: "target_health", type: "DOUBLE", dataType: "DOUBLE" },
      { name: "source_risk", type: "DOUBLE", dataType: "DOUBLE" },
      { name: "target_risk", type: "DOUBLE", dataType: "DOUBLE" },
    ] }],
    authenticationMode: "databricks",
  });
});

describe("NetworkWebStory standalone project flow", () => {
  it("adds, maps, configures, saves, previews, and reopens the story", async () => {
    const user = userEvent.setup();
    const firstEditor = renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add network web story" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Supply risk network");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "supply");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "network_edges");

    const mappings: Array<[string, string]> = [
      ["Source entity ID column (required)", "source_id"],
      ["Source entity label column (required)", "source_label"],
      ["Target entity ID column (required)", "target_id"],
      ["Target entity label column (required)", "target_label"],
      ["Relationship type column (required)", "relationship_type"],
      ["Relationship weight column (required)", "weight"],
      ["Time field column (optional)", "snapshot_date"],
      ["Direction column (optional)", "direction"],
      ["Edge value column (optional)", "edge_value"],
      ["Frequency column (optional)", "frequency"],
      ["Edge risk score column (optional)", "edge_risk"],
      ["Edge status column (optional)", "edge_status"],
      ["Source category column (optional)", "source_category"],
      ["Target category column (optional)", "target_category"],
      ["Source value column (optional)", "source_value"],
      ["Target value column (optional)", "target_value"],
      ["Source health score column (optional)", "source_health"],
      ["Target health score column (optional)", "target_health"],
      ["Source risk score column (optional)", "source_risk"],
      ["Target risk score column (optional)", "target_risk"],
    ];
    for (const [label, column] of mappings) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
      await user.selectOptions(screen.getByLabelText(label), column);
    }
    await user.selectOptions(screen.getByLabelText("Layout algorithm"), "radial");
    await user.selectOptions(screen.getByLabelText("Node size by"), "value");
    await user.selectOptions(screen.getByLabelText("Node color by"), "risk_score");
    await user.selectOptions(screen.getByLabelText("Edge width by"), "frequency");
    await user.selectOptions(screen.getByLabelText("Edge color by"), "status");
    await user.clear(screen.getByLabelText("Highlight depth"));
    await user.type(screen.getByLabelText("Highlight depth"), "3");
    await user.clear(screen.getByLabelText("Minimum edge weight"));
    await user.type(screen.getByLabelText("Minimum edge weight"), "25.5");
    await user.clear(screen.getByLabelText("Maximum nodes"));
    await user.type(screen.getByLabelText("Maximum nodes"), "120");
    await user.clear(screen.getByLabelText("Maximum edges"));
    await user.type(screen.getByLabelText("Maximum edges"), "400");
    await user.click(screen.getByLabelText("Show relationship arrows"));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "NetworkWebStory",
      codeName: "networkWebStory1",
      properties: {
        title: "Supply risk network",
        sourceEntityId: { field: "source_id" },
        sourceEntityLabel: { field: "source_label" },
        targetEntityId: { field: "target_id" },
        targetEntityLabel: { field: "target_label" },
        relationshipType: { field: "relationship_type" },
        relationshipWeight: { field: "weight" },
        timeField: { field: "snapshot_date" },
        direction: { field: "direction" },
        edgeValue: { field: "edge_value" },
        frequency: { field: "frequency" },
        edgeRiskScore: { field: "edge_risk" },
        edgeStatus: { field: "edge_status" },
        sourceCategory: { field: "source_category" },
        targetCategory: { field: "target_category" },
        sourceValue: { field: "source_value" },
        targetValue: { field: "target_value" },
        sourceHealthScore: { field: "source_health" },
        targetHealthScore: { field: "target_health" },
        sourceRiskScore: { field: "source_risk" },
        targetRiskScore: { field: "target_risk" },
        layoutAlgorithm: "radial",
        nodeSizeBy: "value",
        nodeColorBy: "risk_score",
        edgeWidthBy: "frequency",
        edgeColorBy: "status",
        highlightDepth: 3,
        minWeightFilter: 25.5,
        maxNodes: 120,
        maxEdges: 400,
        showArrows: false,
      },
      bindings: {
        unityCatalogTable: {
          source: { resource: { catalog: "main", schema: "supply", table: "network_edges" } },
        },
      },
    });

    await user.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview")).toHaveTextContent("__NETWORK_WEB_PAYLOAD__");

    firstEditor.unmount();
    renderProjectEditorPage();
    expect(await screen.findByLabelText("Title")).toHaveValue("Supply risk network");
    expect(screen.getByLabelText("Source entity ID column (required)")).toHaveValue("source_id");
    expect(screen.getByLabelText("Time field column (optional)")).toHaveValue("snapshot_date");
    expect(screen.getByLabelText("Layout algorithm")).toHaveValue("radial");
    expect(screen.getByLabelText("Highlight depth")).toHaveValue(3);
    expect(screen.getByLabelText("Show relationship arrows")).not.toBeChecked();
  }, 60_000);
});

function renderProjectEditorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps/:appId", element: <ProjectEditorPage /> }],
    { initialEntries: ["/apps/project-network-web-story"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
