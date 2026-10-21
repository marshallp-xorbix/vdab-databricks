import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const DEFAULT_HEIGHT_PIXELS = 600;
const MIN_HEIGHT_PIXELS = 300;
const MAX_HEIGHT_PIXELS = 2000;
const MAX_TITLE_LENGTH = 500;
const SERVING_ENDPOINT_NAME_PATTERN = /^[A-Za-z0-9_-]{1,63}$/;
const MODEL_CHAT_PROPERTY_NAMES = [
  "servingEndpointName",
  "title",
  "showBorder",
  "chatTotalHeightPixels",
];

export interface ModelChatProperties {
  servingEndpointName: string;
  title: string;
  showBorder: boolean;
  chatTotalHeightPixels: number;
}

/** Normalizes ModelChat defaults and rejects external authority fields. */
export function normalizeModelChatProperties(value: ProjectJsonObject): ProjectJsonObject {
  const properties = readProperties(value, invalidComponents);
  return {
    servingEndpointName: properties.servingEndpointName,
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
  if (!isRecord(value) || hasUnexpectedProperties(value, MODEL_CHAT_PROPERTY_NAMES)) {
    return invalid("ModelChat contains an unsupported component property.");
  }

  const servingEndpointName = value.servingEndpointName ?? "";
  if (
    typeof servingEndpointName !== "string" ||
    (servingEndpointName !== "" && !SERVING_ENDPOINT_NAME_PATTERN.test(servingEndpointName))
  ) {
    return invalid("Select a valid serving endpoint from the current workspace.");
  }

  const title = value.title === undefined ? "Model Chat" : value.title;
  if (
    typeof title !== "string" ||
    title.trim() !== title ||
    title.length < 1 ||
    title.length > MAX_TITLE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(title)
  ) {
    return invalid("ModelChat title must be a non-empty string of at most 500 characters.");
  }

  const showBorder = value.showBorder === undefined ? false : value.showBorder;
  if (typeof showBorder !== "boolean") {
    return invalid("ModelChat border setting must be a boolean.");
  }

  const chatTotalHeightPixels = value.chatTotalHeightPixels === undefined
    ? DEFAULT_HEIGHT_PIXELS
    : value.chatTotalHeightPixels;
  if (
    typeof chatTotalHeightPixels !== "number" ||
    !Number.isSafeInteger(chatTotalHeightPixels) ||
    chatTotalHeightPixels < MIN_HEIGHT_PIXELS ||
    chatTotalHeightPixels > MAX_HEIGHT_PIXELS
  ) {
    return invalid(`ModelChat height must be an integer from ${MIN_HEIGHT_PIXELS} to ${MAX_HEIGHT_PIXELS} pixels.`);
  }

  return { servingEndpointName, title, showBorder, chatTotalHeightPixels };
}
