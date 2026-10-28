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
  generateProjectPreviewMock,
  project,
  customModulesDocument,
  renderProjectEditorPage,
  initializeProjectEditorTestState,
  resetProjectEditorTestState,
} from "./ProjectEditorPage.test-support";

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage", () => {
  it("shows only the App Flow tab before a page node is opened", async () => {
    await renderProjectEditorPage({ openMainPage: false });

    expect(await screen.findByRole("button", { name: "App Flow" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Main Page" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Add Modal" })).toBeInTheDocument();
  });

  it("opens a modal canvas in its own closable SaaS-style tab", async () => {
    getProjectComponentsMock.mockResolvedValueOnce({
      projectId: project.id,
      version: 1,
      components: [
        {
          key: "review-modal",
          type: "Modal",
          schemaVersion: 1,
          componentVersion: 1,
          codeName: "reviewModal",
          description: null,
          properties: { title: "Review request" },
          bindings: null,
          children: ["modal-label"],
          layout: null,
        },
        {
          key: "modal-label",
          type: "Label",
          schemaVersion: 1,
          componentVersion: 1,
          codeName: "reviewPrompt",
          description: null,
          properties: { label: "Review this request" },
          bindings: null,
          children: [],
          layout: { y: 0 },
        },
      ],
    });
    const user = userEvent.setup();
    await renderProjectEditorPage({ openMainPage: false });

    await user.dblClick(
      await screen.findByRole("button", { name: "Review modal graph node" }),
    );

    expect(
      await screen.findByRole("button", { name: "Review request" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await screen.findByRole("button", { name: "Close Review request" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "App Flow" })).toBeInTheDocument();
  });

  it("opens project access management for the owner", async () => {
    listProjectCollaboratorsMock.mockResolvedValueOnce([
      {
        userId: "editor@example.com",
        role: "editor",
        grantedBy: "user-1",
        createdAt: "2026-10-20T00:00:00.000Z",
      },
    ]);

    await renderProjectEditorPage();
    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Permissions" }));

    expect(await screen.findByText("editor@example.com")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Who can edit" }),
    ).toBeInTheDocument();
    expect(listProjectCollaboratorsMock).toHaveBeenCalledWith(
      "project-1",
      expect.any(AbortSignal),
    );
  });

  it("opens the deployment panel from the builder Deploy action", async () => {
    await renderProjectEditorPage();

    await userEvent.click(await screen.findByRole("link", { name: "Deploy" }));

    expect(
      await screen.findByRole("heading", { name: "Child App deployment" }),
    ).toBeInTheDocument();
  });

  it("saves and reopens custom Python source under the shared project version", async () => {
    getProjectMock.mockResolvedValue(project);
    generateProjectPreviewMock.mockResolvedValue({
      projectId: project.id,
      version: 1,
      previewOnly: true,
      files: [{ path: "app.py", content: "import streamlit as st\n" }],
    });
    const savedDocument = {
      ...customModulesDocument,
      version: 2,
      source: "def normalize_order(ctx):\n    return {'ok': True}\n",
    };
    getProjectCustomModulesMock
      .mockResolvedValueOnce(customModulesDocument)
      .mockResolvedValueOnce(savedDocument);
    replaceProjectCustomModulesMock.mockResolvedValue(savedDocument);

    await renderProjectEditorPage();

    fireEvent.click(await screen.findByRole("link", { name: "Code" }));
    fireEvent.click(await screen.findByRole("button", { name: "custom_modules.py" }));
    const sourceEditor = await screen.findByLabelText(
      "Custom Python module source",
    );
    fireEvent.change(sourceEditor, { target: { value: savedDocument.source } });
    fireEvent.click(screen.getByRole("button", { name: "Save custom modules" }));

    await waitFor(() =>
      expect(replaceProjectCustomModulesMock.mock.calls[0]?.[0]).toEqual({
        projectId: "project-1",
        version: 1,
        source: savedDocument.source,
      }),
    );
    expect(screen.getByRole("button", { name: "Save custom modules" })).toBeDisabled();
  });

  it("opens the retained generated-file tree and requests a standalone preview", async () => {
    generateProjectPreviewMock.mockResolvedValue({
      projectId: project.id,
      version: 1,
      previewOnly: true,
      files: [{ path: "app.py", content: "import streamlit as st\n" }],
    });

    await renderProjectEditorPage();
    await userEvent.click(await screen.findByRole("link", { name: "Code" }));

    expect(await screen.findByRole("button", { name: "app.py" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "custom_modules.py" })).toBeInTheDocument();
    await waitFor(() =>
      expect(generateProjectPreviewMock.mock.calls[0]?.[0]).toBe(project.id),
    );
    expect(screen.getByRole("button", { name: "Save custom modules" })).toBeDisabled();
  });

  it("loads a project and saves changed metadata with its version", async () => {
    getProjectMock.mockResolvedValue(project);
    updateProjectMock.mockResolvedValue({
      ...project,
      name: "Revenue overview",
      version: 2,
    });

    await renderProjectEditorPage();

    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));
    const nameInput = await screen.findByLabelText("Name");
    expect(await screen.findByRole("heading", { name: project.name })).toBeInTheDocument();
    fireEvent.change(nameInput, { target: { value: "Revenue overview" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(updateProjectMock).toHaveBeenCalled());
    expect(updateProjectMock.mock.calls[0]?.[0]).toEqual({
      id: "project-1",
      name: "Revenue overview",
      description: "Finance team",
      version: 1,
    });
    expect(await screen.findByText("Project saved.")).toBeInTheDocument();
  });

  it("saves the retained SaaS theme editor through the project version guard", async () => {
    getProjectMock.mockResolvedValue(project);
    updateProjectMock.mockResolvedValue({
      ...project,
      theme: { primaryColor: "#ff0000" },
      version: 2,
    });

    await renderProjectEditorPage();
    await userEvent.click(await screen.findByRole("link", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "App Theme" }));
    const primaryColorInput = document.querySelector<HTMLInputElement>(
      'input[type="color"]',
    );
    expect(primaryColorInput).not.toBeNull();
    fireEvent.change(primaryColorInput!, {
      target: { value: "#ff0000" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(updateProjectMock.mock.calls[0]?.[0]).toEqual({
      id: "project-1",
      name: project.name,
      description: project.description,
      version: 1,
      theme: {
        primaryColor: "#ff0000",
      },
    }));
  });

  it("shows and saves the SaaS page-width control from the main-page canvas", async () => {
    updateProjectMock.mockResolvedValue({
      ...project,
      theme: { pageWidth: "900" },
      version: 2,
    });

    const user = userEvent.setup();
    await renderProjectEditorPage({ openMainPage: false });
    await user.dblClick(await screen.findByRole("button", { name: "Main Page graph node" }));

    const widthInput = await screen.findByLabelText("Page width value");
    expect(widthInput).toHaveValue(730);
    await user.clear(widthInput);
    await user.type(widthInput, "900");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateProjectMock.mock.calls[0]?.[0]).toEqual({
      id: project.id,
      name: project.name,
      description: project.description,
      version: project.version,
      theme: { pageWidth: "900" },
    }));
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

    await renderProjectEditorPage();

    await user.click(await screen.findByRole("link", { name: "Workflow" }));
    const addWorkflowButtons = await screen.findAllByRole("button", {
      name: /Add Workflow/,
    });
    await user.click(addWorkflowButtons[0]!);
    await user.click(
      await screen.findByRole("button", { name: "Save" }),
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

    await renderProjectEditorPage();

    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));
    expect(
      await screen.findByText("You have read-only access to this project."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("asks before leaving a dirty project", async () => {
    getProjectMock.mockResolvedValue(project);

    const { router } = await renderProjectEditorPage();
    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Unsaved name" },
    });
    fireEvent.click(screen.getByRole("link", { name: "Back to Apps" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Discard unsaved changes?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/apps/project-1");

    fireEvent.click(screen.getByRole("link", { name: "Back to Apps" }));
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

    await renderProjectEditorPage();
    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));
    const nameInput = await screen.findByLabelText("Name");
    expect(await screen.findByRole("heading", { name: project.name })).toBeInTheDocument();
    fireEvent.change(nameInput, {
      target: { value: "Outdated name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This project was updated by another user.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reload latest version" }),
    );
    await waitFor(() => expect(nameInput).toHaveValue("Revenue dashboard"));
  });
});
