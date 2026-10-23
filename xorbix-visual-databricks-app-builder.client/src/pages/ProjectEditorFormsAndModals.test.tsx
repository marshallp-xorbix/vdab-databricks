import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getProjectMock, getProjectComponentsMock, replaceProjectComponentsMock, generateProjectPreviewMock, project, renderProjectEditorPage, initializeProjectEditorTestState, resetProjectEditorTestState } from "./ProjectEditorPage.test-support";

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage", () => {
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
