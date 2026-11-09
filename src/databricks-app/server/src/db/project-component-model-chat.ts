import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const DEFAULT_HEIGHT_PIXELS = 600;
const MIN_HEIGHT_PIXELS = 300;
const MAX_HEIGHT_PIXELS = 2000;
const MAX_TITLE_LENGTH = 500;
const MAX_RESOURCE_NAME_LENGTH = 63;
const APP_RESOURCE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,62}$/;
const MODEL_CHAT_PROPERTY_NAMES = [
  "servingEndpointAppResourceName",
  "title",
  "showBorder",
  "chatTotalHeightPixels",
];

export interface ModelChatProperties {
  servingEndpointAppResourceName: string;
  title: string;
  showBorder: boolean;
  chatTotalHeightPixels: number;
}

/** Normalizes ModelChat defaults and rejects external authority fields. */
export function normalizeModelChatProperties(value: ProjectJsonObject): ProjectJsonObject {
  const properties = readProperties(value, invalidComponents);
  return {
    servingEndpointAppResourceName: properties.servingEndpointAppResourceName,
    title: properties.title,
    showBorder: properties.showBorder,
    chatTotalHeightPixels: properties.chatTotalHeightPixels,
  };
}

/** Validates ModelChat properties at the save and import boundary. */
export function validateModelChatProperties(value: ProjectJsonObject): void {
  readProperties(value, invalidComponents);
}

/** Reads validated settings before deterministic Python generation. */
export function readModelChatProperties(
  value: unknown,
  errorFactory: (detail: string) => Error = () => invalidComponents(),
): ModelChatProperties {
  return readProperties(value, errorFactory);
}

function readProperties(
  value: unknown,
  errorFactory: (detail: string) => Error,
): ModelChatProperties {
  const invalid = (detail: string): never => {
    throw errorFactory(detail);
  };
  const migrated = migrateLegacyModelChatProperties(value);
  if (!isRecord(migrated) || hasUnexpectedProperties(migrated, MODEL_CHAT_PROPERTY_NAMES)) {
    return invalid("ModelChat contains an unsupported component property.");
  }

  const servingEndpointAppResourceName = migrated.servingEndpointAppResourceName ?? "";
  if (
    typeof servingEndpointAppResourceName !== "string" ||
    (servingEndpointAppResourceName !== "" &&
      (servingEndpointAppResourceName.length > MAX_RESOURCE_NAME_LENGTH ||
        !APP_RESOURCE_NAME_PATTERN.test(servingEndpointAppResourceName)))
  ) {
    return invalid("Select a valid serving endpoint app resource from App Settings.");
  }

  const title = migrated.title === undefined ? "Model Chat" : migrated.title;
  if (
    typeof title !== "string" ||
    title.trim() !== title ||
    title.length < 1 ||
    title.length > MAX_TITLE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(title)
  ) {
    return invalid("ModelChat title must be a non-empty string of at most 500 characters.");
  }

  const showBorder = migrated.showBorder === undefined ? false : migrated.showBorder;
  if (typeof showBorder !== "boolean") {
    return invalid("ModelChat border setting must be a boolean.");
  }

  const chatTotalHeightPixels = migrated.chatTotalHeightPixels === undefined
    ? DEFAULT_HEIGHT_PIXELS
    : migrated.chatTotalHeightPixels;
  if (
    typeof chatTotalHeightPixels !== "number" ||
    !Number.isSafeInteger(chatTotalHeightPixels) ||
    chatTotalHeightPixels < MIN_HEIGHT_PIXELS ||
    chatTotalHeightPixels > MAX_HEIGHT_PIXELS
  ) {
    return invalid(`ModelChat height must be an integer from ${MIN_HEIGHT_PIXELS} to ${MAX_HEIGHT_PIXELS} pixels.`);
  }

  return {
    servingEndpointAppResourceName,
    title,
    showBorder,
    chatTotalHeightPixels,
  };
}

/** Drops legacy endpoint-name binding fields when migrating older saved components. */
export function migrateLegacyModelChatProperties(value: unknown): ProjectJsonObject {
  if (!isRecord(value)) return {};
  const { servingEndpointName: _legacyEndpoint, ...rest } = value;
  const resourceName =
    typeof rest.servingEndpointAppResourceName === "string"
      ? rest.servingEndpointAppResourceName
      : "";
  return {
    ...rest,
    servingEndpointAppResourceName: resourceName,
  };
}
