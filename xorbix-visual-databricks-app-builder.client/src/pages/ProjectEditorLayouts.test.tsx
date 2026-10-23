import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getProjectMock, getProjectComponentsMock, replaceProjectComponentsMock, generateProjectPreviewMock, project, renderProjectEditorPage, initializeProjectEditorTestState, resetProjectEditorTestState } from "./ProjectEditorPage.test-support";

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage", () => {
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
});
