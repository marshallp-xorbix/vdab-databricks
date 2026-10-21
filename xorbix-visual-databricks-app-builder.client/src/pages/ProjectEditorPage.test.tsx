import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import type { IProject } from "../models/Project";
import type { IProjectWorkflowDocument } from "../models/ProjectWorkflow";
import type { IProjectCustomModulesDocument } from "../models/ProjectCustomModules";
import type { IComponentRegistry } from "../models/ComponentRegistry";
import { ThemeProvider } from "../context/ThemeContext";
import { getProject, updateProject } from "../api/projectsApi";
import { listProjectCollaborators } from "../api/projectCollaboratorsApi";
import { getProjectWorkflow, replaceProjectWorkflow } from "../api/projectWorkflowApi";
import { getProjectCustomModules, replaceProjectCustomModules } from "../api/projectCustomModulesApi";
import { getComponentRegistry } from "../api/componentRegistryApi";
import { listWorkspaceServingEndpoints } from "../api/workspaceResourcesApi";
import type { IWorkspaceServingEndpointsPage } from "../models/WorkspaceServingEndpoint";
import {
  generateProjectPreview,
  getProjectComponents,
  replaceProjectComponents,
} from "../api/projectComponentsApi";
import ProjectEditorPage from "./ProjectEditorPage";

vi.mock("../api/projectsApi", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock("../api/projectCollaboratorsApi", () => ({
  listProjectCollaborators: vi.fn(),
  revokeProjectCollaborator: vi.fn(),
}));
vi.mock("../api/projectComponentsApi", () => ({
  generateProjectPreview: vi.fn(),
  getProjectComponents: vi.fn(),
  replaceProjectComponents: vi.fn(),
}));
vi.mock("../api/projectWorkflowApi", () => ({
  getProjectWorkflow: vi.fn(),
  replaceProjectWorkflow: vi.fn(),
}));
vi.mock("../api/projectCustomModulesApi", () => ({
  getProjectCustomModules: vi.fn(),
  replaceProjectCustomModules: vi.fn(),
}));
vi.mock("../api/componentRegistryApi", () => ({
  getComponentRegistry: vi.fn(),
}));
vi.mock("../api/workspaceResourcesApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/workspaceResourcesApi")>(),
  listWorkspaceServingEndpoints: vi.fn(),
}));

const getProjectMock = vi.mocked(getProject);
const updateProjectMock = vi.mocked(updateProject);
const listProjectCollaboratorsMock = vi.mocked(listProjectCollaborators);
const getProjectComponentsMock = vi.mocked(getProjectComponents);
const replaceProjectComponentsMock = vi.mocked(replaceProjectComponents);
const generateProjectPreviewMock = vi.mocked(generateProjectPreview);
const getProjectWorkflowMock = vi.mocked(getProjectWorkflow);
const replaceProjectWorkflowMock = vi.mocked(replaceProjectWorkflow);
const getProjectCustomModulesMock = vi.mocked(getProjectCustomModules);
const replaceProjectCustomModulesMock = vi.mocked(replaceProjectCustomModules);
const getComponentRegistryMock = vi.mocked(getComponentRegistry);
const listWorkspaceServingEndpointsMock = vi.mocked(listWorkspaceServingEndpoints);

const project: IProject = {
  id: "project-1",
  name: "Revenue dashboard",
  description: "Finance team",
  version: 1,
  createdBy: "user-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};
const workflowDocument: IProjectWorkflowDocument = {
  projectId: "project-1",
  version: 1,
  workflow: { version: 1, workflows: [] },
};
const customModulesDocument: IProjectCustomModulesDocument = {
  projectId: "project-1",
  version: 1,
  source: "# custom modules\n",
};
const componentRegistry: IComponentRegistry = {
  version: 1,
  components: [{
    id: "template-button",
    codeName: "templateButton",
    type: "Button",
    category: "Controls",
    icon: "MousePointerClick",
    layout: null,
    schemaVersion: 1,
    bindings: null,
    supportedBindings: null,
    supportedEvents: ["onClick"],
    children: null,
    props: {},
  }],
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  getProjectMock.mockResolvedValue(project);
  getProjectComponentsMock.mockResolvedValue({
    projectId: "project-1",
    version: 1,
    components: [],
  });
  getProjectWorkflowMock.mockResolvedValue(workflowDocument);
  getProjectCustomModulesMock.mockResolvedValue(customModulesDocument);
  getComponentRegistryMock.mockResolvedValue(componentRegistry);
  listWorkspaceServingEndpointsMock.mockResolvedValue({
    items: [],
    authenticationMode: "local-test",
  } satisfies IWorkspaceServingEndpointsPage);
  listProjectCollaboratorsMock.mockResolvedValue([]);
});

function renderProjectEditorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/apps/:appId", element: <ProjectEditorPage /> },
      { path: "/apps", element: <h1>Project list route</h1> },
    ],
    { initialEntries: ["/apps/project-1"] },
  );

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );

  return { router, unmount: rendered.unmount };
}

describe("ProjectEditorPage", () => {
  it("opens project access management for the owner", async () => {
    listProjectCollaboratorsMock.mockResolvedValueOnce([{
      userId: "editor@example.com",
      role: "editor",
      grantedBy: "user-1",
      createdAt: "2026-10-20T00:00:00.000Z",
    }]);

    renderProjectEditorPage();
    fireEvent.click(await screen.findByRole("button", { name: "Project access" }));

    expect(await screen.findByText("editor@example.com")).toBeInTheDocument();
    expect(listProjectCollaboratorsMock).toHaveBeenCalledWith(
      "project-1",
      expect.any(AbortSignal),
    );
  });

  it("saves and reopens custom Python source under the shared project version", async () => {
    getProjectMock.mockResolvedValue(project);
    const savedDocument = {
      ...customModulesDocument,
      version: 2,
      source: "def normalize_order(ctx):\n    return {'ok': True}\n",
    };
    getProjectCustomModulesMock
      .mockResolvedValueOnce(customModulesDocument)
      .mockResolvedValueOnce(savedDocument);
    replaceProjectCustomModulesMock.mockResolvedValue(savedDocument);

    renderProjectEditorPage();

    fireEvent.click(await screen.findByRole("button", { name: "Workflows" }));
    const sourceEditor = await screen.findByLabelText("Custom Python module source");
    fireEvent.change(sourceEditor, { target: { value: savedDocument.source } });
    fireEvent.click(screen.getByRole("button", { name: "Save modules" }));

    await waitFor(() => expect(replaceProjectCustomModulesMock.mock.calls[0]?.[0]).toEqual({
      projectId: "project-1",
      version: 1,
      source: savedDocument.source,
    }));
    expect(await screen.findByText("Workflows saved.")).toBeInTheDocument();
  });

  it("loads a project and saves changed metadata with its version", async () => {
    getProjectMock.mockResolvedValue(project);
    updateProjectMock.mockResolvedValue({ ...project, name: "Revenue overview", version: 2 });

    renderProjectEditorPage();

    const nameInput = await screen.findByLabelText("Name");
    await screen.findByText("Version 1 · owner");
    fireEvent.change(nameInput, { target: { value: "Revenue overview" } });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));

    await waitFor(() => expect(updateProjectMock).toHaveBeenCalled());
    expect(updateProjectMock.mock.calls[0]?.[0]).toEqual({
      id: "project-1",
      name: "Revenue overview",
      description: "Finance team",
      version: 1,
    });
    expect(await screen.findByText("Project saved.")).toBeInTheDocument();
  });

  it("adds and saves a standalone workflow using project component keys", async () => {
    const user = userEvent.setup();
    getProjectMock.mockResolvedValue(project);
    getProjectComponentsMock.mockResolvedValue({
      projectId: project.id,
      version: 1,
      components: [{
        key: "continue-button",
        type: "Button",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "continueButton",
        description: null,
        properties: { label: "Continue", variant: "primary", disabled: false, help: "" },
        bindings: null,
        children: [],
        layout: null,
      }],
    });
    replaceProjectWorkflowMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      workflow: input.workflow,
    }));

    renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Workflows" }));
    const addWorkflowButtons = await screen.findAllByRole("button", {
      name: /Add Workflow/,
    });
    await user.click(addWorkflowButtons[0]!);
    await user.click(await screen.findByRole("button", { name: "Save workflows" }));

    await waitFor(() => expect(replaceProjectWorkflowMock).toHaveBeenCalled());
    expect(replaceProjectWorkflowMock.mock.calls[0]?.[0]).toMatchObject({
      projectId: project.id,
      version: 1,
      workflow: {
        version: 1,
        workflows: [{
          trigger: { componentKey: "continue-button", eventKey: "onClick" },
        }],
      },
    });
  }, 15_000);

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
              workflows: [{
                codeName: "saveFlow",
                trigger: { componentKey: "ai-save-button", eventKey: "onClick" },
                nodes: [],
                edges: [],
              }],
            },
            customModulesSource: "# AI module draft\ndef normalize(value):\n    return value\n",
          },
          version: 1,
        })}`,
      "",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      aiProposalStream,
      { status: 200, headers: { "content-type": "text/event-stream" } },
    )));
    listWorkspaceServingEndpointsMock.mockResolvedValue({
      items: [{ name: "builder-model", readiness: "ready", permissionLevel: "CAN_QUERY" }],
      authenticationMode: "databricks",
    });

    renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Workflows" }));
    const endpointSelect = await screen.findByRole("combobox", { name: "Serving endpoint" });
    await waitFor(() => expect(endpointSelect).toHaveValue("builder-model"));
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(project.name));
    const promptInput = screen.getByRole("textbox", { name: "What would you like to change?" });
    await waitFor(() => expect(promptInput).toBeEnabled());
    fireEvent.change(promptInput, { target: { value: "Add a save button" } });
    expect(promptInput).toHaveValue("Add a save button");
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate suggestion" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Generate suggestion" }));
    await screen.findByText("Added the requested control.");
    await user.click(screen.getByRole("button", { name: "Apply proposal to draft" }));

    await user.click(screen.getByRole("button", { name: "App components" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save components" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Workflows" }));
    expect(await screen.findByLabelText("Custom Python module source")).toHaveValue(
      "# AI module draft\ndef normalize(value):\n    return value\n",
    );
    expect(screen.getByText("Module changes are not saved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save workflows" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save modules" })).toBeEnabled();
  }, 15_000);

  it("saves AI component, workflow, and module drafts at each shared project version", async () => {
    const user = userEvent.setup();
    let sharedVersion = 1;
    let savedComponents: Awaited<ReturnType<typeof getProjectComponents>>["components"] = [];
    let savedWorkflow = workflowDocument.workflow;
    let savedModuleSource = customModulesDocument.source;
    getProjectMock.mockImplementation(async () => ({ ...project, version: sharedVersion }));
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
      return { projectId: project.id, version: sharedVersion, components: savedComponents };
    });
    replaceProjectWorkflowMock.mockImplementation(async (input) => {
      expect(input.version).toBe(sharedVersion);
      savedWorkflow = input.workflow;
      sharedVersion += 1;
      return { projectId: project.id, version: sharedVersion, workflow: savedWorkflow };
    });
    replaceProjectCustomModulesMock.mockImplementation(async (input) => {
      expect(input.version).toBe(sharedVersion);
      savedModuleSource = input.source;
      sharedVersion += 1;
      return { projectId: project.id, version: sharedVersion, source: savedModuleSource };
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
      workflows: [{
        codeName: "saveFlow",
        trigger: { componentKey: proposedComponent.key, eventKey: "onClick" },
        nodes: [],
        edges: [],
      }],
    };
    const proposedModuleSource = "# AI module draft\ndef normalize(value):\n    return value\n";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response([
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
    ].join("\n"), { status: 200, headers: { "content-type": "text/event-stream" } })));
    listWorkspaceServingEndpointsMock.mockResolvedValue({
      items: [{ name: "builder-model", readiness: "ready", permissionLevel: "CAN_QUERY" }],
      authenticationMode: "databricks",
    });

    renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Workflows" }));
    const promptInput = await screen.findByRole("textbox", { name: "What would you like to change?" });
    await waitFor(() => expect(promptInput).toBeEnabled());
    fireEvent.change(promptInput, { target: { value: "Update the project" } });
    await user.click(screen.getByRole("button", { name: "Generate suggestion" }));
    await screen.findByText("Updated all project drafts.");
    await user.click(screen.getByRole("button", { name: "Apply proposal to draft" }));

    await user.click(screen.getByRole("button", { name: "App components" }));
    await user.click(await screen.findByRole("button", { name: "Save components" }));
    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Workflows" }));
    await user.click(await screen.findByRole("button", { name: "Save workflows" }));
    await waitFor(() => expect(replaceProjectWorkflowMock).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole("button", { name: "Save modules" }));

    await waitFor(() => expect(replaceProjectCustomModulesMock).toHaveBeenCalledTimes(1));
    expect(replaceProjectComponentsMock.mock.calls[0]?.[0].version).toBe(1);
    expect(replaceProjectWorkflowMock.mock.calls[0]?.[0].version).toBe(2);
    expect(replaceProjectCustomModulesMock.mock.calls[0]?.[0].version).toBe(3);
    expect(sharedVersion).toBe(4);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save modules" })).toBeDisabled(),
    );
    expect(screen.queryByText("Module changes are not saved.")).not.toBeInTheDocument();
  }, 20_000);

  it("keeps read-only projects disabled", async () => {
    getProjectMock.mockResolvedValue({ ...project, callerRole: "viewer" });

    renderProjectEditorPage();

    expect(await screen.findByText("You have read-only access to this project."))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save project" })).toBeDisabled();
  });

  it("asks before leaving a dirty project", async () => {
    getProjectMock.mockResolvedValue(project);

    const { router } = renderProjectEditorPage();
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Unsaved name" },
    });
    fireEvent.click(screen.getByRole("link", { name: "Projects" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Discard unsaved changes?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/apps/project-1");

    fireEvent.click(screen.getByRole("link", { name: "Projects" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(await screen.findByRole("heading", { name: "Project list route" }))
      .toBeInTheDocument();
  });

  it("offers reload after a stale save", async () => {
    getProjectMock.mockResolvedValue(project);
    updateProjectMock.mockRejectedValueOnce(
      new Error("This project was updated by another user."),
    );

    renderProjectEditorPage();
    const nameInput = await screen.findByLabelText("Name");
    await screen.findByText("Version 1 · owner");
    fireEvent.change(nameInput, {
      target: { value: "Outdated name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This project was updated by another user.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload latest version" }));
    await waitFor(() => expect(nameInput).toHaveValue("Revenue dashboard"));
  });

  it("adds, edits, saves, previews, and reopens TextInput components", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{ path: "app.py", content: "import streamlit as st\\n" }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Text input" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Customer name");
    await user.type(screen.getByLabelText("Placeholder"), "Type a name");
    await user.type(screen.getByLabelText("Default value"), "Ada");
    await user.type(
      screen.getByLabelText("Help text"),
      "Name shown on the customer record.",
    );
    await user.click(screen.getByRole("switch", { name: "Disabled" }));
    await user.click(screen.getByRole("combobox", { name: "Input type" }));
    await user.click(await screen.findByRole("option", { name: "Password" }));
    await user.click(screen.getByRole("switch", { name: "Multiline" }));
    await user.type(screen.getByLabelText("Height"), "240");
    expect(screen.getByRole("button", { name: "Generate preview" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.version).toBe(1);
    expect(savedInput?.components[0]).toMatchObject({
      type: "TextInput",
      codeName: "textInput1",
      properties: {
        label: "Customer name",
        placeholder: "Type a name",
        defaultValue: "Ada",
        help: "Name shown on the customer record.",
        disabled: true,
        type: "password",
        multiline: true,
        height: "240",
      },
    });
    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("import streamlit as st");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Label")).toHaveValue("Customer name");
    expect(screen.getByLabelText("Placeholder")).toHaveValue("Type a name");
    expect(screen.getByLabelText("Default value")).toHaveValue("Ada");
    expect(screen.getByLabelText("Help text")).toHaveValue(
      "Name shown on the customer record.",
    );
    expect(screen.getByRole("switch", { name: "Disabled" })).toHaveAttribute(
      "data-state",
      "checked",
    );
  }, 15_000);

  it("adds, edits, saves, previews, and reopens Button components", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{ path: "app.py", content: "vdab_button1 = st.button(\\n" }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add button" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Save changes");
    await user.click(screen.getByRole("combobox", { name: "Button variant" }));
    await user.click(await screen.findByRole("option", { name: "Secondary" }));
    await user.type(screen.getByLabelText("Help text"), "Save the current draft.");
    await user.click(screen.getByRole("switch", { name: "Disabled" }));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.version).toBe(1);
    expect(savedInput?.components[0]).toMatchObject({
      type: "Button",
      codeName: "button1",
      properties: {
        label: "Save changes",
        variant: "secondary",
        disabled: true,
        help: "Save the current draft.",
      },
    });
    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("st.button(");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Label")).toHaveValue("Save changes");
    expect(screen.getByLabelText("Help text")).toHaveValue("Save the current draft.");
    expect(screen.getByRole("switch", { name: "Disabled" })).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(screen.getByRole("combobox", { name: "Button variant" }))
      .toHaveTextContent("Secondary");
  }, 15_000);

  it("adds, edits, saves, previews, and reopens Checkbox and Toggle components", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{ path: "app.py", content: "st.checkbox(\\nst.toggle(\\n" }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add checkbox" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Approved");
    await user.type(screen.getByLabelText("Help text"), "Review this value.");
    await user.click(screen.getByRole("switch", { name: "Checked by default" }));

    await user.click(screen.getByRole("button", { name: "Add toggle" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Notifications");
    await user.type(screen.getByLabelText("Help text"), "Send update notifications.");
    await user.click(screen.getByRole("switch", { name: "On by default" }));
    await user.click(screen.getByRole("switch", { name: "Disabled" }));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components).toMatchObject([
      {
        type: "Checkbox",
        codeName: "checkbox1",
        properties: {
          label: "Approved",
          defaultChecked: true,
          help: "Review this value.",
          disabled: false,
        },
      },
      {
        type: "Toggle",
        codeName: "toggle1",
        properties: {
          label: "Notifications",
          defaultValue: true,
          help: "Send update notifications.",
          disabled: true,
        },
      },
    ]);
    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("st.checkbox(");
    expect(screen.getByLabelText("Generated Python preview"))
      .toHaveTextContent("st.toggle(");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Label")).toHaveValue("Approved");
    expect(screen.getByRole("switch", { name: "Checked by default" })).toHaveAttribute(
      "data-state",
      "checked",
    );
    await user.click(screen.getByRole("button", { name: "2. Toggle: Notifications" }));
    expect(screen.getByLabelText("Help text")).toHaveValue("Send update notifications.");
    expect(screen.getByRole("switch", { name: "On by default" })).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(screen.getByRole("switch", { name: "Disabled" })).toHaveAttribute(
      "data-state",
      "checked",
    );
  }, 20_000);

  it("adds, edits, saves, previews, and reopens Dropdown components", async () => {
    const user = userEvent.setup();
    getProjectMock.mockResolvedValue(project);
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{ path: "app.py", content: "st.multiselect(\\n" }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add dropdown" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Department");
    fireEvent.change(screen.getByLabelText("Options (one per line)"), {
      target: { value: "Sales\nFinance" },
    });
    await user.click(screen.getByRole("combobox", { name: "Default option" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));
    await user.clear(screen.getByLabelText("Placeholder"));
    await user.type(screen.getByLabelText("Placeholder"), "Choose teams");
    await user.type(screen.getByLabelText("Help text"), "Select one or more.");
    await user.click(screen.getByRole("switch", { name: "Allow multiple selections" }));
    await user.click(screen.getByRole("switch", { name: "Disabled" }));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components[0]).toMatchObject({
      type: "Dropdown",
      codeName: "dropdown1",
      properties: {
        label: "Department",
        options: [{ value: "Sales" }, { value: "Finance" }],
        defaultValue: "Finance",
        placeholder: "Choose teams",
        help: "Select one or more.",
        multiselect: true,
        disabled: true,
      },
    });
    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("st.multiselect(");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Label")).toHaveValue("Department");
    expect(screen.getByLabelText("Options (one per line)")).toHaveValue("Sales\nFinance");
    expect(screen.getByRole("combobox", { name: "Default option" }))
      .toHaveTextContent("Finance");
    expect(screen.getByRole("switch", { name: "Allow multiple selections" }))
      .toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("switch", { name: "Disabled" }))
      .toHaveAttribute("data-state", "checked");
  }, 20_000);

  it("adds, edits, saves, previews, and reopens DatePicker and TimePicker components", async () => {
    const user = userEvent.setup();
    getProjectMock.mockResolvedValue(project);
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{ path: "app.py", content: "st.date_input(\\nst.time_input(\\n" }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add date picker" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Launch date");
    await user.clear(screen.getByLabelText("Default date"));
    await user.type(screen.getByLabelText("Default date"), "2026-11-12");
    fireEvent.change(screen.getByLabelText("Minimum date"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Maximum date"), {
      target: { value: "2026-12-31" },
    });
    await user.type(screen.getByLabelText("Date format"), "DD/MM/YYYY");
    await user.type(screen.getByLabelText("Help text"), "Choose a launch date.");
    await user.click(screen.getByRole("switch", { name: "Disabled" }));

    await user.click(screen.getByRole("button", { name: "Add time picker" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Run time");
    await user.clear(screen.getByLabelText("Default time"));
    await user.type(screen.getByLabelText("Default time"), "14:15:00");
    await user.clear(screen.getByLabelText("Step in seconds"));
    await user.type(screen.getByLabelText("Step in seconds"), "1800");
    await user.type(screen.getByLabelText("Help text"), "Choose a run time.");
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components).toMatchObject([
      {
        type: "DatePicker",
        codeName: "datePicker1",
        properties: {
          label: "Launch date",
          defaultValue: "2026-11-12",
          minDate: "2026-01-01",
          maxDate: "2026-12-31",
          format: "DD/MM/YYYY",
          help: "Choose a launch date.",
          disabled: true,
        },
      },
      {
        type: "TimePicker",
        codeName: "timePicker1",
        properties: {
          label: "Run time",
          defaultValue: "14:15:00",
          step: 1800,
          help: "Choose a run time.",
          disabled: false,
        },
      },
    ]);
    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    const preview = await screen.findByLabelText("Generated Python preview");
    expect(preview).toHaveTextContent("st.date_input(");
    expect(preview).toHaveTextContent("st.time_input(");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Label")).toHaveValue("Launch date");
    expect(screen.getByLabelText("Default date")).toHaveValue("2026-11-12");
    expect(screen.getByLabelText("Date format")).toHaveValue("DD/MM/YYYY");
    expect(screen.getByRole("switch", { name: "Disabled" })).toHaveAttribute(
      "data-state",
      "checked",
    );
    await user.click(screen.getByRole("button", { name: "2. TimePicker: Run time" }));
    expect(screen.getByLabelText("Default time")).toHaveValue("14:15:00");
    expect(screen.getByLabelText("Step in seconds")).toHaveValue(1800);
    expect(screen.getByLabelText("Help text")).toHaveValue("Choose a run time.");
  }, 20_000);

  it("adds, edits, saves, previews, and reopens scalar and ranged Slider components", async () => {
    const user = userEvent.setup();
    getProjectMock.mockResolvedValue(project);
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{ path: "app.py", content: "st.slider(\\n" }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add slider" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Invoice amount");
    fireEvent.change(screen.getByLabelText("Minimum value"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Maximum value"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Default value"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Step"), {
      target: { value: "5" },
    });
    await user.type(screen.getByLabelText("Display format"), "percent");
    await user.type(screen.getByLabelText("Help text"), "Choose an amount.");
    await user.click(screen.getByRole("switch", { name: "Select a range" }));
    fireEvent.change(await screen.findByLabelText("Upper value"), {
      target: { value: "80" },
    });
    await user.click(screen.getByRole("switch", { name: "Disabled" }));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components[0]).toMatchObject({
      type: "Slider",
      codeName: "slider1",
      properties: {
        label: "Invoice amount",
        minValue: 0,
        maxValue: 100,
        defaultValue: 25,
        upperValue: 80,
        step: 5,
        disabled: true,
        help: "Choose an amount.",
        format: "percent",
        ranged: true,
      },
    });
    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("st.slider(");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Label")).toHaveValue("Invoice amount");
    expect(screen.getByLabelText("Lower value")).toHaveValue(25);
    expect(screen.getByLabelText("Upper value")).toHaveValue(80);
    expect(screen.getByLabelText("Step")).toHaveValue(5);
    expect(screen.getByLabelText("Display format")).toHaveValue("percent");
    expect(screen.getByRole("switch", { name: "Select a range" })).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(screen.getByRole("switch", { name: "Disabled" })).toHaveAttribute(
      "data-state",
      "checked",
    );
  }, 20_000);

  it("adds, edits, saves, previews, and reopens Label components", async () => {
    const user = userEvent.setup();
    getProjectMock.mockResolvedValue(project);
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{ path: "app.py", content: "html.escape(str(label))" }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add label" }));
    const textInput = await screen.findByLabelText("Text");
    await user.clear(textInput);
    await user.type(textInput, "Revenue <summary>");
    await user.selectOptions(screen.getByLabelText("Font size"), "large");
    await user.click(screen.getByRole("switch", { name: "Bold" }));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components[0]).toMatchObject({
      type: "Label",
      codeName: "label1",
      properties: {
        text: "Revenue <summary>",
        fontSize: "large",
        bold: true,
      },
    });
    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("html.escape");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Text")).toHaveValue("Revenue <summary>");
    expect(screen.getByLabelText("Font size")).toHaveValue("large");
    expect(screen.getByRole("switch", { name: "Bold" })).toHaveAttribute(
      "data-state",
      "checked",
    );
  }, 20_000);

  it("adds an Expander child, saves ordered nesting, previews, and reopens it", async () => {
    const user = userEvent.setup();
    getProjectMock.mockResolvedValue(project);
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{
        path: "app.py",
        content: "with st.expander('Details', expanded=True):\\n    st.text_input(",
      }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add expander" }));
    await user.clear(await screen.findByLabelText("Section title"));
    await user.type(screen.getByLabelText("Section title"), "Details");
    await user.click(screen.getByRole("switch", { name: "Expanded by default" }));
    await user.click(screen.getByRole("button", { name: "Add child component" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Nested name");
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components).toHaveLength(2);
    expect(savedInput?.components[0]).toMatchObject({
      type: "Expander",
      codeName: "expander1",
      properties: { sectionTitle: "Details", defaultExpanded: true },
      children: [savedInput?.components[1]?.key],
    });
    expect(savedInput?.components[1]).toMatchObject({
      type: "TextInput",
      codeName: "textInput1",
      properties: { label: "Nested name" },
    });

    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("with st.expander");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Section title")).toHaveValue("Details");
    expect(screen.getByRole("switch", { name: "Expanded by default" }))
      .toHaveAttribute("data-state", "checked");
    await user.click(screen.getByRole("button", { name: "1.1. TextInput: Nested name" }));
    expect(await screen.findByLabelText("Label")).toHaveValue("Nested name");
  }, 20_000);

  it("adds controls to ordered Columns slots, saves, previews, and reopens them", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{
        path: "app.py",
        content: "vdab_columns1 = st.columns(3)\\nwith vdab_columns1[0]:",
      }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add columns" }));
    await user.selectOptions(screen.getByLabelText("Column count"), "3");
    await user.click(screen.getByRole("button", { name: "Add child component" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Left");
    await user.click(await screen.findByRole("button", { name: "1. Columns: 3 columns" }));
    await user.click(screen.getByRole("button", { name: "Add child component" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Center");
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components).toHaveLength(3);
    expect(savedInput?.components[0]).toMatchObject({
      type: "Columns",
      codeName: "columns1",
      properties: { columnCount: 3 },
      children: [
        savedInput?.components[1]?.key,
        savedInput?.components[2]?.key,
      ],
    });
    expect(savedInput?.components[1]?.properties.label).toBe("Left");
    expect(savedInput?.components[2]?.properties.label).toBe("Center");

    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("st.columns(3)");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Column count")).toHaveValue("3");
    await user.click(screen.getByRole("button", { name: "1.2. TextInput: Center" }));
    expect(await screen.findByLabelText("Label")).toHaveValue("Center");
  }, 20_000);

  it("adds controls to ordered Rows slots, saves, previews, and reopens them", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{
        path: "app.py",
        content: "vdab_rows1 = st.container()\\nwith vdab_rows1:\\n    st.text('Row 3')",
      }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add rows" }));
    await user.selectOptions(screen.getByLabelText("Row count"), "3");
    await user.click(screen.getByRole("button", { name: "Add child component" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "First row");
    await user.click(screen.getByRole("button", { name: "1. Rows: 3 rows" }));
    await user.selectOptions(screen.getByLabelText("Child component type"), "Button");
    await user.click(screen.getByRole("button", { name: "Add child component" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Save record");
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components).toHaveLength(3);
    expect(savedInput?.components[0]).toMatchObject({
      type: "Rows",
      codeName: "rows1",
      properties: { rowCount: 3 },
      children: [
        savedInput?.components[1]?.key,
        savedInput?.components[2]?.key,
      ],
    });
    expect(savedInput?.components[1]).toMatchObject({
      type: "TextInput",
      properties: { label: "First row" },
    });
    expect(savedInput?.components[2]).toMatchObject({
      type: "Button",
      properties: { label: "Save record" },
    });

    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    expect(await screen.findByLabelText("Generated Python preview"))
      .toHaveTextContent("st.container()");
    expect(screen.getByLabelText("Generated Python preview"))
      .toHaveTextContent("st.text('Row 3')");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Row count")).toHaveValue("3");
    await user.click(screen.getByRole("button", { name: "1.2. Button: Save record" }));
    expect(await screen.findByLabelText("Label")).toHaveValue("Save record");
  }, 20_000);

  it("edits multiple Tabs panes, saves their order, previews, and reopens them", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{
        path: "app.py",
        content: "vdab_tabs1 = st.tabs(\\n    default='Details',\\nwith vdab_tabs1[0]:\\nwith vdab_tabs1[1]:\\nwith vdab_tabs1[2]:\\n    st.checkbox(",
      }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add tabs" }));
    await user.selectOptions(screen.getByLabelText("Edit tab contents"), "0");
    await user.click(screen.getByRole("button", { name: "Add child component" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "First tab control");

    await user.click(screen.getByRole("button", { name: "1. Tabs: 2 tabs" }));
    await user.selectOptions(screen.getByLabelText("Child component type"), "Button");
    await user.click(screen.getByRole("button", { name: "Add child component" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Second control");

    await user.click(screen.getByRole("button", { name: "1. Tabs: 2 tabs" }));
    await user.selectOptions(screen.getByLabelText("Edit tab contents"), "1");
    await user.selectOptions(screen.getByLabelText("Child component type"), "Label");
    await user.click(screen.getByRole("button", { name: "Add child component" }));
    await user.clear(await screen.findByLabelText("Text"));
    await user.type(screen.getByLabelText("Text"), "Details content");

    await user.click(screen.getByRole("button", { name: "1. Tabs: 2 tabs" }));
    await user.clear(await screen.findByLabelText("Tab 2 name"));
    await user.type(screen.getByLabelText("Tab 2 name"), "Details");
    await user.selectOptions(screen.getByLabelText("Default tab"), "1");
    await user.click(screen.getByRole("button", { name: "Add tab" }));
    await user.clear(await screen.findByLabelText("Tab 3 name"));
    await user.type(screen.getByLabelText("Tab 3 name"), "History");
    await user.selectOptions(screen.getByLabelText("Edit tab contents"), "2");
    await user.selectOptions(screen.getByLabelText("Child component type"), "Checkbox");
    await user.click(screen.getByRole("button", { name: "Add child component" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "History enabled");
    await user.click(screen.getByRole("button", { name: "1. Tabs: 3 tabs" }));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components).toHaveLength(5);
    expect(savedInput?.components[0]).toMatchObject({
      type: "Tabs",
      codeName: "tabs1",
      properties: {
        tabs: ["Tab 1", "Details", "History"],
        defaultTabIndex: 1,
      },
      children: [
        savedInput?.components[1]?.key,
        savedInput?.components[2]?.key,
        savedInput?.components[3]?.key,
        savedInput?.components[4]?.key,
      ],
    });
    expect(savedInput?.components[1]?.layout).toEqual({ tabIndex: 0, y: 0 });
    expect(savedInput?.components[2]?.layout).toEqual({ tabIndex: 0, y: 1 });
    expect(savedInput?.components[3]?.layout).toEqual({ tabIndex: 1, y: 0 });
    expect(savedInput?.components[4]?.layout).toEqual({ tabIndex: 2, y: 0 });

    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    const preview = await screen.findByLabelText("Generated Python preview");
    expect(preview).toHaveTextContent("st.tabs(");
    expect(preview).toHaveTextContent("default='Details'");
    expect(preview).toHaveTextContent("with vdab_tabs1[0]:");
    expect(preview).toHaveTextContent("with vdab_tabs1[1]:");
    expect(preview).toHaveTextContent("with vdab_tabs1[2]:");
    expect(preview).toHaveTextContent("st.checkbox(");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    expect(await screen.findByLabelText("Tab 2 name")).toHaveValue("Details");
    expect(screen.getByLabelText("Default tab")).toHaveValue("1");
    await user.click(screen.getByRole("button", { name: "1. Tabs: 3 tabs" }));
    await user.selectOptions(screen.getByLabelText("Edit tab contents"), "1");
    expect(screen.getByText("1 component in this tab")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "1.2.1. Label: Details content" }));
    expect(await screen.findByLabelText("Text")).toHaveValue("Details content");

    await user.click(screen.getByRole("button", { name: "1. Tabs: 3 tabs" }));
    await user.selectOptions(screen.getByLabelText("Edit tab contents"), "1");
    await user.click(screen.getByRole("button", { name: "Remove active tab" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Deleting this tab will also remove 1 component from the project.",
    );
    await user.click(screen.getByRole("button", { name: "Delete tab and components" }));

    expect(await screen.findByLabelText("Tab 2 name")).toHaveValue("History");
    expect(screen.getByLabelText("Default tab")).toHaveValue("1");
    await user.click(screen.getByRole("button", { name: "Save components" }));
    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(2));
    const componentsAfterDelete = replaceProjectComponentsMock.mock.calls[1]?.[0].components;
    expect(componentsAfterDelete).toHaveLength(4);
    expect(componentsAfterDelete?.[0]).toMatchObject({
      properties: { tabs: ["Tab 1", "History"], defaultTabIndex: 1 },
      children: [
        componentsAfterDelete?.[1]?.key,
        componentsAfterDelete?.[2]?.key,
        componentsAfterDelete?.[3]?.key,
      ],
    });
    expect(componentsAfterDelete?.[3]?.layout).toEqual({ tabIndex: 1, y: 0 });
  }, 30_000);

  it("adds Form controls in order, previews, and reopens Form settings", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{
        path: "app.py",
        content: "with st.form(\\n    key='vdab_form1',\\n    width=720,\\n    height='content',\\n    vdab_recordname = st.text_input(\\n    vdab_approved = st.checkbox(\\n    submitted = st.form_submit_button('Save record')\\nif submitted:",
      }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add form" }));
    await user.clear(screen.getByLabelText("Submit button label"));
    await user.type(screen.getByLabelText("Submit button label"), "Save record");
    await user.click(screen.getByRole("switch", { name: "Clear values after submit" }));
    await user.selectOptions(screen.getByLabelText("Form width"), "custom");
    await user.clear(screen.getByLabelText("Form width in pixels"));
    await user.type(screen.getByLabelText("Form width in pixels"), "720");

    await user.click(screen.getByRole("button", { name: "Add form control" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Record name");
    await user.click(screen.getByRole("button", { name: "1. Form: 1 form controls" }));
    await user.selectOptions(screen.getByLabelText("Form control type"), "Checkbox");
    await user.click(screen.getByRole("button", { name: "Add form control" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Approved");
    await user.click(screen.getByRole("button", { name: "1. Form: 2 form controls" }));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components).toHaveLength(3);
    expect(savedInput?.components[0]).toMatchObject({
      type: "Form",
      codeName: "form1",
      properties: {
        submitButtonText: "Save record",
        clearOnSubmit: true,
        enterToSubmit: true,
        border: true,
        width: 720,
        height: "content",
      },
      children: [savedInput?.components[1]?.key, savedInput?.components[2]?.key],
    });
    expect(savedInput?.components[1]).toMatchObject({
      type: "TextInput",
      properties: { label: "Record name" },
    });
    expect(savedInput?.components[2]).toMatchObject({
      type: "Checkbox",
      properties: { label: "Approved" },
    });

    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    const preview = await screen.findByLabelText("Generated Python preview");
    expect(preview).toHaveTextContent("with st.form(");
    expect(preview).toHaveTextContent("width=720");
    expect(preview).toHaveTextContent("st.form_submit_button('Save record')");
    expect(preview.textContent?.indexOf("st.text_input(")).toBeLessThan(
      preview.textContent?.indexOf("st.checkbox("),
    );

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "1. Form: 2 form controls" }));
    expect(await screen.findByLabelText("Submit button label")).toHaveValue("Save record");
    expect(screen.getByRole("switch", { name: "Clear values after submit" }))
      .toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Form width")).toHaveValue("custom");
    expect(screen.getByLabelText("Form width in pixels")).toHaveValue(720);
    await user.click(screen.getByRole("button", { name: "1.2. Checkbox: Approved" }));
    expect(await screen.findByLabelText("Label")).toHaveValue("Approved");
  }, 30_000);

  it("adds Modal content with nested layouts and previews a named dialog", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));
    generateProjectPreviewMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      previewOnly: true,
      files: [{
        path: "app.py",
        content: "@st.dialog('Review item', width='medium', position='right', dismissible=False)\\ndef show_modal1():\\n    vdab_directnote = st.text_input(\\n    with st.form(\\n        vdab_modalnote = st.text_input(\\n    if st.button('Close', key='vdab_modal1_close'):",
      }],
    });

    const firstEditor = renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add modal" }));
    await user.clear(screen.getByLabelText("Dialog title"));
    await user.type(screen.getByLabelText("Dialog title"), "Review item");
    await user.selectOptions(screen.getByLabelText("Dialog width"), "medium");
    await user.selectOptions(screen.getByLabelText("Dialog position"), "right");
    await user.click(screen.getByRole("switch", { name: "Allow dialog dismissal" }));
    await user.click(screen.getByRole("button", { name: "Add modal content" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Direct note");

    await user.click(screen.getByRole("button", { name: "1. Modal: Review item" }));
    await user.selectOptions(screen.getByLabelText("Modal content type"), "Form");
    await user.click(screen.getByRole("button", { name: "Add modal content" }));
    await user.click(screen.getByRole("button", { name: "1.2. Form: 0 form controls" }));
    await user.click(screen.getByRole("button", { name: "Add form control" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Modal note");
    await user.click(screen.getByRole("button", { name: "1. Modal: Review item" }));
    await user.click(screen.getByRole("button", { name: "Save components" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const savedInput = replaceProjectComponentsMock.mock.calls[0]?.[0];
    expect(savedInput?.components).toHaveLength(4);
    expect(savedInput?.components[0]).toMatchObject({
      type: "Modal",
      codeName: "modal1",
      properties: {
        title: "Review item",
        width: "medium",
        height: null,
        position: "right",
        dismissible: false,
      },
      children: [savedInput?.components[1]?.key, savedInput?.components[2]?.key],
    });
    expect(savedInput?.components[1]).toMatchObject({
      type: "TextInput",
      properties: { label: "Direct note" },
      layout: { y: 0 },
    });
    expect(savedInput?.components[2]).toMatchObject({
      type: "Form",
      children: [savedInput?.components[3]?.key],
    });
    expect(savedInput?.components[3]).toMatchObject({
      type: "TextInput",
      properties: { label: "Modal note" },
    });

    await user.click(await screen.findByRole("button", { name: "Generate preview" }));
    const preview = await screen.findByLabelText("Generated Python preview");
    expect(preview).toHaveTextContent(
      "@st.dialog('Review item', width='medium', position='right', dismissible=False)",
    );
    expect(preview).toHaveTextContent("def show_modal1():");
    expect(preview).toHaveTextContent("with st.form(");
    expect(preview).toHaveTextContent("st.button('Close'");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "1. Modal: Review item" }));
    expect(await screen.findByLabelText("Dialog width")).toHaveValue("medium");
    expect(screen.getByLabelText("Dialog position")).toHaveValue("right");
    expect(screen.getByRole("switch", { name: "Allow dialog dismissal" }))
      .toHaveAttribute("data-state", "unchecked");
    await user.click(screen.getByRole("button", { name: "1.2. Form: 1 form controls" }));
    await user.click(screen.getByRole("button", { name: "1.2.1. TextInput: Modal note" }));
    expect(await screen.findByLabelText("Label")).toHaveValue("Modal note");
  }, 30_000);
});
