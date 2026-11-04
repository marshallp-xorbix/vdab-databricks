import type { VdabComponent } from "../../types/components";
import { ComponentType } from "../../types/components/componentTypes";

// Keep in sync with ComponentHeightBounds in Xorbix-Visual-Databricks-App-Builder.Models/Constants.cs
export const HEIGHT_PIXELS_MIN = 300;
export const HEIGHT_PIXELS_MAX = 2000;
export const HEIGHT_PIXELS_DEFAULT = 600;

function clampHeightPixels(value: number): number {
  return Math.min(HEIGHT_PIXELS_MAX, Math.max(HEIGHT_PIXELS_MIN, value));
}

function parseHeightPixels(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      return null;
    }

    const parsedValue = Number(trimmedValue);
    if (Number.isFinite(parsedValue)) {
      return Math.round(parsedValue);
    }
  }

  return null;
}

export function normalizeHeightPixelsValue(value: unknown): number {
  return clampHeightPixels(parseHeightPixels(value) ?? HEIGHT_PIXELS_DEFAULT);
}

export function normalizeComponentHeightPixels(
  component: VdabComponent,
): VdabComponent {
  if (component.type === ComponentType.DashboardEmbed) {
    return {
      ...component,
      props: {
        ...component.props,
        height: normalizeHeightPixelsValue(component.props.height),
      },
    };
  }

  if (
    component.type === ComponentType.GenieChat ||
    component.type === ComponentType.ModelChat
  ) {
    return {
      ...component,
      props: {
        ...component.props,
        chatTotalHeightPixels: normalizeHeightPixelsValue(
          component.props.chatTotalHeightPixels,
        ),
      },
    };
  }

  return component;
}

export function normalizeComponentsHeightPixels(
  components: VdabComponent[],
): VdabComponent[] {
  return components.map((component) => normalizeComponentHeightPixels(component));
}
