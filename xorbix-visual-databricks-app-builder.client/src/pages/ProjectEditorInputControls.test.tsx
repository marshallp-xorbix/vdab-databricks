import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getProjectMock, getProjectComponentsMock, replaceProjectComponentsMock, generateProjectPreviewMock, project, renderProjectEditorPage, initializeProjectEditorTestState, resetProjectEditorTestState } from "./ProjectEditorPage.test-support";

afterEach(resetProjectEditorTestState);
beforeEach(initializeProjectEditorTestState);

describe("ProjectEditorPage", () => {
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
});
