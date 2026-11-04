import type { ProjectSummary } from "../src/contracts.ts";
import type { ProjectComponent, ProjectComponentsDocument } from "../src/db/project-components-contract.ts";

export const project: ProjectSummary = {
  id: "project-preview",
  name: "Preview O'Brien",
  description: null,
  version: 4,
  createdBy: "owner-1",
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
  callerRole: "owner",
};

export function createDocument(components: ProjectComponent[]): ProjectComponentsDocument {
  return {
    projectId: project.id,
    version: project.version,
    components,
  };
}

export function createTextInput(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "customer-name",
    type: "TextInput",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "customerName",
    description: null,
    properties: {
      label: "Customer name",
      placeholder: "Enter a name",
      defaultValue: "Ada",
      help: "Shown on the customer record.",
      disabled: false,
      type: "default",
      multiline: false,
      height: "",
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createButton(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "button-save",
    type: "Button",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "button1",
    description: null,
    properties: {
      label: "Save changes",
      variant: "secondary",
      disabled: false,
      help: "Save the current draft.",
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createCheckbox(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "checkbox-approved",
    type: "Checkbox",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "checkbox1",
    description: null,
    properties: {
      label: "Approved",
      defaultChecked: true,
      help: "Mark this record approved.",
      disabled: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createToggle(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "toggle-notifications",
    type: "Toggle",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "toggle1",
    description: null,
    properties: {
      label: "Notifications",
      defaultValue: false,
      help: "Send update notifications.",
      disabled: true,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createDropdown(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "dropdown-categories",
    type: "Dropdown",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "dropdown1",
    description: null,
    properties: {
      label: "Select an option",
      options: [{ value: "1" }, { value: "2" }],
      defaultValue: "",
      disabled: false,
      help: "",
      placeholder: "Select an option",
      multiselect: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createDatePicker(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "date-project-launch",
    type: "DatePicker",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "datePicker1",
    description: null,
    properties: {
      label: "Launch date",
      defaultValue: "today",
      minDate: "2025-01-01",
      maxDate: "2025-12-31",
      format: "DD/MM/YYYY",
      help: "Choose a launch date.",
      disabled: true,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createTimePicker(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "time-run-start",
    type: "TimePicker",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "timePicker1",
    description: null,
    properties: {
      label: "Run time",
      defaultValue: "08:30:00",
      step: 300,
      help: "Choose the time for the run.",
      disabled: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createSlider(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "slider-completion",
    type: "Slider",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "completion",
    description: null,
    properties: {
      label: "Completion",
      minValue: 0,
      maxValue: 100,
      defaultValue: 50,
      upperValue: 60,
      step: 1,
      disabled: false,
      help: "Choose completion.",
      format: "",
      ranged: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createLabel(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "label-revenue",
    type: "Label",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "revenueLabel",
    description: null,
    properties: {
      text: "Revenue",
      fontSize: "medium",
      bold: false,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createExpander(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "details-expander",
    type: "Expander",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "detailsSection",
    description: null,
    properties: { sectionTitle: "Section", defaultExpanded: false },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createColumns(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "columns-main",
    type: "Columns",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainColumns",
    description: null,
    properties: { columnCount: 2 },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createRows(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "rows-main",
    type: "Rows",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainRows",
    description: null,
    properties: { rowCount: 2 },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createTabs(
  overrides: Partial<ProjectComponent> = {},
): ProjectComponent {
  return {
    key: "tabs-main",
    type: "Tabs",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainTabs",
    description: null,
    properties: { tabs: ["Tab 1", "Tab 2"], defaultTabIndex: 0 },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createForm(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "form-main",
    type: "Form",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainForm",
    description: null,
    properties: {
      submitButtonText: "Submit",
      clearOnSubmit: false,
      enterToSubmit: true,
      border: true,
      width: "stretch",
      height: "content",
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

export function createModal(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
  return {
    key: "modal-main",
    type: "Modal",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "mainModal",
    description: null,
    properties: {
      title: "My Modal",
      width: null,
      height: null,
      position: "center",
      dismissible: true,
    },
    bindings: null,
    children: [],
    layout: null,
    ...overrides,
  };
}

