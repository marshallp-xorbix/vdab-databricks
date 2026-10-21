/** Component types retained by the standalone builder, synchronized to the legacy registry. */
export const PROJECT_COMPONENT_TYPES = [
  "TextInput",
  "Button",
  "Checkbox",
  "Toggle",
  "Dropdown",
  "DatePicker",
  "TimePicker",
  "Slider",
  "Columns",
  "Rows",
  "DataWindow",
  "EditableDataWindow",
  "Form",
  "Modal",
  "FileUpload",
  "Label",
  "BarChart",
  "LineChart",
  "PieChart",
  "DonutChart",
  "AmoebaStory",
  "NetworkWebStory",
  "TerrainStory",
  "HeatMapStory",
  "PulseWaveStory",
  "FlowFieldStory",
  "HoneycombStory",
  "SpiralStory",
  "Tabs",
  "Expander",
  "DashboardEmbed",
  "GenieChat",
  "ModelChat",
] as const;

/** Simple control types currently supported in one-level layout slots. */
export const LAYOUT_CHILD_COMPONENT_TYPES = [
  "TextInput",
  "Button",
  "Checkbox",
  "Toggle",
  "Dropdown",
  "DatePicker",
  "TimePicker",
  "FileUpload",
  "Slider",
  "Label",
] as const;

/** Form controls supported by this source-preview slice. Streamlit forms own submission. */
export const FORM_CHILD_COMPONENT_TYPES = [
  "TextInput",
  "Checkbox",
  "Toggle",
  "Dropdown",
  "DatePicker",
  "TimePicker",
  "Slider",
  "Label",
] as const;

/** Component types that the legacy builder can place directly inside a Modal. */
export const MODAL_CHILD_COMPONENT_TYPES = PROJECT_COMPONENT_TYPES.filter(
  (type) => type !== "Modal",
);

export type ProjectComponentType = (typeof PROJECT_COMPONENT_TYPES)[number];

/** JSON value stored as project-owned component configuration. */
export type ProjectJsonValue =
  | null
  | boolean
  | number
  | string
  | ProjectJsonValue[]
  | ProjectJsonObject;

/** JSON object stored as project-owned component configuration. */
export interface ProjectJsonObject {
  [propertyName: string]: ProjectJsonValue;
}

/** Portable component definition with stable project-local identity and order. */
export interface ProjectComponent {
  key: string;
  type: ProjectComponentType;
  schemaVersion: number;
  componentVersion: number;
  codeName: string | null;
  description: string | null;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  children: string[];
  layout: ProjectJsonObject | null;
}

/** Component collection read or written at one project optimistic version. */
export interface ProjectComponentsDocument {
  projectId: string;
  version: number;
  components: ProjectComponent[];
}
