import { afterEach, beforeEach, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getProjectMock,
  initializeProjectEditorTestState,
  project,
  renderProjectEditorPage,
  resetProjectEditorTestState,
  updateProjectMock,
} from "./ProjectEditorPage.test-support";
import type { IProject } from "../models/Project";

beforeEach(initializeProjectEditorTestState);
afterEach(resetProjectEditorTestState);

it("DeploymentSettings_SaveAndReopen_PreservesWizardTargetAndWorkspaceFolder", async () => {
  const user = userEvent.setup();
  let savedProject: IProject = {
    ...project,
    deploymentSettings: {
      mode: "createNew",
      appName: "parity-demo",
      workspacePath: null,
    },
  };
  getProjectMock.mockImplementation(async () => savedProject);
  updateProjectMock.mockImplementation(async (input) => {
    savedProject = { ...savedProject, ...input, version: input.version + 1 };
    return savedProject;
  });

  await renderProjectEditorPage({ openMainPage: false });
  await user.click(screen.getByRole("link", { name: "Settings" }));
  expect(
    await screen.findByRole("textbox", { name: "Databricks App name" }),
  ).toHaveValue("parity-demo");
  fireEvent.change(screen.getByRole("textbox", { name: "Workspace path" }), {
    target: { value: "/Workspace/Shared/parity-demo" },
  });
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(updateProjectMock).toHaveBeenCalledOnce());
  expect(updateProjectMock.mock.calls[0]?.[0].deploymentSettings).toEqual({
    mode: "createNew",
    appName: "parity-demo",
    workspacePath: "/Workspace/Shared/parity-demo",
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled(),
  );
  await user.click(screen.getByRole("link", { name: "Canvas" }));
  await user.click(screen.getByRole("link", { name: "Settings" }));
  expect(
    await screen.findByRole("textbox", { name: "Workspace path" }),
  ).toHaveValue("/Workspace/Shared/parity-demo");
  expect(
    screen.getByRole("textbox", { name: "Databricks App name" }),
  ).toHaveValue("parity-demo");
});
