import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getProjectComponents } from "../api/projectComponentsApi";
import {
  getProjectMock,
  getProjectComponentsMock,
  replaceProjectComponentsMock,
  getProjectWorkflowMock,
  replaceProjectWorkflowMock,
  getProjectCustomModulesMock,
  replaceProjectCustomModulesMock,
  listWorkspaceServingEndpointsMock,
  project,
  workflowDocument,
  customModulesDocument,
  renderProjectEditorPage,
  createEditorFetch,
  initializeProjectEditorTestState,
  resetProjectEditorTestState,
} from "./ProjectEditorPage.test-support";

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage AI Builder drafts", () => {
  it("applies AI proposals to the editable aggregates and preserves them across editor tabs", async () => {
    const user = userEvent.setup();
    const proposedComponent = {
      key: "ai-save-button",
      type: "Button" as const,
      schemaVersion: 1,
      componentVersion: 1,
      codeName: "aiSaveButton",
      description: null,
      properties: { label: "Save with AI" },
      bindings: null,
      children: [],
      layout: null,
    };
    const aiProposalStream = [
      "event: result",
      `data: ${JSON.stringify({
        assistantMessage: "Added the requested control.",
        proposal: {
          components: [proposedComponent],
          workflow: {
            version: 1,
            workflows: [
              {
                codeName: "saveFlow",
                trigger: {
                  componentKey: "ai-save-button",
                  eventKey: "onClick",
                },
                nodes: [],
                edges: [],
              },
            ],
          },
          customModulesSource:
            "# AI module draft\ndef normalize(value):\n    return value\n",
        },
        version: 1,
      })}`,
      "",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", createEditorFetch(aiProposalStream));
    listWorkspaceServingEndpointsMock.mockResolvedValue({
      items: [
        {
          name: "builder-model",
          readiness: "ready",
          permissionLevel: "CAN_QUERY",
        },
      ],
      authenticationMode: "databricks",
    });

    renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Workflows" }));
    const endpointSelect = await screen.findByRole("combobox", {
      name: "Serving endpoint",
    });
    await waitFor(() => expect(endpointSelect).toHaveValue("builder-model"));
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue(project.name),
    );
    const promptInput = screen.getByRole("textbox", {
      name: "What would you like to change?",
    });
    await waitFor(() => expect(promptInput).toBeEnabled());
    fireEvent.change(promptInput, { target: { value: "Add a save button" } });
    expect(promptInput).toHaveValue("Add a save button");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate suggestion" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Generate suggestion" }),
    );
    await screen.findByText("Added the requested control.");
    await user.click(
      screen.getByRole("button", { name: "Apply proposal to draft" }),
    );

    await user.click(screen.getByRole("button", { name: "App components" }));
    expect(
      screen.getByRole("button", { name: "Save components" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Workflows" }));
    expect(
      await screen.findByLabelText("Custom Python module source"),
    ).toHaveValue(
      "# AI module draft\ndef normalize(value):\n    return value\n",
    );
    expect(
      screen.getByText("Module changes are not saved."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save workflows" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save modules" })).toBeEnabled();
  }, 15_000);

  it("saves AI component, workflow, and module drafts at each shared project version", async () => {
    const user = userEvent.setup();
    let sharedVersion = 1;
    let savedComponents: Awaited<
      ReturnType<typeof getProjectComponents>
    >["components"] = [];
    let savedWorkflow = workflowDocument.workflow;
    let savedModuleSource = customModulesDocument.source;
    getProjectMock.mockImplementation(async () => ({
      ...project,
      version: sharedVersion,
    }));
    getProjectComponentsMock.mockImplementation(async () => ({
      projectId: project.id,
      version: sharedVersion,
      components: savedComponents,
    }));
    getProjectWorkflowMock.mockImplementation(async () => ({
      projectId: project.id,
      version: sharedVersion,
      workflow: savedWorkflow,
    }));
    getProjectCustomModulesMock.mockImplementation(async () => ({
      projectId: project.id,
      version: sharedVersion,
      source: savedModuleSource,
    }));
    replaceProjectComponentsMock.mockImplementation(async (input) => {
      expect(input.version).toBe(sharedVersion);
      savedComponents = input.components;
      sharedVersion += 1;
      return {
        projectId: project.id,
        version: sharedVersion,
        components: savedComponents,
      };
    });
    replaceProjectWorkflowMock.mockImplementation(async (input) => {
      expect(input.version).toBe(sharedVersion);
      savedWorkflow = input.workflow;
      sharedVersion += 1;
      return {
        projectId: project.id,
        version: sharedVersion,
        workflow: savedWorkflow,
      };
    });
    replaceProjectCustomModulesMock.mockImplementation(async (input) => {
      expect(input.version).toBe(sharedVersion);
      savedModuleSource = input.source;
      sharedVersion += 1;
      return {
        projectId: project.id,
        version: sharedVersion,
        source: savedModuleSource,
      };
    });
    const proposedComponent = {
      key: "ai-save-button",
      type: "Button" as const,
      schemaVersion: 1,
      componentVersion: 1,
      codeName: "aiSaveButton",
      description: null,
      properties: { label: "Save with AI" },
      bindings: null,
      children: [],
      layout: null,
    };
    const proposedWorkflow = {
      version: 1 as const,
      workflows: [
        {
          codeName: "saveFlow",
          trigger: { componentKey: proposedComponent.key, eventKey: "onClick" },
          nodes: [],
          edges: [],
        },
      ],
    };
    const proposedModuleSource =
      "# AI module draft\ndef normalize(value):\n    return value\n";
    vi.stubGlobal(
      "fetch",
      createEditorFetch(
        [
          "event: result",
          `data: ${JSON.stringify({
            assistantMessage: "Updated all project drafts.",
            proposal: {
              components: [proposedComponent],
              workflow: proposedWorkflow,
              customModulesSource: proposedModuleSource,
            },
            version: 1,
          })}`,
          "",
          "",
        ].join("\n"),
      ),
    );
    listWorkspaceServingEndpointsMock.mockResolvedValue({
      items: [
        {
          name: "builder-model",
          readiness: "ready",
          permissionLevel: "CAN_QUERY",
        },
      ],
      authenticationMode: "databricks",
    });

    renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Workflows" }));
    const promptInput = await screen.findByRole("textbox", {
      name: "What would you like to change?",
    });
    await waitFor(() => expect(promptInput).toBeEnabled());
    fireEvent.change(promptInput, { target: { value: "Update the project" } });
    await user.click(
      screen.getByRole("button", { name: "Generate suggestion" }),
    );
    await screen.findByText("Updated all project drafts.");
    await user.click(
      screen.getByRole("button", { name: "Apply proposal to draft" }),
    );

    await user.click(screen.getByRole("button", { name: "App components" }));
    await user.click(screen.getByRole("button", { name: "Workflows" }));
    await user.click(
      await screen.findByRole("button", { name: "Save workflows" }),
    );
    await waitFor(() =>
      expect(replaceProjectWorkflowMock).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save workflows" }),
      ).toBeDisabled(),
    );
    await user.click(screen.getByRole("button", { name: "App components" }));
    expect(
      screen.getByRole("button", { name: "Save components" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Workflows" }));
    await user.click(
      await screen.findByRole("button", { name: "Save modules" }),
    );

    await waitFor(() =>
      expect(replaceProjectCustomModulesMock).toHaveBeenCalledTimes(1),
    );
    await waitFor(
      () => expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(1),
      { timeout: 3_000 },
    );
    expect(replaceProjectWorkflowMock.mock.calls[0]?.[0].version).toBe(1);
    expect(replaceProjectCustomModulesMock.mock.calls[0]?.[0].version).toBe(2);
    expect(replaceProjectComponentsMock.mock.calls[0]?.[0].version).toBe(3);
    expect(sharedVersion).toBe(4);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save modules" }),
      ).toBeDisabled(),
    );
    expect(
      screen.queryByText("Module changes are not saved."),
    ).not.toBeInTheDocument();
  }, 20_000);
});
