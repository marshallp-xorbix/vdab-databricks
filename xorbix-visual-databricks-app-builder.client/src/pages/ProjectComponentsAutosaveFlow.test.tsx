import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  replaceProjectComponentsMock,
  renderProjectEditorPage,
  initializeProjectEditorTestState,
  resetProjectEditorTestState,
} from "./ProjectEditorPage.test-support";
import { PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS } from "../hooks/useProjectComponentsAutosave";

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage component autosave", () => {
  it("saves component changes after editing pauses without a manual save", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock.mockImplementation(async (input) => ({
      projectId: input.projectId,
      version: input.version + 1,
      components: input.components,
    }));

    await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Button" }));

    expect(
      await screen.findByText(/save automatically after you pause editing/i),
    ).toBeInTheDocument();
    await waitFor(
      () => {
        expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 3_000 },
    );

    expect(replaceProjectComponentsMock.mock.calls[0]?.[0]).toMatchObject({
      projectId: "project-1",
      version: 1,
      components: [{ type: "Button", codeName: "button1" }],
    });
    expect(await screen.findByText("Components saved.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save" }),
    ).toBeDisabled();
  });

  it("does not retry an autosave failure and keeps manual retry available", async () => {
    const user = userEvent.setup();
    replaceProjectComponentsMock
      .mockRejectedValueOnce(new Error("Temporary save failure."))
      .mockImplementationOnce(async (input) => ({
        projectId: input.projectId,
        version: input.version + 1,
        components: input.components,
      }));

    await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Button" }));

    await waitFor(
      () => {
        expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 3_000 },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Temporary save failure.",
    );
    expect(
      await screen.findByText(/automatic save failed/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS + 100);
    });
    expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Save" }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(replaceProjectComponentsMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Components saved.")).toBeInTheDocument();
  }, 8_000);
});
