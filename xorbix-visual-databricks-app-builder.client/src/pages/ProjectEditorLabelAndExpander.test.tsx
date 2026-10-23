import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getProjectMock, getProjectComponentsMock, replaceProjectComponentsMock, generateProjectPreviewMock, project, renderProjectEditorPage, initializeProjectEditorTestState, resetProjectEditorTestState } from "./ProjectEditorPage.test-support";

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage", () => {
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
});
