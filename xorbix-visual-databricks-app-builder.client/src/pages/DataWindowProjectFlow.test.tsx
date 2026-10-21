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
  id: "project-data-window",
  name: "Customer table",
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
    return {
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    };
  });
  generateProjectPreviewMock.mockResolvedValue({
    projectId: project.id,
    version: 2,
    previewOnly: true,
    files: [{ path: "app.py", content: "st.dataframe(customers)" }],
  });
  listWorkspaceCatalogsMock.mockResolvedValue({
    items: [{ name: "main" }],
    authenticationMode: "databricks",
  });
  listWorkspaceSchemasMock.mockResolvedValue({
    items: [{ name: "sales" }],
    authenticationMode: "databricks",
  });
  listWorkspaceTablesMock.mockResolvedValue({
    items: [{
      name: "customers",
      dataSourceFormat: "DELTA",
      columns: [
        { name: "customer_id", type: "BIGINT", dataType: "LONG" },
        { name: "customer name", type: "STRING", dataType: "STRING" },
        { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
      ],
    }],
    authenticationMode: "databricks",
  });
});

describe("DataWindow standalone project flow", () => {
  it("adds, binds, saves, previews, and reopens a Unity Catalog table", async () => {
    const user = userEvent.setup();
    const firstEditor = renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add data window" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Top customers");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "sales");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "customers");
    await user.clear(screen.getByLabelText("Maximum rows (0 means no explicit limit)"));
    await user.type(screen.getByLabelText("Maximum rows (0 means no explicit limit)"), "50");
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "DataWindow",
      codeName: "dataWindow1",
      properties: { label: "Top customers", maxRows: 50 },
      bindings: {
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            valueType: "table",
            resource: {
              type: "unityCatalogTable",
              catalog: "main",
              schema: "sales",
              table: "customers",
              dataSourceFormat: "DELTA",
              columns: [
                { name: "customer_id", type: "BIGINT", dataType: "LONG" },
                { name: "customer name", type: "STRING", dataType: "STRING" },
                { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
              ],
            },
          },
        },
      },
    });

    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("st.dataframe");

    firstEditor.unmount();
    renderProjectEditorPage();
    expect(await screen.findByLabelText("Label")).toHaveValue("Top customers");
    expect(screen.getByLabelText("Current-workspace catalog")).toHaveValue("main");
    expect(await screen.findByLabelText("Schema")).toHaveValue("sales");
    expect(await screen.findByLabelText("Table")).toHaveValue("customers");
  }, 20_000);

  it("adds, configures a key, saves, previews, and reopens an editable Unity Catalog table", async () => {
    const user = userEvent.setup();
    const firstEditor = renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add editable data window" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Editable customers");
    await user.selectOptions(screen.getByLabelText("Current-workspace catalog"), "main");
    await waitFor(() => expect(screen.getByLabelText("Schema")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Schema"), "sales");
    await waitFor(() => expect(screen.getByLabelText("Table")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Table"), "customers");
    await user.selectOptions(screen.getByLabelText("Primary key column"), "customer_id");
    expect(screen.getByText(/checks the whole table for duplicate or null keys/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Row editing"), "dynamic");
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0]).toMatchObject({
      type: "EditableDataWindow",
      properties: {
        label: "Editable customers",
        numRows: "dynamic",
        disabled: false,
      },
      bindings: {
        unityCatalogTable: {
          source: {
            resource: {
              primaryKeyColumn: "customer_id",
              dataSourceFormat: "DELTA",
              columns: [
                { name: "customer_id", type: "BIGINT", dataType: "LONG" },
                { name: "customer name", type: "STRING", dataType: "STRING" },
                { name: "revenue", type: "DECIMAL(12,2)", dataType: "DECIMAL" },
              ],
            },
          },
        },
      },
    });

    generateProjectPreviewMock.mockResolvedValueOnce({
      projectId: project.id,
      version: 2,
      previewOnly: true,
      files: [{ path: "app.py", content: "st.data_editor(customers)" }],
    });
    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("st.data_editor");

    firstEditor.unmount();
    renderProjectEditorPage();
    expect(await screen.findByLabelText("Label")).toHaveValue("Editable customers");
    expect(screen.getByLabelText("Primary key column")).toHaveValue("customer_id");
    expect(screen.getByLabelText("Row editing")).toHaveValue("dynamic");
  }, 20_000);
});

function renderProjectEditorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/apps/:appId", element: <ProjectEditorPage /> }],
    { initialEntries: ["/apps/project-data-window"] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
