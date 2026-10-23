import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getProjectMock,
  updateProjectMock,
  listProjectCollaboratorsMock,
  getProjectComponentsMock,
  replaceProjectWorkflowMock,
  getProjectCustomModulesMock,
  replaceProjectCustomModulesMock,
  project,
  customModulesDocument,
  renderProjectEditorPage,
  initializeProjectEditorTestState,
  resetProjectEditorTestState,
} from "./ProjectEditorPage.test-support";

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage", () => {
  it("opens project access management for the owner", async () => {
    listProjectCollaboratorsMock.mockResolvedValueOnce([
      {
        userId: "editor@example.com",
        role: "editor",
        grantedBy: "user-1",
        createdAt: "2026-10-20T00:00:00.000Z",
      },
    ]);

    renderProjectEditorPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Project access" }),
    );

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
    const sourceEditor = await screen.findByLabelText(
      "Custom Python module source",
    );
    fireEvent.change(sourceEditor, { target: { value: savedDocument.source } });
    fireEvent.click(screen.getByRole("button", { name: "Save modules" }));

    await waitFor(() =>
      expect(replaceProjectCustomModulesMock.mock.calls[0]?.[0]).toEqual({
        projectId: "project-1",
        version: 1,
        source: savedDocument.source,
      }),
    );
    expect(await screen.findByText("Workflows saved.")).toBeInTheDocument();
  });

  it("loads a project and saves changed metadata with its version", async () => {
    getProjectMock.mockResolvedValue(project);
    updateProjectMock.mockResolvedValue({
      ...project,
      name: "Revenue overview",
      version: 2,
    });

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
      components: [
        {
          key: "continue-button",
          type: "Button",
          schemaVersion: 1,
          componentVersion: 1,
          codeName: "continueButton",
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
      ],
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
    await user.click(
      await screen.findByRole("button", { name: "Save workflows" }),
    );

    await waitFor(() => expect(replaceProjectWorkflowMock).toHaveBeenCalled());
    expect(replaceProjectWorkflowMock.mock.calls[0]?.[0]).toMatchObject({
      projectId: project.id,
      version: 1,
      workflow: {
        version: 1,
        workflows: [
          {
            trigger: { componentKey: "continue-button", eventKey: "onClick" },
          },
        ],
      },
    });
  }, 15_000);

  it("keeps read-only projects disabled", async () => {
    getProjectMock.mockResolvedValue({ ...project, callerRole: "viewer" });

    renderProjectEditorPage();

    expect(
      await screen.findByText("You have read-only access to this project."),
    ).toBeInTheDocument();
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Discard changes" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Project list route" }),
    ).toBeInTheDocument();
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
    fireEvent.click(
      screen.getByRole("button", { name: "Reload latest version" }),
    );
    await waitFor(() => expect(nameInput).toHaveValue("Revenue dashboard"));
  });
});
