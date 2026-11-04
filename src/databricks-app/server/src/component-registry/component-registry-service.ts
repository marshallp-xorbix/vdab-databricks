import { ApplicationError } from "../application-error.ts";
import { PROJECT_COMPONENT_TYPES } from "../db/project-components-contract.ts";
import { BINDING_SCHEMAS } from "./binding-schemas.ts";
import { COMPONENT_DEFINITIONS } from "./component-definitions.ts";
import type {
  ComponentBindingType,
  ComponentCategory,
  ComponentDefinition,
  ComponentRegistryResponse,
} from "./contracts.ts";

const REGISTRY_VERSION = 1;
const COMPONENT_CATEGORIES: ComponentCategory[] = [
  "Controls",
  "Layout",
  "Data",
  "Page",
  "Visualization",
];
const AUTHORITY_FIELD_PATTERN =
  /workspace(?:host|url|id|origin)?|databricks(?:host|url|workspace(?:id|url)?)|connection(?:id)?|tenant(?:id)?|(?:access|refresh)?token|secret|password|credential/i;
const EXTERNAL_URL_PATTERN = /\bhttps?:\/\//i;
const BINDING_TYPES = [
  "unityCatalogTable",
  "databricksVolume",
  "lakebaseProvisionedDatabase",
  "lakebaseAutoscaling",
] as const;

/** Stateless access to the safe, install-independent component catalog. */
export class ComponentRegistryService {
  /** Returns a fresh copy of the full, validated catalog. */
  getRegistry(): ComponentRegistryResponse {
    return structuredClone(
      validateComponentRegistry({
        components: COMPONENT_DEFINITIONS,
        bindingSchemas: BINDING_SCHEMAS,
        version: REGISTRY_VERSION,
      }),
    );
  }

  /** Returns one definition or a sanitized not-found error. */
  getDefinition(type: string): ComponentDefinition {
    const definition = this.getRegistry().components.find(
      (component) => component.type === type,
    );

    if (!definition) {
      throw new ApplicationError(
        404,
        "component_definition_not_found",
        "Component definition not found",
        "The requested component definition does not exist.",
      );
    }

    return definition;
  }
}

/** Validates the catalog shape and rejects workspace or credential authority. */
export function validateComponentRegistry(
  value: unknown,
): ComponentRegistryResponse {
  if (
    !isRecord(value) ||
    value.version !== REGISTRY_VERSION ||
    !Array.isArray(value.components) ||
    value.components.length !== PROJECT_COMPONENT_TYPES.length ||
    !Array.isArray(value.bindingSchemas) ||
    value.bindingSchemas.length !== 4
  ) {
    throw invalidRegistry();
  }

  const componentTypes = new Set<string>();

  for (const component of value.components) {
    if (!isRecord(component)) {
      throw invalidRegistry();
    }

    if (
      typeof component.type !== "string" ||
      !PROJECT_COMPONENT_TYPES.includes(
        component.type as (typeof PROJECT_COMPONENT_TYPES)[number],
      ) ||
      componentTypes.has(component.type) ||
      typeof component.id !== "string" ||
      typeof component.codeName !== "string" ||
      typeof component.icon !== "string" ||
      !COMPONENT_CATEGORIES.includes(component.category as ComponentCategory) ||
      component.schemaVersion !== 1 ||
      component.layout !== null ||
      component.bindings !== null ||
      !isBindingArrayOrNull(component.supportedBindings) ||
      !isStringArrayOrNull(component.supportedEvents) ||
      !isStringArrayOrNull(component.children) ||
      !isRecord(component.props)
    ) {
      throw invalidRegistry();
    }

    componentTypes.add(component.type);
  }

  if (componentTypes.size !== PROJECT_COMPONENT_TYPES.length) {
    throw invalidRegistry();
  }

  const bindingTypes = new Set<string>();

  for (const binding of value.bindingSchemas) {
    if (
      !isRecord(binding) ||
      typeof binding.type !== "string" ||
      !BINDING_TYPES.includes(binding.type as (typeof BINDING_TYPES)[number]) ||
      bindingTypes.has(binding.type) ||
      typeof binding.label !== "string" ||
      typeof binding.editorType !== "string" ||
      !isRecord(binding.defaultConfig)
    ) {
      throw invalidRegistry();
    }

    bindingTypes.add(binding.type);
  }

  if (bindingTypes.size !== value.bindingSchemas.length) {
    throw invalidRegistry();
  }

  assertNoAuthority(value);
  return value as unknown as ComponentRegistryResponse;
}

function assertNoAuthority(value: unknown): void {
  if (Array.isArray(value)) {
    for (const nestedValue of value) {
      assertNoAuthority(nestedValue);
    }

    return;
  }

  if (typeof value === "string") {
    if (EXTERNAL_URL_PATTERN.test(value)) {
      throw invalidRegistry();
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "");

    if (AUTHORITY_FIELD_PATTERN.test(normalizedKey)) {
      throw invalidRegistry();
    }

    assertNoAuthority(nestedValue);
  }
}

function isBindingArrayOrNull(value: unknown): value is ComponentBindingType[] | null {
  return (
    value === null ||
    (Array.isArray(value) &&
      value.every(
        (entry: unknown) =>
          typeof entry === "string" &&
          BINDING_TYPES.includes(entry as (typeof BINDING_TYPES)[number]),
      ))
  );
}

function isStringArrayOrNull(value: unknown): value is string[] | null {
  return (
    value === null ||
    (Array.isArray(value) &&
      value.every((entry: unknown) => typeof entry === "string"))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidRegistry(): ApplicationError {
  return new ApplicationError(
    500,
    "component_registry_invalid",
    "Component registry unavailable",
    "The component registry could not be validated.",
  );
}
