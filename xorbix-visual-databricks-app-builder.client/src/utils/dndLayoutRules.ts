import { ComponentType } from "../types/components/componentTypes";

export function getLayoutDropError(
  layoutType: ComponentType,
  draggedType: ComponentType,
): string | null {
  if (layoutType === ComponentType.Form) {
    if (draggedType === ComponentType.Form) {
      return "Forms cannot be nested inside other forms due to Streamlit limitations.";
    }
    if (draggedType === ComponentType.Button) {
      return "Buttons cannot be placed inside forms due to Streamlit limitations. The only button allowed is the submit button.";
    }
  }

  if (
    layoutType === ComponentType.Columns ||
    layoutType === ComponentType.Rows
  ) {
    if (
      draggedType === ComponentType.Columns ||
      draggedType === ComponentType.Rows ||
      draggedType === ComponentType.Form
    ) {
      return "Layout components cannot be nested inside other layout components due to Streamlit limitations.";
    }
  }

  return null;
}

