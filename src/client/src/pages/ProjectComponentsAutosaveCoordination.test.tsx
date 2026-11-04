import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getProjectMock,
  project,
  getProjectComponentsMock,
  getProjectWorkflowMock,
  replaceProjectComponentsMock,
  replaceProjectWorkflowMock,
  renderProjectEditorPage,
  initializeProjectEditorTestState,
  resetProjectEditorTestState,
  workflowDocument,
} from "./ProjectEditorPage.test-support";
import { PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS } from "../hooks/useProjectComponentsAutosave";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import type { IProjectComponent } from "../models/ProjectComponents";

vi.mock("../components/AppBuilderComponents/AppCanvas/MainFlowView", () => ({
  default: ({
    onNodeClick,
  }: {
    onNodeClick: (nodeId: string, nodeType: "page" | "modal") => void;
  }) => (
    <button
      type="button"
      onDoubleClick={() => onNodeClick("main-page", "page")}
    >
      Main Page graph node
    </button>
  ),
}));

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage component autosave coordination", () => {
  it("CanvasSave_WorkflowUnavailable_SavesIndependentComponentEdits", async () => {
    const user = userEvent.setup();
    getProjectWorkflowMock.mockRejectedValue(new Error("Workflows temporarily unavailable"));
    replaceProjectComponentsMock.mockImplementation(async (input) => ({ projectId: input.projectId, version: input.version + 1, components: input.components }));
    await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Button" }));
    const label = screen.getByRole("textbox", { name: "Label" });
    fireEvent.change(label, { target: { value: "Latest button label" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalledOnce());
    expect(replaceProjectComponentsMock.mock.calls[0]?.[0].components[0]?.properties.label).toBe("Latest button label");
    expect(replaceProjectWorkflowMock).not.toHaveBeenCalled();
  });
  it("CanvasSave_NewButtonWithOnClick_PersistsComponentBeforeItsWorkflow", async () => {
    const user = userEvent.setup();
    let sharedVersion = 1;
    let savedComponents: IProjectComponent[] = [];
    let savedWorkflow = workflowDocument.workflow;
    getProjectMock.mockImplementation(async () => ({ ...project, version: sharedVersion }));
    getProjectComponentsMock.mockImplementation(async () => ({ projectId: project.id, version: sharedVersion, components: savedComponents }));
    getProjectWorkflowMock.mockImplementation(async () => ({ ...workflowDocument, version: sharedVersion, workflow: savedWorkflow }));
    replaceProjectComponentsMock.mockImplementation(async (input) => {
      expect(input.version).toBe(sharedVersion);
      savedComponents = input.components;
      sharedVersion += 1;
      return { projectId: project.id, version: sharedVersion, components: savedComponents };
    });
    replaceProjectWorkflowMock.mockImplementation(async (input) => {
      expect(input.version).toBe(sharedVersion);
      expect(savedComponents.some((component) => component.key === input.workflow.workflows[0]?.trigger.componentKey)).toBe(true);
      savedWorkflow = input.workflow;
      sharedVersion += 1;
      return { projectId: project.id, version: sharedVersion, workflow: savedWorkflow };
    });

    await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Button" }));
    await user.click(await screen.findByRole("button", { name: "+ Add Workflow" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Action" }), "TriggerToast");
    expect(screen.getByRole("combobox", { name: "Trigger Event" })).toHaveValue("onClick");
    await user.type(screen.getByPlaceholderText("Workflow complete"), "Parity workflow ran");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectWorkflowMock).toHaveBeenCalledOnce());
    expect(replaceProjectComponentsMock).toHaveBeenCalledOnce();
    expect(replaceProjectComponentsMock.mock.calls[0]?.[0].version).toBe(1);
    expect(replaceProjectWorkflowMock.mock.calls[0]?.[0].version).toBe(2);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Edit in Workflow Builder" }));
    expect(await screen.findByRole("link", { name: "Workflow" })).toHaveAttribute("aria-current", "page");
    expect(await within(screen.getByRole("region", { name: "Workflows" })).findByDisplayValue("Parity workflow ran")).toBeInTheDocument();
  }, 10_000);
  it("CanvasSave_DirtyComponentsAndWorkflow_SavesBothWithoutLeavingCanvas", async () => {
    const user = userEvent.setup();
    const initialComponents: IProjectComponent[] = [
      {
        key: "primary-button",
        type: "Button",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "primaryButton",
        description: null,
        properties: {
          label: "Continue",
          variant: "primary",
          disabled: false,
          help: "",
        },
        bindings: null,
        children: [],
        layout: null,
      },
    ];
    let sharedVersion = 1;
    getProjectMock.mockImplementation(async () => ({ ...project, version: sharedVersion }));
    let savedComponents = initialComponents;
    let savedWorkflow = workflowDocument.workflow;
    getProjectComponentsMock.mockImplementation(async () => ({
      projectId: "project-1",
      version: sharedVersion,
      components: savedComponents,
    }));
    getProjectWorkflowMock.mockImplementation(async () => ({
      ...workflowDocument,
      version: sharedVersion,
      workflow: savedWorkflow,
    }));
    replaceProjectWorkflowMock.mockImplementation(async (input) => {
      sharedVersion += 1;
      savedWorkflow = input.workflow;
      return {
        projectId: input.projectId,
        version: sharedVersion,
        workflow: savedWorkflow,
      };
    });
    replaceProjectComponentsMock.mockImplementation(async (input) => {
      sharedVersion += 1;
      savedComponents = input.components;
      return {
        projectId: input.projectId,
        version: sharedVersion,
        components: savedComponents,
      };
    });

    await renderProjectEditorPage({ openMainPage: false });
    await user.click(await screen.findByRole("link", { name: "Workflow" }));
    await user.click(
      (await screen.findAllByRole("button", { name: /Add Workflow/ }))[0]!,
    );
    await user.click(await screen.findByRole("link", { name: "Canvas" }));
    fireEvent.doubleClick(
      await screen.findByRole("button", { name: "Main Page graph node" }),
    );
    await user.click(await screen.findByRole("button", { name: "Main Page" }));
    expect(screen.getByRole("button", { name: "Main Page" })).toHaveAttribute("aria-pressed", "true");
    await user.click(await screen.findByRole("button", { name: "Add Button" }));

    expect(
      await screen.findByText(
        /auto-save will resume after the other project changes are saved/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save" }),
    ).toBeEnabled();
    await new Promise((resolve) => {
      window.setTimeout(resolve, PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS + 100);
    });
    expect(replaceProjectComponentsMock).not.toHaveBeenCalled();

    await user.click(
      await screen.findByRole("button", { name: "Save" }),
    );
    await waitFor(() => {
      expect(replaceProjectWorkflowMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(
      () => {
        expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 3_000 },
    );

    expect(replaceProjectComponentsMock.mock.calls[0]?.[0]).toMatchObject({
      version: 1,
      components: [
        { key: "primary-button", type: "Button" },
        { type: "Button", codeName: "button1" },
      ],
    });
  }, 10_000);

  it("CanvasSave_ComponentRemoval_SavesComponentAndWorkflowCleanup", async () => {
    const user = userEvent.setup();
    const initialComponents: IProjectComponent[] = [
      {
        key: "save-button",
        type: "Button",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "saveButton",
        description: null,
        properties: { label: "Save" },
        bindings: null,
        children: [],
        layout: null,
      },
    ];
    const initialWorkflow: IProjectWorkflowDefinition = {
      version: 1 as const,
      workflows: [
        {
          codeName: "saveFlow",
          trigger: { componentKey: "save-button", eventKey: "onClick" },
          nodes: [],
          edges: [],
        },
      ],
    };
    let sharedVersion = 1;
    getProjectMock.mockImplementation(async () => ({ ...project, version: sharedVersion }));
    let savedComponents = initialComponents;
    let savedWorkflow = initialWorkflow;
    getProjectComponentsMock.mockImplementation(async () => ({
      projectId: "project-1",
      version: sharedVersion,
      components: savedComponents,
    }));
    getProjectWorkflowMock.mockImplementation(async () => ({
      ...workflowDocument,
      version: sharedVersion,
      workflow: savedWorkflow,
    }));
    replaceProjectWorkflowMock.mockImplementation(async (input) => {
      sharedVersion += 1;
      savedWorkflow = input.workflow;
      return {
        projectId: input.projectId,
        version: sharedVersion,
        workflow: savedWorkflow,
      };
    });
    replaceProjectComponentsMock.mockImplementation(async (input) => {
      sharedVersion += 1;
      savedComponents = input.components;
      return {
        projectId: input.projectId,
        version: sharedVersion,
        components: savedComponents,
      };
    });

    await renderProjectEditorPage({ openMainPage: false });
    fireEvent.doubleClick(
      await screen.findByRole("button", { name: "Main Page graph node" }),
    );
    await user.click(await screen.findByRole("button", { name: "Main Page" }));
    await user.click(await screen.findByRole("button", { name: "Select Button: saveButton" }));
    const removeButton = await screen.findByRole("button", {
      name: "Remove selected component",
    });
    await waitFor(() => expect(removeButton).toBeEnabled());
    await user.click(removeButton);
    expect(
      await screen.findByRole("heading", { name: "Remove Button?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/nested children/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove component" }));

    expect(
      screen.queryByRole("button", { name: "Select Button: saveButton" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        /auto-save will resume after the other project changes are saved/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save" }),
    ).toBeEnabled();
    await user.click(
      await screen.findByRole("button", { name: "Save" }),
    );
    await waitFor(() =>
      expect(replaceProjectWorkflowMock).toHaveBeenCalledTimes(1),
    );
    expect(
      replaceProjectWorkflowMock.mock.calls[0]?.[0].workflow.workflows,
    ).toEqual([]);
    await waitFor(
      () => expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(1),
      { timeout: 3_000 },
    );
    expect(replaceProjectComponentsMock.mock.calls[0]?.[0]).toMatchObject({
      version: 1,
      components: [],
    });
    expect(replaceProjectWorkflowMock.mock.calls[0]?.[0].version).toBe(2);
  }, 12_000);

  it("reorders root components with accessible move controls", async () => {
    const user = userEvent.setup();
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 1,
      components: [
        {
          key: "first-button",
          type: "Button",
          schemaVersion: 1,
          componentVersion: 1,
          codeName: "firstButton",
          description: null,
          properties: { label: "First" },
          bindings: null,
          children: [],
          layout: null,
        },
        {
          key: "second-button",
          type: "Button",
          schemaVersion: 1,
          componentVersion: 1,
          codeName: "secondButton",
          description: null,
          properties: { label: "Second" },
          bindings: null,
          children: [],
          layout: null,
        },
      ],
    });

    await renderProjectEditorPage({ openMainPage: false });
    fireEvent.doubleClick(
      await screen.findByRole("button", { name: "Main Page graph node" }),
    );
    await user.click(await screen.findByRole("button", { name: "Main Page" }));
    await user.click(
      await screen.findByRole("button", { name: "Select Button: secondButton" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Move selected component up" }),
    );
    expect(screen.getByRole("button", { name: "Move selected component up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move selected component down" })).toBeEnabled();
  });
});
