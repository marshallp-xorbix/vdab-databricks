import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BuildSqlNode } from "../../../../../types/workflow";
import type { VdabComponent } from "../../../../../types/components";
import type { Workflow } from "../../../../../types/workflow";
import type { WorkflowActionEditorProps } from "./types";
import { BuildSqlEditor } from "./BuildSqlEditor";

vi.mock("../../../../../hooks/useWorkspaceSqlWarehouses", () => ({
  useWorkspaceSqlWarehouses: () => ({
    data: {
      items: [{ id: "warehouse-123", name: "Analytics", state: "running" }],
      authenticationMode: "local-test",
    },
    error: null,
    isError: false,
    isPending: false,
  }),
}));

vi.mock("../../../../../hooks/useWorkspaceLakebaseProjects", () => ({
  useWorkspaceLakebaseProjects: () => ({
    data: { items: [], authenticationMode: "local-test" },
    error: null,
    isError: false,
    isPending: false,
  }),
}));

vi.mock("../../../../../hooks/useWorkspaceLakebaseBranches", () => ({
  useWorkspaceLakebaseBranches: () => ({
    data: { items: [], authenticationMode: "local-test" },
    error: null,
    isError: false,
    isPending: false,
  }),
}));

vi.mock("../../../../../hooks/useWorkspaceLakebaseEndpoints", () => ({
  useWorkspaceLakebaseEndpoints: () => ({
    data: { items: [], authenticationMode: "local-test" },
    error: null,
    isError: false,
    isPending: false,
  }),
}));

describe("BuildSqlEditor", () => {
  it("selects a current-workspace warehouse without saving workspace authority", async () => {
    const user = userEvent.setup();
    const node: BuildSqlNode = {
      id: "build-query",
      actionType: "BuildSql",
      schemaVersion: 1,
      params: {
        sqlSourceKind: "unityCatalogTable",
        sqlTemplate: "SELECT 1",
        placeholders: [],
      },
    };
    const workflow: Workflow = {
      codeName: "refreshData",
      trigger: { componentCodeName: "refreshButton", eventKey: "onClick" },
      nodes: [node],
      edges: [],
    };
    const components: VdabComponent[] = [];
    const onUpdateNode = vi.fn<WorkflowActionEditorProps["onUpdateNode"]>();

    render(
      <BuildSqlEditor
        workflowId="refreshData"
        workflow={workflow}
        node={node}
        components={components}
        onUpdateNode={onUpdateNode}
      />,
    );

    const warehousePicker = screen.getAllByRole("combobox")[1];
    expect(warehousePicker).toBeDefined();
    await user.click(warehousePicker!);
    await user.click(
      await screen.findByRole("option", { name: "Analytics · running" }),
    );

    await waitFor(() => expect(onUpdateNode).toHaveBeenCalledTimes(1));
    const update = onUpdateNode.mock.calls[0]?.[2];
    expect(update?.(node)).toMatchObject({
      params: {
        sqlWarehouseId: "warehouse-123",
        sqlWarehouseName: "Analytics",
      },
    });
    expect(JSON.stringify(update?.(node))).not.toMatch(
      /workspaceConnectionId|workspaceHost|accessToken/i,
    );
    expect(
      screen.getByText(/current viewer’s forwarded Databricks token/i),
    ).toBeInTheDocument();
  });

  it("keeps the legacy App-resource editor separate from the standalone picker", async () => {
    const node: BuildSqlNode = {
      id: "build-query",
      actionType: "BuildSql",
      schemaVersion: 1,
      params: {
        sqlSourceKind: "unityCatalogTable",
        sqlTemplate: "SELECT 1",
        placeholders: [],
      },
    };

    render(
      <BuildSqlEditor
        workflowId="refreshData"
        workflow={{
          codeName: "refreshData",
          trigger: { componentCodeName: "refreshButton", eventKey: "onClick" },
          nodes: [node],
          edges: [],
        }}
        node={node}
        components={[]}
        workspaceConnectionId={12}
        onUpdateNode={vi.fn<WorkflowActionEditorProps["onUpdateNode"]>()}
      />,
    );

    expect(screen.queryByText("SQL warehouse")).not.toBeInTheDocument();
    expect(screen.getByText(/Prefer escaped placeholders over raw/i)).toBeInTheDocument();
  });
});
