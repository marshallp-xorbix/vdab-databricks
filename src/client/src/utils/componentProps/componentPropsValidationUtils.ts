import type { VdabComponent } from "../../types/components";
import { ComponentType } from "../../types/components/componentTypes";
import { getLabelInputValidationError } from "./labelUtils";
import {
  getDropdownOptionsInputValidationError,
  getMultiselectValidationError,
} from "./dropdownUtils";
import {
  getTextInputHeightValidationError,
  getTextInputTypeValidationError,
} from "./textInputUtils";
import { getCheckboxDefaultCheckedValidationError } from "./checkboxUtils";
import { getToggleDefaultValueValidationError } from "./toggleUtils";
import {
  getSliderRangedValidationError,
  getSliderMinValidationError,
  getSliderMaxValidationError,
  getSliderStepValidationError,
  getSliderDefaultValueValidationError,
  getSliderUpperValueValidationError,
  getSliderFormatValidationError,
} from "./sliderUtils";
import {
  getDatePickerDefaultValueValidationError,
  getDatePickerMinDateValidationError,
  getDatePickerMaxDateValidationError,
  getDatePickerFormatValidationError,
} from "./datePickerUtils";
import {
  getTimePickerDefaultValueValidationError,
  getTimePickerStepValidationError,
} from "./timePickerUtils";

export const getComponentPropertyValidationError = (
  component: VdabComponent,
  key: string,
  value: unknown,
): string | undefined => {
  if (key === "label") {
    return getLabelInputValidationError(String(value ?? ""));
  }

  if (component.type === ComponentType.Dropdown) {
    if (key === "options") {
      return getDropdownOptionsInputValidationError(value);
    }

    if (key === "multiselect") {
      return getMultiselectValidationError(value);
    }
  }

  if (component.type === ComponentType.Checkbox && key === "defaultChecked") {
    return getCheckboxDefaultCheckedValidationError(component);
  }

  if (component.type === ComponentType.Toggle && key === "defaultValue") {
    return getToggleDefaultValueValidationError(value);
  }

  if (component.type === ComponentType.TextInput) {
    if (key === "height") {
      return getTextInputHeightValidationError(value);
    }
    if (key === "type") {
      return getTextInputTypeValidationError(value);
    }
  }

  if (component.type === ComponentType.Slider) {
    if (key === "ranged") {
      return getSliderRangedValidationError(value);
    }
    if (key === "minValue") {
      return getSliderMinValidationError(component);
    }
    if (key === "maxValue") {
      return getSliderMaxValidationError(component);
    }
    if (key === "step") {
      return getSliderStepValidationError(component);
    }
    if (key === "defaultValue") {
      return getSliderDefaultValueValidationError(component);
    }
    if (component.props.ranged) {
      if (key === "upperValue") {
        return getSliderUpperValueValidationError(component);
      }
    }
    if (key === "format") {
      return getSliderFormatValidationError(value);
    }
  }

  if (component.type === ComponentType.DatePicker) {
    if (key === "defaultValue") {
      return getDatePickerDefaultValueValidationError(component);
    }
    if (key === "minDate") {
      return getDatePickerMinDateValidationError(component);
    }
    if (key === "maxDate") {
      return getDatePickerMaxDateValidationError(component);
    }
    if (key === "format") {
      return getDatePickerFormatValidationError(value);
    }
  }

  if (component.type === ComponentType.TimePicker) {
    if (key === "defaultValue") {
      return getTimePickerDefaultValueValidationError(component);
    }
    if (key === "step") {
      return getTimePickerStepValidationError(value);
    }
  }
  return undefined;
};

export const getComponentPropertyErrors = (
  component: VdabComponent,
): Record<string, string | undefined> => {
  const props = component.props || {};
  return Object.entries(props).reduce(
    (errors: Record<string, string | undefined>, [key, value]) => {
      const error = getComponentPropertyValidationError(component, key, value);
      if (error) {
        errors[key] = error;
      }
      return errors;
    },
    {},
  );
};
