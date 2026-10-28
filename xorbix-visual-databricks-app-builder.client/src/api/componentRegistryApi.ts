import {
  ComponentRegistry,
  type ComponentCategory,
  type ComponentBindingType,
  type IBindingSchema,
  type IComponentDefinition,
  type IComponentRegistry,
} from "../models/ComponentRegistry";
import type { ProjectJsonObject } from "../models/ProjectComponents";

const COMPONENT_DEFINITIONS_PATH = "/api/v1/component-definitions";
const COMPONENT_CATEGORIES: ComponentCategory[] = [
  "Controls",
  "Layout",
  "Data",
  "Page",
  "Visualization",
];
const COMPONENT_BINDING_TYPES: ComponentBindingType[] = [
  "unityCatalogTable",
  "databricksVolume",
  "lakebaseProvisionedDatabase",
  "lakebaseAutoscaling",
];

/** Loads component metadata from the standalone registry, not the SaaS API. */
export async function getComponentRegistry(
  signal?: AbortSignal,
): Promise<IComponentRegistry> {
  const response = await fetch(COMPONENT_DEFINITIONS_PATH, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseRegistry(await response.json());
}

function parseRegistry(value: unknown): IComponentRegistry {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.components) ||
    !Array.isArray(value.bindingSchemas)
  ) {
    throw new Error("The component registry returned an invalid response.");
  }

  const components = value.components.map(parseDefinition);
  const types = new Set(components.map((definition) => definition.type));
  if (types.size !== components.length) {
    throw new Error("The component registry returned duplicate component types.");
  }

  const bindingSchemas = value.bindingSchemas.map(parseBindingSchema);
  const bindingTypes = new Set(bindingSchemas.map((schema) => schema.type));
  if (bindingTypes.size !== bindingSchemas.length) {
    throw new Error("The component registry returned duplicate binding types.");
  }

  return new ComponentRegistry({ version: 1, components, bindingSchemas });
}

function parseBindingSchema(value: unknown): IBindingSchema {
  if (
    !isRecord(value) ||
    !isOneOf(value.type, COMPONENT_BINDING_TYPES) ||
    typeof value.label !== "string" ||
    value.label.trim().length === 0 ||
    typeof value.editorType !== "string" ||
    value.editorType.trim().length === 0 ||
    !isJsonObject(value.defaultConfig)
  ) {
    throw new Error("The component registry returned an invalid binding schema.");
  }

  return {
    type: value.type,
    label: value.label,
    editorType: value.editorType,
    defaultConfig: value.defaultConfig,
  };
}

function parseDefinition(value: unknown): IComponentDefinition {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.codeName !== "string" ||
    typeof value.type !== "string" ||
    !isOneOf(value.category, COMPONENT_CATEGORIES) ||
    typeof value.icon !== "string" ||
    value.layout !== null ||
    value.schemaVersion !== 1 ||
    value.bindings !== null ||
    !isNullableBindingTypes(value.supportedBindings) ||
    !isNullableStringArray(value.supportedEvents) ||
    !isNullableStringArray(value.children) ||
    !isJsonObject(value.props)
  ) {
    throw new Error("The component registry returned an invalid definition.");
  }

  return {
    id: value.id,
    codeName: value.codeName,
    type: value.type,
    category: value.category,
    icon: value.icon,
    layout: null,
    schemaVersion: 1,
    bindings: null,
    supportedBindings: value.supportedBindings,
    supportedEvents: value.supportedEvents,
    children: value.children,
    props: value.props,
  };
}

function isNullableBindingTypes(value: unknown): value is ComponentBindingType[] | null {
  return value === null || (Array.isArray(value) && value.every(
    (entry) => isOneOf(entry, COMPONENT_BINDING_TYPES),
  ));
}

function isNullableStringArray(value: unknown): value is string[] | null {
  return value === null || (Array.isArray(value) && value.every(
    (entry) => typeof entry === "string",
  ));
}

function isJsonObject(value: unknown): value is ProjectJsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value);
}

function isOneOf<const Value extends string>(
  value: unknown,
  options: readonly Value[],
): value is Value {
  return typeof value === "string" && options.includes(value as Value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const responseBody: unknown = await response.json();
    if (isRecord(responseBody) && typeof responseBody.detail === "string") {
      return responseBody.detail;
    }
    if (isRecord(responseBody) && typeof responseBody.title === "string") {
      return responseBody.title;
    }
  } catch {
    // Fall back to the status if a response is not a problem document.
  }
  return `The component registry request failed (HTTP ${response.status}).`;
}
