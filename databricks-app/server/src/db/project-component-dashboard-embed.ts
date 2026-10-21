import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const DEFAULT_HEIGHT_PIXELS = 600;
const MIN_HEIGHT_PIXELS = 300;
const MAX_HEIGHT_PIXELS = 2000;
const MAX_REFERENCE_LENGTH = 4096;
const DASHBOARD_EMBED_PATH = /^\/embed\/dashboardsv3\/[A-Za-z0-9_-]{1,128}$/;
const WIDGET_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}~[A-Za-z0-9_-]{1,128}$/;
const invalidComponentAggregate = (_detail: string): Error => invalidComponents();

export interface DashboardEmbedProperties {
  src: string;
  height: number;
  scrolling: boolean;
}

/** Normalizes a pasted URL to a hostless current-workspace embed reference. */
export function normalizeDashboardEmbedProperties(
  value: ProjectJsonObject,
): ProjectJsonObject {
  const properties = readProperties(value, invalidComponentAggregate);
  return {
    src: properties.src,
    height: properties.height,
    scrolling: properties.scrolling,
  };
}

/** Validates persisted properties and removes all submitted workspace authority. */
export function validateDashboardEmbedProperties(value: ProjectJsonObject): void {
  readProperties(value, invalidComponentAggregate);
}

/** Parses saved properties again before source generation. */
export function readDashboardEmbedProperties(
  value: unknown,
  errorFactory: ErrorFactory = invalidComponentAggregate,
): DashboardEmbedProperties {
  return readProperties(value, errorFactory);
}

type ErrorFactory = (detail: string) => Error;

function readProperties(
  value: unknown,
  errorFactory: ErrorFactory,
): DashboardEmbedProperties {
  const invalid = (detail: string): never => {
    throw errorFactory(detail);
  };
  if (!isRecord(value) || hasUnexpectedProperties(value, ["src", "height", "scrolling"])) {
    return invalid("DashboardEmbed contains an unsupported component property.");
  }

  const src = normalizeDashboardEmbedReference(value.src, invalid);
  const height = readHeight(value.height, invalid);
  const scrolling = readScrolling(value.scrolling, invalid);
  return { src, height, scrolling };
}

function normalizeDashboardEmbedReference(
  value: unknown,
  invalid: (detail: string) => never,
): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string" || value.length > MAX_REFERENCE_LENGTH) {
    return invalid("Dashboard embed reference is invalid or too long.");
  }

  const reference = value.trim();
  if (reference === "") {
    return "";
  }
  if (reference.startsWith("//")) {
    return invalid("Dashboard embed references must not select a workspace host.");
  }

  const absolute = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(reference);
  let parsedUrl: URL;
  try {
    parsedUrl = absolute
      ? new URL(reference)
      : new URL(reference, "https://vdab.invalid");
  } catch {
    return invalid("Dashboard embed URL is invalid.");
  }

  if (
    (absolute && parsedUrl.protocol !== "https:") ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.hash !== ""
  ) {
    return invalid("Dashboard embed URLs must use HTTPS without credentials or fragments.");
  }

  const path = parsedUrl.pathname;
  if (!DASHBOARD_EMBED_PATH.test(path)) {
    return invalid("Dashboard embed URL must use /embed/dashboardsv3/{dashboard-id}.");
  }

  for (const name of parsedUrl.searchParams.keys()) {
    if (name !== "o" && name !== "fullscreenWidget") {
      return invalid(`Dashboard embed query parameter '${name}' is not supported.`);
    }
  }

  const workspaceIds = parsedUrl.searchParams.getAll("o");
  if (workspaceIds.length > 1 || (workspaceIds.length === 1 && !/^\d{1,32}$/.test(workspaceIds[0] ?? ""))) {
    return invalid("Dashboard embed workspace metadata is invalid.");
  }

  const widgetIds = parsedUrl.searchParams.getAll("fullscreenWidget");
  if (widgetIds.length > 1 || (widgetIds.length === 1 && !WIDGET_ID_PATTERN.test(widgetIds[0] ?? ""))) {
    return invalid("Dashboard widget selection is invalid.");
  }

  const widgetId = widgetIds[0];
  return widgetId === undefined
    ? path
    : `${path}?fullscreenWidget=${encodeURIComponent(widgetId)}`;
}

function readHeight(
  value: unknown,
  invalid: (detail: string) => never,
): number {
  if (value === undefined || value === null) {
    return DEFAULT_HEIGHT_PIXELS;
  }
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < MIN_HEIGHT_PIXELS ||
    value > MAX_HEIGHT_PIXELS
  ) {
    return invalid(`Dashboard height must be an integer from ${MIN_HEIGHT_PIXELS} to ${MAX_HEIGHT_PIXELS} pixels.`);
  }
  return value;
}

function readScrolling(
  value: unknown,
  invalid: (detail: string) => never,
): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value !== "boolean") {
    return invalid("Dashboard scrolling must be a boolean.");
  }
  return value;
}

