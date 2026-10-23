import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProject } from "../api/projectsApi";
import {
  getProjectComponents,
  replaceProjectComponents,
} from "../api/projectComponentsApi";
import {
  listWorkspaceCatalogs,
  listWorkspaceSchemas,
  listWorkspaceTables,
} from "../api/workspaceResourcesApi";
import {
  listWorkspaceLakebaseProvisionedInstances,
  listWorkspaceLakebaseProvisionedSchemas,
  listWorkspaceLakebaseProvisionedTables,
} from "../api/workspaceLakebaseProvisionedResourcesApi";
import type { IProject } from "../models/Project";
import type { IProjectComponent } from "../models/ProjectComponents";
import ProjectEditorPage from "./ProjectEditorPage";

vi.mock("../api/projectsApi", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));
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
vi.mock("../api/workspaceLakebaseProvisionedResourcesApi", () => ({
  listWorkspaceLakebaseProvisionedInstances: vi.fn(),
  listWorkspaceLakebaseProvisionedSchemas: vi.fn(),
  listWorkspaceLakebaseProvisionedTables: vi.fn(),
}));

const getProjectMock = vi.mocked(getProject);
const getProjectComponentsMock = vi.mocked(getProjectComponents);
const replaceProjectComponentsMock = vi.mocked(replaceProjectComponents);
const listWorkspaceCatalogsMock = vi.mocked(listWorkspaceCatalogs);
const listWorkspaceSchemasMock = vi.mocked(listWorkspaceSchemas);
const listWorkspaceTablesMock = vi.mocked(listWorkspaceTables);
const listProvisionedInstancesMock = vi.mocked(
  listWorkspaceLakebaseProvisionedInstances,
);
const listProvisionedSchemasMock = vi.mocked(
  listWorkspaceLakebaseProvisionedSchemas,
);
const listProvisionedTablesMock = vi.mocked(
  listWorkspaceLakebaseProvisionedTables,
);
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
  getProjectComponentsMock.mockResolvedValue({
    projectId: project.id,
    version: 1,
    components: [],
  });
  replaceProjectComponentsMock.mockImplementation(async (input) => {
    savedComponents = input.components;
    return {
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    };
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
    items: [],
    authenticationMode: "databricks",
  });
  listProvisionedInstancesMock.mockResolvedValue({
    items: [{ instanceName: "existing-instance", state: "AVAILABLE" }],
    authenticationMode: "databricks",
  });
  listProvisionedSchemasMock.mockResolvedValue({
    items: [{ name: "public" }],
    authenticationMode: "databricks",
  });
  listProvisionedTablesMock.mockResolvedValue({
    items: [
      {
        name: "orders",
        tableType: "BASE TABLE",
        columns: [
          { name: "order_id", type: "integer", nullable: false },
          { name: "order_name", type: "text", nullable: true },
        ],
      },
    ],
    authenticationMode: "databricks",
  });
});

describe("Provisioned Lakebase editable data window project flow", () => {
  it("binds an editable data window to a current-workspace Provisioned Lakebase table", async () => {
    const user = userEvent.setup();

    renderProjectEditorPage();
    await user.click(
      await screen.findByRole("button", { name: "Add editable data window" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Workspace table source"),
      "lakebaseProvisionedDatabase",
    );

    const instanceSelector = await screen.findByRole("combobox", {
      name: "Lakebase Provisioned instance",
    });
    await user.click(instanceSelector);
    await user.click(
      await screen.findByRole("option", {
        name: "existing-instance · AVAILABLE",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Schema" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("combobox", { name: "Schema" }));
    await user.click(await screen.findByRole("option", { name: "public" }));
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Base table" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("combobox", { name: "Base table" }));
    await user.click(await screen.findByRole("option", { name: "orders" }));
    await user.selectOptions(
      screen.getByLabelText("Primary key column"),
      "order_id",
    );
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() =>
      expect(replaceProjectComponentsMock).toHaveBeenCalled(),
    );
    expect(savedComponents[0]).toMatchObject({
      type: "EditableDataWindow",
      bindings: {
        lakebaseProvisionedDatabase: {
          bindingType: "lakebaseProvisionedDatabase",
          source: {
            resource: {
              type: "lakebaseProvisionedDatabase",
              instanceName: "existing-instance",
              database: "databricks_postgres",
              schema: "public",
              table: "orders",
              primaryKeyColumn: "order_id",
              columns: [
                { name: "order_id", type: "integer", dataType: "integer" },
                { name: "order_name", type: "text", dataType: "text" },
              ],
            },
          },
        },
      },
    });
    expect(listProvisionedTablesMock).toHaveBeenCalledWith(
      {
        instanceName: "existing-instance",
        databaseName: "databricks_postgres",
      },
      "public",
      expect.any(AbortSignal),
    );
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
