import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const DEFAULT_HEIGHT_PIXELS = 600;
const MIN_HEIGHT_PIXELS = 300;
const MAX_HEIGHT_PIXELS = 2000;
const MAX_TITLE_LENGTH = 500;
const MAX_RESOURCE_NAME_LENGTH = 63;
const APP_RESOURCE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,62}$/;
const invalidComponentAggregate = (_detail: string): Error => invalidComponents();

export interface GenieChatProperties {
  genieSpaceAppResourceName: string;
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
    genieSpaceAppResourceName: properties.genieSpaceAppResourceName,
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
    "genieSpaceAppResourceName",
    "title",
    "showBorder",
    "chatTotalHeightPixels",
    // Legacy keys accepted only so normalize can drop them via unexpected check failure;
    // migrateLegacyProperties strips them before validation on import paths.
  ])) {
    // Allow legacy keys during migration by stripping first.
    const migrated = migrateLegacyGenieProperties(value);
    if (
      !isRecord(migrated) ||
      hasUnexpectedProperties(migrated, [
        "genieSpaceAppResourceName",
        "title",
        "showBorder",
        "chatTotalHeightPixels",
      ])
    ) {
      return invalid("GenieChat contains an unsupported component property.");
    }
    return readNormalizedProperties(migrated, invalid);
  }

  return readNormalizedProperties(value, invalid);
}

function readNormalizedProperties(
  value: Record<string, unknown>,
  invalid: (detail: string) => never,
): GenieChatProperties {
  const genieSpaceAppResourceName = readResourceName(
    value.genieSpaceAppResourceName,
    invalid,
  );

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
    genieSpaceAppResourceName,
    title,
    showBorder,
    chatTotalHeightPixels,
  };
}

/** Drops legacy workspace-space ID fields when migrating older saved components. */
export function migrateLegacyGenieProperties(value: unknown): ProjectJsonObject {
  if (!isRecord(value)) return {};
  const {
    genieSpaceId: _legacyId,
    genieSpaceTitle: _legacyTitle,
    ...rest
  } = value;
  const resourceName =
    typeof rest.genieSpaceAppResourceName === "string"
      ? rest.genieSpaceAppResourceName
      : "";
  return {
    ...rest,
    genieSpaceAppResourceName: resourceName,
  };
}

function readResourceName(
  value: unknown,
  invalid: (detail: string) => never,
): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (
    typeof value !== "string" ||
    value.length > MAX_RESOURCE_NAME_LENGTH ||
    !APP_RESOURCE_NAME_PATTERN.test(value)
  ) {
    return invalid(
      "GenieChat requires a valid Genie space app resource name from App Settings.",
    );
  }
  return value;
}
