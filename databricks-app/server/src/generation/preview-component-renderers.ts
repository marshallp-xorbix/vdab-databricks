import type { ApplicationError } from "../application-error.ts";
import type { ProjectComponent } from "../db/project-components-contract.ts";
import { invalidBooleanControl, invalidButton, invalidDatePicker, invalidDropdown, invalidLabel, invalidSlider, invalidTextInput, invalidTimePicker } from "./preview-errors.ts";
import type { BooleanControlProperties, ButtonProperties, DatePickerProperties, DropdownProperties, LabelProperties, SliderProperties, TextInputProperties, TimePickerProperties } from "./preview-models.ts";
import { LABEL_FONT_SIZES } from "./preview-range-properties.ts";
import { formatPythonNumber, pythonHeight, pythonString, pythonStringList } from "./preview-python.ts";
import { appendWorkflowCallbackArguments } from "./preview-workflow-runtime.ts";

export function appendTextInput(
  lines: string[],
  component: ProjectComponent,
  properties: TextInputProperties,
  variableName: string,
  workflowEventKey?: string,
): void {
  validateSimpleComponentShape(component, "TextInput", invalidTextInput);

  const codeName = component.codeName ?? component.key;
  const labelVariable = `_vdab_lbl_${variableName}`;
  const displayLabelVariable = `_vdab_disp_lbl_${variableName}`;
  const widgetFunction = properties.multiline ? "text_area" : "text_input";
  const stateKey = variableName;

  lines.push(
    "",
    `${labelVariable} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabelVariable} = ${labelVariable} if ${labelVariable} is not None else ${pythonString(properties.label)}`,
    `if ${pythonString(stateKey)} not in st.session_state:`,
    `    st.session_state[${pythonString(stateKey)}] = ${pythonString(properties.defaultValue)}`,
    `${variableName} = st.${widgetFunction}(`,
    `    label=${displayLabelVariable},`,
  );

  if (properties.placeholder !== "") {
    lines.push(`    placeholder=${pythonString(properties.placeholder)},`);
  }

  if (properties.help !== "") {
    lines.push(`    help=${pythonString(properties.help)},`);
  }

  if (properties.disabled) {
    lines.push("    disabled=True,");
  }

  if (!properties.multiline && properties.type === "password") {
    lines.push("    type='password',");
  }

  if (properties.multiline && properties.height !== "") {
    lines.push(`    height=${pythonHeight(properties.height)},`);
  }

  appendWorkflowCallbackArguments(lines, component.key, workflowEventKey);
  lines.push(`    key=${pythonString(stateKey)}`, ")");
}

export function appendButton(
  lines: string[],
  component: ProjectComponent,
  properties: ButtonProperties,
  variableName: string,
  workflowEventKey?: string,
): void {
  validateSimpleComponentShape(component, "Button", invalidButton);

  const codeName = component.codeName ?? component.key;
  const labelVariable = `_vdab_lbl_${variableName}`;
  const displayLabelVariable = `_vdab_disp_lbl_${variableName}`;

  lines.push(
    "",
    `${labelVariable} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabelVariable} = ${labelVariable} if ${labelVariable} is not None else ${pythonString(properties.label)}`,
    `${variableName} = st.button(`,
    `    label=${displayLabelVariable},`,
    `    key=${pythonString(variableName)},`,
  );

  if (properties.variant !== "") {
    lines.push(`    type=${pythonString(properties.variant)},`);
  }

  lines.push(`    disabled=${properties.disabled ? "True" : "False"},`);

  if (properties.help !== "") {
    lines.push(`    help=${pythonString(properties.help)},`);
  }

  appendWorkflowCallbackArguments(lines, component.key, workflowEventKey);
  lines.push(")");
}

export function appendBooleanControl(
  lines: string[],
  component: ProjectComponent,
  properties: BooleanControlProperties,
  variableName: string,
  componentType: "Checkbox" | "Toggle",
  workflowEventKey?: string,
): void {
  validateSimpleComponentShape(component, componentType, invalidBooleanControl);

  const codeName = component.codeName ?? component.key;
  const labelVariable = `_vdab_lbl_${variableName}`;
  const displayLabelVariable = `_vdab_disp_lbl_${variableName}`;
  const widgetFunction = componentType === "Checkbox" ? "checkbox" : "toggle";

  lines.push(
    "",
    `${labelVariable} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabelVariable} = ${labelVariable} if ${labelVariable} is not None else ${pythonString(properties.label)}`,
    `if ${pythonString(variableName)} not in st.session_state:`,
    `    st.session_state[${pythonString(variableName)}] = ${properties.defaultValue ? "True" : "False"}`,
    `${variableName} = st.${widgetFunction}(`,
    `    label=${displayLabelVariable},`,
  );

  if (properties.help !== "") {
    lines.push(`    help=${pythonString(properties.help)},`);
  }

  lines.push(`    disabled=${properties.disabled ? "True" : "False"},`);

  appendWorkflowCallbackArguments(lines, component.key, workflowEventKey);
  lines.push(`    key=${pythonString(variableName)}`, ")");
}

export function appendDropdown(
  lines: string[],
  component: ProjectComponent,
  properties: DropdownProperties,
  variableName: string,
  workflowEventKey?: string,
): void {
  validateSimpleComponentShape(component, "Dropdown", invalidDropdown);

  const codeName = component.codeName ?? component.key;
  const labelVariable = `_vdab_lbl_${variableName}`;
  const displayLabelVariable = `_vdab_disp_lbl_${variableName}`;
  const selectedOptions = properties.multiselect
    ? properties.defaultValue === "" ? [] : [properties.defaultValue]
    : [properties.options.includes(properties.defaultValue) && properties.defaultValue !== "None"
      ? properties.defaultValue
      : properties.options[0] ?? ""];
  const initialState = properties.multiselect
    ? pythonStringList(selectedOptions)
    : pythonString(selectedOptions[0] ?? "");
  const widgetFunction = properties.multiselect ? "multiselect" : "selectbox";

  lines.push(
    "",
    `${labelVariable} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabelVariable} = ${labelVariable} if ${labelVariable} is not None else ${pythonString(properties.label)}`,
    `if ${pythonString(variableName)} not in st.session_state:`,
    `    st.session_state[${pythonString(variableName)}] = ${initialState}`,
    `${variableName} = st.${widgetFunction}(`,
    `    label=${displayLabelVariable},`,
    `    options=${pythonStringList(properties.options)},`,
  );

  if (properties.placeholder !== "") {
    lines.push(`    placeholder=${pythonString(properties.placeholder)},`);
  }

  if (properties.help !== "") {
    lines.push(`    help=${pythonString(properties.help)},`);
  }

  appendWorkflowCallbackArguments(lines, component.key, workflowEventKey);
  lines.push(
    `    disabled=${properties.disabled ? "True" : "False"},`,
    `    key=${pythonString(variableName)}`,
    ")",
  );
}

export function appendDatePicker(
  lines: string[],
  component: ProjectComponent,
  properties: DatePickerProperties,
  variableName: string,
  workflowEventKey?: string,
): void {
  validateSimpleComponentShape(component, "DatePicker", invalidDatePicker);

  const codeName = component.codeName ?? component.key;
  const labelVariable = `_vdab_lbl_${variableName}`;
  const displayLabelVariable = `_vdab_disp_lbl_${variableName}`;

  lines.push(
    "",
    `${labelVariable} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabelVariable} = ${labelVariable} if ${labelVariable} is not None else ${pythonString(properties.label)}`,
    `${variableName} = st.date_input(`,
    `    label=${displayLabelVariable},`,
  );

  if (properties.defaultValue !== "") {
    lines.push(`    value=${pythonString(properties.defaultValue)},`);
  }

  if (properties.minDate !== "") {
    lines.push(`    min_value=${pythonString(properties.minDate)},`);
  }

  if (properties.maxDate !== "") {
    lines.push(`    max_value=${pythonString(properties.maxDate)},`);
  }

  appendOptionalDatePickerArguments(lines, properties);
  appendWorkflowCallbackArguments(lines, component.key, workflowEventKey);
  lines.push(`    key=${pythonString(variableName)}`, ")");
}

export function appendOptionalDatePickerArguments(
  lines: string[],
  properties: DatePickerProperties,
): void {
  if (properties.format !== "") {
    lines.push(`    format=${pythonString(properties.format)},`);
  }

  lines.push(`    disabled=${properties.disabled ? "True" : "False"},`);
  if (properties.help !== "") {
    lines.push(`    help=${pythonString(properties.help)},`);
  }
}

export function appendTimePicker(
  lines: string[],
  component: ProjectComponent,
  properties: TimePickerProperties,
  variableName: string,
  workflowEventKey?: string,
): void {
  validateSimpleComponentShape(component, "TimePicker", invalidTimePicker);

  const codeName = component.codeName ?? component.key;
  const labelVariable = `_vdab_lbl_${variableName}`;
  const displayLabelVariable = `_vdab_disp_lbl_${variableName}`;

  lines.push(
    "",
    `${labelVariable} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabelVariable} = ${labelVariable} if ${labelVariable} is not None else ${pythonString(properties.label)}`,
    `${variableName} = st.time_input(`,
    `    label=${displayLabelVariable},`,
  );

  if (properties.defaultValue !== "") {
    lines.push(`    value=${pythonString(properties.defaultValue)},`);
  }

  if (properties.step !== null) {
    lines.push(`    step=${properties.step},`);
  }

  lines.push(`    disabled=${properties.disabled ? "True" : "False"},`);
  if (properties.help !== "") {
    lines.push(`    help=${pythonString(properties.help)},`);
  }

  appendWorkflowCallbackArguments(lines, component.key, workflowEventKey);
  lines.push(`    key=${pythonString(variableName)}`, ")");
}

export function appendSlider(
  lines: string[],
  component: ProjectComponent,
  properties: SliderProperties,
  variableName: string,
  workflowEventKey?: string,
): void {
  validateSimpleComponentShape(component, "Slider", invalidSlider);

  const codeName = component.codeName ?? component.key;
  const labelVariable = `_vdab_lbl_${variableName}`;
  const displayLabelVariable = `_vdab_disp_lbl_${variableName}`;

  lines.push(
    "",
    `${labelVariable} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabelVariable} = ${labelVariable} if ${labelVariable} is not None else ${pythonString(properties.label)}`,
    `${variableName} = st.slider(`,
    `    label=${displayLabelVariable},`,
  );

  appendOptionalSliderNumber(lines, "min_value", properties.minValue);
  appendOptionalSliderNumber(lines, "max_value", properties.maxValue);

  if (properties.ranged) {
    if (properties.defaultValue === null || properties.upperValue === null) {
      throw invalidSlider("Ranged Slider requires both range endpoints.");
    }

    lines.push(
      `    value=(${formatPythonNumber(properties.defaultValue)}, ${formatPythonNumber(properties.upperValue)}),`,
    );
  } else {
    appendOptionalSliderNumber(lines, "value", properties.defaultValue);
  }

  appendOptionalSliderNumber(lines, "step", properties.step);
  lines.push(`    disabled=${properties.disabled ? "True" : "False"},`);

  if (properties.help !== "") {
    lines.push(`    help=${pythonString(properties.help)},`);
  }

  if (properties.format !== "") {
    lines.push(`    format=${pythonString(properties.format)},`);
  }

  appendWorkflowCallbackArguments(lines, component.key, workflowEventKey);
  lines.push(`    key=${pythonString(variableName)}`, ")");
}

export function appendLabel(
  lines: string[],
  component: ProjectComponent,
  properties: LabelProperties,
  variableName: string,
): void {
  validateSimpleComponentShape(component, "Label", invalidLabel);

  const codeName = component.codeName?.trim() || component.key;
  const labelVariable = `_vdab_lbl_${variableName}`;
  const displayLabelVariable = `_vdab_disp_lbl_${variableName}`;
  const fontSize = LABEL_FONT_SIZES.get(properties.fontSize);
  if (fontSize === undefined) {
    throw invalidLabel("Label font size is not supported.");
  }

  const fontWeight = properties.bold ? "bold" : "normal";
  lines.push(
    "",
    `${labelVariable} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabelVariable} = ${labelVariable} if ${labelVariable} is not None else ${pythonString(properties.text)}`,
    "st.markdown(",
    `    f'<p style=\"font-size: ${fontSize}; font-weight: ${fontWeight}; margin: 0;\">{html.escape(str(${displayLabelVariable}))}</p>',`,
    "    unsafe_allow_html=True,",
    ")",
  );
}

export function appendOptionalSliderNumber(
  lines: string[],
  name: string,
  value: number | null,
): void {
  if (value !== null) {
    lines.push(`    ${name}=${formatPythonNumber(value)},`);
  }
}

export function validateSimpleComponentShape(
  component: ProjectComponent,
  componentType: "TextInput" | "Button" | "Checkbox" | "Toggle" | "Dropdown" | "DatePicker" | "TimePicker" | "Slider" | "Label",
  invalid: (detail: string) => ApplicationError,
): void {
  if (component.schemaVersion !== 1) {
    throw invalid(`The ${componentType} schema version is not supported.`);
  }

  if (component.bindings !== null && Object.keys(component.bindings).length > 0) {
    throw invalid(`${componentType} does not support resource bindings.`);
  }

  if (component.children.length > 0 || component.layout !== null) {
    throw invalid(`${componentType} cannot contain child components or layout.`);
  }
}
