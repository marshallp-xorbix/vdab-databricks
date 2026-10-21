export interface TextInputProperties {
  label: string;
  placeholder: string;
  defaultValue: string;
  help: string;
  disabled: boolean;
  type: "default" | "password";
  multiline: boolean;
  height: string;
}

export interface ButtonProperties {
  label: string;
  variant: "primary" | "secondary" | "";
  disabled: boolean;
  help: string;
}

export interface BooleanControlProperties {
  label: string;
  defaultValue: boolean;
  help: string;
  disabled: boolean;
}

export interface DropdownProperties {
  label: string;
  options: string[];
  defaultValue: string;
  disabled: boolean;
  help: string;
  placeholder: string;
  multiselect: boolean;
}

export interface DatePickerProperties {
  label: string;
  defaultValue: string;
  minDate: string;
  maxDate: string;
  format: string;
  help: string;
  disabled: boolean;
}

export interface TimePickerProperties {
  label: string;
  defaultValue: string;
  step: number | null;
  help: string;
  disabled: boolean;
}

export interface SliderProperties {
  label: string;
  minValue: number | null;
  maxValue: number | null;
  defaultValue: number | null;
  upperValue: number | null;
  step: number | null;
  disabled: boolean;
  help: string;
  format: string;
  ranged: boolean;
}

export interface LabelProperties {
  text: string;
  fontSize: "small" | "medium" | "large";
  bold: boolean;
}

export interface ExpanderProperties {
  sectionTitle: string;
  defaultExpanded: boolean;
}

export interface ColumnsProperties {
  columnCount: number;
}

export interface RowsProperties {
  rowCount: number;
}

export interface TabsProperties {
  tabNames: string[];
  defaultTabIndex: number;
}

export interface TabsChildPosition {
  tabIndex: number;
  y: number;
}

export interface FormProperties {
  submitButtonText: string;
  clearOnSubmit: boolean;
  enterToSubmit: boolean;
  border: boolean;
  width: string | number;
  height: string | number;
}

export interface ModalProperties {
  title: string;
  width: "small" | "medium" | "large";
  position: "center" | "left" | "right";
  dismissible: boolean;
}

/** Generates deterministic preview source for supported project components. */
