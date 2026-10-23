import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WorkflowSaveToTableTargetSelector from "./WorkflowSaveToTableTargetSelector";
import type { SaveTargetTableRef } from "../types/workflow/sharedReferences";

vi.mock("./InstalledWorkspaceLakebaseTableSelectorFields", () => ({
  default: () => null,
}));

vi.mock("./InstalledWorkspaceLakebaseProvisionedTableSelectorFields", () => ({
  default: () => null,
}));

vi.mock("./InstalledWorkspaceUnityCatalogTableSelectorFields", () => ({
  default: () => null,
}));

describe("WorkflowSaveToTableTargetSelector", () => {
  it("selects a current-workspace Lakebase target without retaining external connection authority", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(next: SaveTargetTableRef) => void>();

    render(
      <WorkflowSaveToTableTargetSelector
        value={{
          tableType: "unityCatalogTable",
          workspaceConnectionId: 74,
          catalog: "sales",
          schema: "public",
          table: "orders",
        }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Lakebase Autoscaling" }));

    expect(onChange).toHaveBeenCalledWith({
      tableType: "lakebaseAutoscaling",
      workspaceConnectionId: 0,
      projectId: "",
      branchId: "",
      endpointId: "",
      databaseId: "",
      database: "",
      catalog: "",
      schema: "",
      table: "",
    });
  });

  it("selects an existing Provisioned instance in the installed workspace", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(next: SaveTargetTableRef) => void>();

    render(
      <WorkflowSaveToTableTargetSelector
        value={{
          tableType: "unityCatalogTable",
          workspaceConnectionId: 38,
          catalog: "",
          schema: "",
          table: "",
        }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Lakebase Provisioned (existing)" }));

    expect(onChange).toHaveBeenCalledWith({
      tableType: "lakebaseProvisionedDatabase",
      workspaceConnectionId: 0,
      instanceName: "",
      database: "databricks_postgres",
      catalog: "databricks_postgres",
      schema: "",
      table: "",
    });
  });

  it("allows replacing a saved binding with a current workspace selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(next: SaveTargetTableRef) => void>();

    render(
      <WorkflowSaveToTableTargetSelector
        value={{
          tableType: "lakebaseProvisionedDatabase",
          workspaceConnectionId: 74,
          instanceName: "old-workspace-instance",
          database: "app",
          catalog: "",
          schema: "public",
          table: "orders",
        }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Unity Catalog" }));

    expect(onChange).toHaveBeenCalledWith({
      tableType: "unityCatalogTable",
      workspaceConnectionId: 0,
      catalog: "",
      schema: "",
      table: "",
    });
    expect(screen.queryByText("old-workspace-instance")).not.toBeInTheDocument();
  });
});
