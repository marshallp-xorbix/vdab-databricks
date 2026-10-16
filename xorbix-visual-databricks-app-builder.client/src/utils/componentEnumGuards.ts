import type { VdabComponent } from "../types/components";
import {
  ComponentCategory,
  ComponentType,
} from "../types/components/componentTypes";

const COMPONENT_TYPE_VALUES = new Set<string>(
  Object.values(ComponentType) as string[],
);

const COMPONENT_CATEGORY_VALUES = new Set<string>(
  Object.values(ComponentCategory) as string[],
);

function normalizeEnumMemberName(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Maps API JSON enum strings (camelCase from ASP.NET Core
 * <c>JsonStringEnumConverter(JsonNamingPolicy.CamelCase)</c>) to the canonical
 * PascalCase literals used in this client.
 */
export function toCanonicalComponentType(
  value: string,
): ComponentType | null {
  if (COMPONENT_TYPE_VALUES.has(value)) {
    return value as ComponentType;
  }
  const normalized = normalizeEnumMemberName(value);
  if (COMPONENT_TYPE_VALUES.has(normalized)) {
    return normalized as ComponentType;
  }
  return null;
}

export function toCanonicalComponentCategory(
  value: string,
): ComponentCategory | null {
  if (COMPONENT_CATEGORY_VALUES.has(value)) {
    return value as ComponentCategory;
  }
  const normalized = normalizeEnumMemberName(value);
  if (COMPONENT_CATEGORY_VALUES.has(normalized)) {
    return normalized as ComponentCategory;
  }
  return null;
}

export function isComponentType(value: string): value is ComponentType {
  return toCanonicalComponentType(value) !== null;
}

export function isComponentCategory(value: string): value is ComponentCategory {
  return toCanonicalComponentCategory(value) !== null;
}

/**
 * Ensures {@link VdabComponent} {@code type} / {@code category} match frontend
 * literals after registry or app payloads are deserialized from the API.
 */
export function normalizeVdabComponentEnums(
  component: VdabComponent,
): VdabComponent {
  const type = toCanonicalComponentType(String(component.type));
  const category = toCanonicalComponentCategory(String(component.category));
  return {
    ...component,
    ...(type ? { type } : {}),
    ...(category ? { category } : {}),
  };
}
