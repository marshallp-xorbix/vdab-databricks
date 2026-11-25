import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ComponentCategory,
  ComponentType,
  type VdabComponent,
} from "../../../../../types/components";
import type { Workflow } from "../../../../../types/workflow";
import type { SaveToTableNode } from "../../../../../types/workflow/actionNode";
import { SaveToTableEditor } from "./SaveToTableEditor";

vi.mock("../../../../../hooks/useWorkspaceCatalogs", () => ({
  useWorkspaceCatalogs: () => ({
    data: { items: [{ name: "dbdemos" }], authenticationMode: "local-test" },
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
  }),
}));

vi.mock("../../../../../hooks/useWorkspaceSchemas", () => ({
  useWorkspaceSchemas: () => ({
    data: { items: [{ name: "vdab" }], authenticationMode: "local-test" },
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
  }),
}));

vi.mock("../../../../../hooks/useWorkspaceTables", () => ({
  useWorkspaceTables: () => ({
    data: {
      items: [{ name: "shipment_inspection", columns: [] }],
      authenticationMode: "local-test",
    },
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
  }),
}));

vi.mock("../../../../../hooks/useWorkspaceLakebaseTables", () => ({
  useWorkspaceLakebaseTables: () => ({
    data: { items: [] },
    error: null,
    isPending: false,
  }),
}));

vi.mock("../../../../../hooks/useWorkspaceLakebaseProvisionedTables", () => ({
  useWorkspaceLakebaseProvisionedTables: () => ({
    data: { items: [] },
    error: null,
    isPending: false,
  }),
}));

describe("SaveToTableEditor", () => {
  it("renders the target selector full width without the 220px single-child grid", () => {
    const node: SaveToTableNode = {
      id: "saveInspection",
      actionType: "SaveToTable",
      schemaVersion: 1,
      params: {
        sourceFormComponentCodeName: "inspectionForm",
        targetTable: {
          tableType: "unityCatalogTable",
          catalog: "dbdemos",
          schema: "vdab",
          table: "shipment_inspection",
        },
        excludedColumns: [],
        columnMappings: [],
      },
    };
    const workflow: Workflow = {
      codeName: "submitInspectionForm",
      trigger: { componentCodeName: "inspectionForm", eventKey: "onSubmit" },
      nodes: [node],
      edges: [],
    };
    const components: VdabComponent[] = [
      {
        id: "inspectionForm",
        codeName: "inspectionForm",
        type: ComponentType.Form,
        category: ComponentCategory.Layout,
        props: { submitButtonText: "Submit" },
        children: ["shipmentId"],
        schemaVersion: 1,
        supportedEvents: ["onSubmit"],
      },
      {
        id: "shipmentId",
        codeName: "shipmentId",
        type: ComponentType.TextInput,
        category: ComponentCategory.Controls,
        props: { label: "Shipment ID" },
        children: [],
        schemaVersion: 1,
      },
    ];

    const { container } = render(
      <SaveToTableEditor
        workflowId="submitInspectionForm"
        workflow={workflow}
        node={node}
        components={components}
        onUpdateNode={vi.fn()}
      />,
    );

    expect(screen.getByText("Target Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Table")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("minmax(0,220px)");
    expect(container.querySelector(".min-w-0.rounded-md.border")).not.toBeNull();
    const tableTrigger = screen.getByLabelText("Table");
    expect(tableTrigger.className).toContain("min-w-0");
    expect(tableTrigger.className).toContain("[&>span]:truncate");
  });
});
