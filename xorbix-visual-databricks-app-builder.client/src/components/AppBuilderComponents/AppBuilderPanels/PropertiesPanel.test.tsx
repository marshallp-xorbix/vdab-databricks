import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import PropertiesPanel from "./PropertiesPanel";
import { createComponent } from "../../../utils/__tests__/testingUtils";
import { ComponentType } from "../../../types/components/componentTypes";
import type { WorkflowDefinition } from "../../../types/workflow";

vi.mock("../../../context/ComponentRegistryContext", () => ({
  useComponentRegistry: () => ({
    registry: {
      bindingSchemas: [
        {
          type: "unityCatalogTable",
          label: "Unity Catalog Table",
          editorType: "Unknown",
        },
      ],
    },
    loading: false,
    error: null,
  }),
}));

describe("PropertiesPanel codeName editor", () => {
  const createProps = (overrides?: {
    selectedComponent?: ReturnType<typeof createComponent> | null;
    components?: ReturnType<typeof createComponent>[];
    onUpdateComponent?: (
      componentId: string,
      updates: Record<string, unknown>,
    ) => void;
    workflowDefinition?: WorkflowDefinition;
    onWorkflowDefinitionChange?: (nextDefinition: WorkflowDefinition) => void;
    onJumpToWorkflowAction?: (workflowCodeName: string, nodeId?: string) => void;
  }) => {
    const selectedComponent =
      overrides?.selectedComponent ??
      createComponent({
        id: "1",
        type: ComponentType.Button,
        codeName: "button1",
        props: { text: "Click" },
      });

    const components = overrides?.components ?? [
      selectedComponent,
      createComponent({
        id: "2",
        type: ComponentType.TextInput,
        codeName: "input1",
      }),
    ];

    return {
      selectedComponent,
      components,
      onUpdateComponent: overrides?.onUpdateComponent ?? vi.fn(),
      workflowDefinition: overrides?.workflowDefinition,
      onWorkflowDefinitionChange: overrides?.onWorkflowDefinitionChange,
      onJumpToWorkflowAction: overrides?.onJumpToWorkflowAction,
      onClose: vi.fn(),
    };
  };

  it("shows current codeName for selected component", () => {
    const props = createProps();

    render(<PropertiesPanel {...props} />);

    const input = screen.getByLabelText("Code Name") as HTMLInputElement;
    expect(input.value).toBe("button1");
  });

  it("blocks invalid empty value and shows inline required error", () => {
    const onUpdateComponent = vi.fn();
    const props = createProps({ onUpdateComponent });

    render(<PropertiesPanel {...props} />);

    fireEvent.change(screen.getByLabelText("Code Name"), {
      target: { value: "   " },
    });

    expect(screen.getByText("Code name is required.")).toBeInTheDocument();
    expect(onUpdateComponent).not.toHaveBeenCalled();
  });

  it("shows duplicate error and blocks commit", () => {
    const onUpdateComponent = vi.fn();
    const selectedComponent = createComponent({
      id: "1",
      type: ComponentType.Button,
      codeName: "button1",
    });
    const duplicate = createComponent({
      id: "2",
      type: ComponentType.TextInput,
      codeName: "input1",
    });

    render(
      <PropertiesPanel
        {...createProps({
          selectedComponent,
          components: [selectedComponent, duplicate],
          onUpdateComponent,
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("Code Name"), {
      target: { value: "input1" },
    });

    expect(
      screen.getByText("Code name 'input1' is already used."),
    ).toBeInTheDocument();
    expect(onUpdateComponent).not.toHaveBeenCalled();
  });

  it("commits normalized valid value to top-level codeName", () => {
    const onUpdateComponent = vi.fn();

    render(<PropertiesPanel {...createProps({ onUpdateComponent })} />);

    fireEvent.change(screen.getByLabelText("Code Name"), {
      target: { value: "  nextButton  " },
    });

    expect(onUpdateComponent).toHaveBeenCalledWith("1", {
      codeName: "nextButton",
    });

    const input = screen.getByLabelText("Code Name") as HTMLInputElement;
    expect(input.value).toBe("nextButton");
  });

  it("preserves per-component unsaved draft and error when switching selection", () => {
    const onUpdateComponent = vi.fn();
    const componentA = createComponent({
      id: "1",
      type: ComponentType.Button,
      codeName: "button1",
      props: { text: "A" },
    });
    const componentB = createComponent({
      id: "2",
      type: ComponentType.TextInput,
      codeName: "input1",
      props: { placeholder: "B" },
    });

    const { rerender } = render(
      <PropertiesPanel
        {...createProps({
          selectedComponent: componentA,
          components: [componentA, componentB],
          onUpdateComponent,
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("Code Name"), {
      target: { value: "" },
    });

    expect(screen.getByText("Code name is required.")).toBeInTheDocument();

    rerender(
      <PropertiesPanel
        {...createProps({
          selectedComponent: componentB,
          components: [componentA, componentB],
          onUpdateComponent,
        })}
      />,
    );

    const bInput = screen.getByLabelText("Code Name") as HTMLInputElement;
    expect(bInput.value).toBe("input1");

    rerender(
      <PropertiesPanel
        {...createProps({
          selectedComponent: componentA,
          components: [componentA, componentB],
          onUpdateComponent,
        })}
      />,
    );

    const aInput = screen.getByLabelText("Code Name") as HTMLInputElement;
    expect(aInput.value).toBe("");
    expect(screen.getByText("Code name is required.")).toBeInTheDocument();
  });

  it("shows workflow binding overrides and jumps to the owning action", () => {
    const onJumpToWorkflowAction = vi.fn();
    const selectedComponent = createComponent({
      id: "1",
      type: ComponentType.DataWindow,
      codeName: "orders_grid",
      supportedBindings: ["unityCatalogTable"],
      bindings: {
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: { kind: "resource" },
        },
      },
    });
    const workflowDefinition: WorkflowDefinition = {
      version: 1,
      workflows: [
        {
          codeName: "wf_orders",
          trigger: {
            componentCodeName: "load_button",
            eventKey: "onClick",
          },
          nodes: [
            {
              id: "set-bind-1",
              actionType: "SetBinding",
              schemaVersion: 1,
              params: {
                source: {
                  sourceActionType: "RunSql",
                  nodeId: "run-orders",
                  outputKey: "rows",
                },
                target: {
                  componentCodeName: "orders_grid",
                  bindingType: "unityCatalogTable",
                },
              },
            },
          ],
          edges: [],
        },
      ],
    };

    render(
      <PropertiesPanel
        {...createProps({
          selectedComponent,
          components: [selectedComponent],
          workflowDefinition,
          onWorkflowDefinitionChange: vi.fn(),
          onJumpToWorkflowAction,
        })}
      />,
    );

    expect(screen.getByText("Unity Catalog Table")).toBeInTheDocument();
    expect(screen.getByText("Workflow override")).toBeInTheDocument();
    expect(screen.getByText("wf_orders")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open action" }));

    expect(onJumpToWorkflowAction).toHaveBeenCalledWith(
      "wf_orders",
      "set-bind-1",
    );
  });

  it("shows workflows add button for trigger-capable components", () => {
    const selectedComponent = createComponent({
      id: "button-1",
      type: ComponentType.Button,
      codeName: "open_claims_button",
      supportedEvents: ["onClick"],
    });

    const onWorkflowDefinitionChange = vi.fn();

    render(
      <PropertiesPanel
        {...createProps({
          selectedComponent,
          components: [selectedComponent],
          onWorkflowDefinitionChange,
        })}
      />,
    );

    expect(screen.getByText("Workflows")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ Add Workflow" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Add Workflow" }));

    expect(onWorkflowDefinitionChange).toHaveBeenCalledWith({
      version: 1,
      workflows: [
        {
          codeName: "workflow_1",
          trigger: {
            componentCodeName: "open_claims_button",
            eventKey: "onClick",
          },
          nodes: [],
          edges: [],
        },
      ],
    });
  });

  it("shows existing workflows for selected trigger component only", () => {
    const selectedComponent = createComponent({
      id: "button-1",
      type: ComponentType.Button,
      codeName: "open_claims_button",
      supportedEvents: ["onClick"],
    });
    const otherComponent = createComponent({
      id: "input-1",
      type: ComponentType.TextInput,
      codeName: "status_filter",
      supportedEvents: ["onChange"],
    });
    const workflowDefinition: WorkflowDefinition = {
      version: 1,
      workflows: [
        {
          codeName: "wf_button",
          trigger: {
            componentCodeName: "open_claims_button",
            eventKey: "onClick",
          },
          nodes: [],
          edges: [],
        },
        {
          codeName: "wf_input",
          trigger: {
            componentCodeName: "status_filter",
            eventKey: "onChange",
          },
          nodes: [],
          edges: [],
        },
      ],
    };

    render(
      <PropertiesPanel
        {...createProps({
          selectedComponent,
          components: [selectedComponent, otherComponent],
          workflowDefinition,
          onWorkflowDefinitionChange: vi.fn(),
        })}
      />,
    );

    expect(screen.getByText("wf_button")).toBeInTheDocument();
    expect(screen.queryByText("wf_input")).not.toBeInTheDocument();
  });

  it("shows no-trigger message for components without supported events", () => {
    const selectedComponent = createComponent({
      id: "label-1",
      type: ComponentType.Label,
      codeName: "help_text",
      supportedEvents: [],
    });

    render(
      <PropertiesPanel
        {...createProps({
          selectedComponent,
          components: [selectedComponent],
          onWorkflowDefinitionChange: vi.fn(),
        })}
      />,
    );

    expect(
      screen.getByText("This component does not support workflow triggers."),
    ).toBeInTheDocument();
  });

  it("prevents adding duplicate workflow trigger events", () => {
    const selectedComponent = createComponent({
      id: "button-1",
      type: ComponentType.Button,
      codeName: "open_claims_button",
      supportedEvents: ["onClick"],
    });
    const workflowDefinition: WorkflowDefinition = {
      version: 1,
      workflows: [
        {
          codeName: "wf_button",
          trigger: {
            componentCodeName: "open_claims_button",
            eventKey: "onClick",
          },
          nodes: [],
          edges: [],
        },
      ],
    };

    render(
      <PropertiesPanel
        {...createProps({
          selectedComponent,
          components: [selectedComponent],
          workflowDefinition,
          onWorkflowDefinitionChange: vi.fn(),
        })}
      />,
    );

    expect(screen.getByText("wf_button")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Add Workflow" }),
    ).not.toBeInTheDocument();
  });

  it("creates a first action node when selecting an action", () => {
    const selectedComponent = createComponent({
      id: "button-1",
      type: ComponentType.Button,
      codeName: "open_claims_button",
      supportedEvents: ["onClick"],
    });

    const modalComponent = createComponent({
      id: "modal-1",
      type: ComponentType.Modal,
      codeName: "confirm_modal",
    });

    const initialWorkflowDefinition: WorkflowDefinition = {
      version: 1,
      workflows: [
        {
          codeName: "wf_button",
          trigger: {
            componentCodeName: "open_claims_button",
            eventKey: "onClick",
          },
          nodes: [],
          edges: [],
        },
      ],
    };

    const Wrapper = () => {
      const [def, setDef] = useState(initialWorkflowDefinition);

      return (
        <PropertiesPanel
          {...createProps({
            selectedComponent,
            components: [selectedComponent, modalComponent],
            workflowDefinition: def,
            onWorkflowDefinitionChange: setDef,
          })}
        />
      );
    };

    render(<Wrapper />);

    const actionSelect = screen.getByLabelText(
      "Action",
    ) as HTMLSelectElement;
    expect(actionSelect.value).toBe("");

    fireEvent.change(actionSelect, { target: { value: "ShowModal" } });

    expect(screen.getByText("Modal")).toBeInTheDocument();
    expect(actionSelect.value).toBe("ShowModal");
  });

  it("shows supporting text for complex workflows", () => {
    const selectedComponent = createComponent({
      id: "button-1",
      type: ComponentType.Button,
      codeName: "open_claims_button",
      supportedEvents: ["onClick"],
    });

    const modalComponent = createComponent({
      id: "modal-1",
      type: ComponentType.Modal,
      codeName: "confirm_modal",
    });

    const complexWorkflowDefinition: WorkflowDefinition = {
      version: 1,
      workflows: [
        {
          codeName: "wf_button",
          trigger: {
            componentCodeName: "open_claims_button",
            eventKey: "onClick",
          },
          nodes: [
            {
              id: "node-1",
              actionType: "ShowModal",
              schemaVersion: 1,
              params: {
                modalCodeName: "confirm_modal",
              },
            },
            {
              id: "node-2",
              actionType: "TriggerToast",
              schemaVersion: 1,
              params: {
                body: "",
                duration: { kind: "preset", value: "short" },
              },
            },
          ],
          edges: [
            {
              fromNodeId: "node-1",
              toNodeId: "node-2",
              route: "onSuccess",
            },
          ],
        },
      ],
    };

    render(
      <PropertiesPanel
        {...createProps({
          selectedComponent,
          components: [selectedComponent, modalComponent],
          workflowDefinition: complexWorkflowDefinition,
          onWorkflowDefinitionChange: vi.fn(),
        })}
      />,
    );

    expect(
      screen.getByText(/This panel shows only the basic trigger and first action/i),
    ).toBeInTheDocument();
  });
});
