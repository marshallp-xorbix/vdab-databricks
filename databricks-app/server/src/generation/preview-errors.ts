import { ApplicationError } from "../application-error.ts";

export function invalidTextInput(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_textinput_properties",
    "Invalid TextInput configuration",
    detail,
  );
}

export function invalidButton(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_button_properties",
    "Invalid Button configuration",
    detail,
  );
}

export function invalidBooleanControl(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_boolean_control_properties",
    "Invalid Checkbox or Toggle configuration",
    detail,
  );
}

export function invalidDropdown(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_dropdown_properties",
    "Invalid Dropdown configuration",
    detail,
  );
}

export function invalidDatePicker(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_datepicker_properties",
    "Invalid DatePicker configuration",
    detail,
  );
}

export function invalidTimePicker(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_timepicker_properties",
    "Invalid TimePicker configuration",
    detail,
  );
}

export function invalidSlider(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_slider_properties",
    "Invalid Slider configuration",
    detail,
  );
}

export function invalidLabel(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_label_properties",
    "Invalid Label configuration",
    detail,
  );
}

export function invalidExpander(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_expander_properties",
    "Invalid Expander configuration",
    detail,
  );
}

export function invalidColumns(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_columns_properties",
    "Invalid Columns configuration",
    detail,
  );
}

export function invalidRows(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_rows_properties",
    "Invalid Rows configuration",
    detail,
  );
}

export function invalidTabs(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_tabs_properties",
    "Invalid Tabs configuration",
    detail,
  );
}

export function invalidForm(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_form_properties",
    "Invalid Form configuration",
    detail,
  );
}

export function invalidModal(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_modal_properties",
    "Invalid Modal configuration",
    detail,
  );
}

export function invalidFileUpload(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_file_upload_properties",
    "Invalid FileUpload configuration",
    detail,
  );
}

export function invalidDataWindow(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_data_window_properties",
    "Invalid DataWindow configuration",
    detail,
  );
}

export function invalidCartesianChart(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_cartesian_chart_properties",
    "Invalid chart configuration",
    detail,
  );
}

export function invalidPieChart(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_pie_chart_properties",
    "Invalid PieChart configuration",
    detail,
  );
}

export function invalidDonutChart(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_donut_chart_properties",
    "Invalid DonutChart configuration",
    detail,
  );
}

export function invalidAmoebaStory(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_amoeba_story_properties",
    "Invalid AmoebaStory configuration",
    detail,
  );
}

export function invalidFlowFieldStory(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_flow_field_story_properties",
    "Invalid FlowFieldStory configuration",
    detail,
  );
}

export function invalidHeatMapStory(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_heat_map_story_properties",
    "Invalid HeatMapStory configuration",
    detail,
  );
}

export function invalidHoneycombStory(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_honeycomb_story_properties",
    "Invalid HoneycombStory configuration",
    detail,
  );
}

export function invalidNetworkWebStory(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_network_web_story_properties",
    "Invalid NetworkWebStory configuration",
    detail,
  );
}

export function invalidPulseWaveStory(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_pulse_wave_story_properties",
    "Invalid PulseWaveStory configuration",
    detail,
  );
}

export function invalidSpiralStory(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_spiral_story_properties",
    "Invalid SpiralStory configuration",
    detail,
  );
}

export function invalidTerrainStory(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_terrain_story_properties",
    "Invalid TerrainStory configuration",
    detail,
  );
}

export function invalidDashboardEmbed(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_dashboard_embed_properties",
    "Invalid DashboardEmbed configuration",
    detail,
  );
}

export function invalidGenieChat(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_genie_chat_properties",
    "Invalid GenieChat configuration",
    detail,
  );
}

export function invalidModelChat(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_model_chat_properties",
    "Invalid ModelChat configuration",
    detail,
  );
}

export function invalidComponentTree(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_component_tree",
    "Invalid component nesting",
    detail,
  );
}
