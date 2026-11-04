import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const DEFAULT_HEIGHT_PIXELS = 600;
const MIN_HEIGHT_PIXELS = 300;
const MAX_HEIGHT_PIXELS = 2000;
const MAX_TITLE_LENGTH = 500;
const MAX_SPACE_TITLE_LENGTH = 512;
const SPACE_ID_PATTERN = /^(?:[A-Fa-f0-9]{32}|[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12})$/;
const invalidComponentAggregate = (_detail: string): Error => invalidComponents();

export interface GenieChatProperties {
  genieSpaceId: string;
  genieSpaceTitle: string;
  title: string;
  showBorder: boolean;
  chatTotalHeightPixels: number;
}

/** Normalizes GenieChat defaults while rejecting workspace authority and secrets. */
export function normalizeGenieChatProperties(
  value: ProjectJsonObject,
): ProjectJsonObject {
  const properties = readProperties(value, invalidComponentAggregate);
  return {
    genieSpaceId: properties.genieSpaceId,
    genieSpaceTitle: properties.genieSpaceTitle,
    title: properties.title,
    showBorder: properties.showBorder,
    chatTotalHeightPixels: properties.chatTotalHeightPixels,
  };
}

/** Validates persisted GenieChat properties during save and import. */
export function validateGenieChatProperties(value: ProjectJsonObject): void {
  readProperties(value, invalidComponentAggregate);
}

/** Reads saved GenieChat properties before deterministic Python generation. */
export function readGenieChatProperties(
  value: unknown,
  errorFactory: ErrorFactory = invalidComponentAggregate,
): GenieChatProperties {
  return readProperties(value, errorFactory);
}

type ErrorFactory = (detail: string) => Error;

function readProperties(value: unknown, errorFactory: ErrorFactory): GenieChatProperties {
  const invalid = (detail: string): never => {
    throw errorFactory(detail);
  };

  if (!isRecord(value) || hasUnexpectedProperties(value, [
    "genieSpaceId",
    "genieSpaceTitle",
    "title",
    "showBorder",
    "chatTotalHeightPixels",
  ])) {
    return invalid("GenieChat contains an unsupported component property.");
  }

  const genieSpaceId = readSpaceId(value.genieSpaceId, invalid);
  const genieSpaceTitle = readSpaceTitle(value.genieSpaceTitle, invalid);
  if ((genieSpaceId === "") !== (genieSpaceTitle === "")) {
    return invalid("Select a Genie space with a valid ID and title.");
  }

  const title = value.title === undefined ? "Genie Chat" : value.title;
  if (
    typeof title !== "string" ||
    title.trim() !== title ||
    title.length < 1 ||
    title.length > MAX_TITLE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(title)
  ) {
    return invalid("GenieChat title must be a non-empty string of at most 500 characters.");
  }

  const showBorder = value.showBorder === undefined ? false : value.showBorder;
  if (typeof showBorder !== "boolean") {
    return invalid("GenieChat border setting must be a boolean.");
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
    return invalid(`GenieChat height must be an integer from ${MIN_HEIGHT_PIXELS} to ${MAX_HEIGHT_PIXELS} pixels.`);
  }

  return {
    genieSpaceId,
    genieSpaceTitle,
    title,
    showBorder,
    chatTotalHeightPixels,
  };
}

function readSpaceId(value: unknown, invalid: (detail: string) => never): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (typeof value !== "string" || !SPACE_ID_PATTERN.test(value)) {
    return invalid("GenieChat requires a valid Genie space ID from the current workspace.");
  }
  return value;
}

function readSpaceTitle(value: unknown, invalid: (detail: string) => never): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length > MAX_SPACE_TITLE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return invalid("GenieChat requires a valid Genie space title from the current workspace.");
  }
  return value;
}
