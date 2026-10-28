import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getProjectMock, getProjectComponentsMock, replaceProjectComponentsMock, generateProjectPreviewMock, project, renderProjectEditorPage, initializeProjectEditorTestState, resetProjectEditorTestState } from "./ProjectEditorPage.test-support";

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage", () => {
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

    const firstEditor = await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Text Input" }));
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
    expect(screen.getByRole("link", { name: "Code" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));

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
    await user.click(screen.getByRole("link", { name: "Code" }));
    expect(await screen.findByLabelText("Generated app code"))
      .toHaveTextContent("import streamlit as st");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Select Text Input: textInput1" }));

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

    const firstEditor = await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Button" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Save changes");
    await user.click(screen.getByRole("combobox", { name: "Button variant" }));
    await user.click(await screen.findByRole("option", { name: "Secondary" }));
    await user.type(screen.getByLabelText("Help text"), "Save the current draft.");
    await user.click(screen.getByRole("switch", { name: "Disabled" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

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
    await user.click(screen.getByRole("link", { name: "Code" }));
    expect(await screen.findByLabelText("Generated app code"))
      .toHaveTextContent("st.button(");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Select Button: button1" }));

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

    const firstEditor = await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Add Checkbox" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Approved");
    await user.type(screen.getByLabelText("Help text"), "Review this value.");
    await user.click(screen.getByRole("switch", { name: "Checked by default" }));

    await user.click(screen.getByRole("button", { name: "Add Toggle" }));
    await user.clear(await screen.findByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Notifications");
    await user.type(screen.getByLabelText("Help text"), "Send update notifications.");
    await user.click(screen.getByRole("switch", { name: "On by default" }));
    await user.click(screen.getByRole("switch", { name: "Disabled" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

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
    await user.click(screen.getByRole("link", { name: "Code" }));
    expect(await screen.findByLabelText("Generated app code"))
      .toHaveTextContent("st.checkbox(");
    expect(screen.getByLabelText("Generated app code"))
      .toHaveTextContent("st.toggle(");

    firstEditor.unmount();
    getProjectMock.mockResolvedValue({ ...project, version: 2 });
    getProjectComponentsMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      components: savedInput?.components ?? [],
    });
    await renderProjectEditorPage();
    await user.click(await screen.findByRole("button", { name: "Select Checkbox: checkbox1" }));

    expect(await screen.findByLabelText("Label")).toHaveValue("Approved");
    expect(screen.getByRole("switch", { name: "Checked by default" })).toHaveAttribute(
      "data-state",
      "checked",
    );
    await user.click(screen.getByRole("button", { name: "Select Toggle: toggle1" }));
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
});
