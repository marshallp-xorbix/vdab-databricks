/**
 * Component category enumeration for organizing components in the toolbox
 */
export const ComponentCategory = {
  Controls: "Controls",
  Layout: "Layout",
  Data: "Data",
  Page: "Page",
  Visualization: "Visualization",
} as const;

export type ComponentCategory =
  (typeof ComponentCategory)[keyof typeof ComponentCategory];

/**
 * Component type enumeration
 *
 * IMPORTANT: Keep this synchronized with backend enum at:
 * Xorbix-Visual-Databricks-App-Builder.Models/DTOs/Vdab/ComponentType.cs
 *
 */
export const ComponentType = {
  TextInput: "TextInput",
  Button: "Button",
  Checkbox: "Checkbox",
  Toggle: "Toggle",
  Dropdown: "Dropdown",
  DatePicker: "DatePicker",
  TimePicker: "TimePicker",
  Slider: "Slider",
  Columns: "Columns",
  Rows: "Rows",
  DataWindow: "DataWindow",
  EditableDataWindow: "EditableDataWindow",
  Form: "Form",
  Modal: "Modal",
  FileUpload: "FileUpload",
  Label: "Label",
  BarChart: "BarChart",
  LineChart: "LineChart",
  PieChart: "PieChart",
  DonutChart: "DonutChart",
  AmoebaStory: "AmoebaStory",
  NetworkWebStory: "NetworkWebStory",
  TerrainStory: "TerrainStory",
  HeatMapStory: "HeatMapStory",
  PulseWaveStory: "PulseWaveStory",
  FlowFieldStory: "FlowFieldStory",
  HoneycombStory: "HoneycombStory",
  SpiralStory: "SpiralStory",
  Tabs: "Tabs",
  Expander: "Expander",
  DashboardEmbed: "DashboardEmbed",
  GenieChat: "GenieChat",
  ModelChat: "ModelChat",
} as const;

export type ComponentType = (typeof ComponentType)[keyof typeof ComponentType];

/**
 * Input type values for the TextInput component's `type` property.
 * Mirrors the Streamlit `type` argument on `st.text_input` and the
 * backend `TextInputTypes` constants.
 */
export const TextInputType = {
  Default: "default",
  Password: "password",
} as const;

export type TextInputType =
  (typeof TextInputType)[keyof typeof TextInputType];

export const humanizeComponentType = (componentType: ComponentType | string): string => {
  return componentType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
};
