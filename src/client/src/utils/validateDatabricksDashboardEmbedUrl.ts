/**
 * Client-side validation for Databricks Lakeview dashboard embed URLs.
 * Accepts absolute workspace URLs or hostless `/embed/dashboardsv3/...` paths.
 */

import { normalizeDashboardEmbedReference } from "./dashboardEmbedConfiguration";

const ALLOWED_WORKSPACE_HOST_SUFFIXES: readonly string[] = [
  ".cloud.databricks.com",
  ".azuredatabricks.net",
  ".gcp.databricks.com",
];

const EMBED_PATH_PREFIX = "/embed/dashboardsv3/";

function isLikelyDatabricksWorkspaceHost(host: string): boolean {
  const lower = host.toLowerCase();
  return ALLOWED_WORKSPACE_HOST_SUFFIXES.some((suffix) =>
    lower.endsWith(suffix.toLowerCase()),
  );
}

export type ValidateDatabricksDashboardEmbedUrlResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Validates `src` when non-empty; empty or whitespace-only `src` is valid.
 * Hostless embed paths are accepted without a workspace URL. Absolute URLs
 * must match the configured workspace host.
 * @param workspaceUrl The app's configured Databricks workspace URL (HTTPS), or null/empty if unset.
 */
export function validateDatabricksDashboardEmbedUrl(
  src: string,
  workspaceUrl: string | null | undefined,
): ValidateDatabricksDashboardEmbedUrlResult {
  if (!src.trim()) {
    return { ok: true };
  }

  const trimmedSrc = src.trim();
  if (trimmedSrc.startsWith(EMBED_PATH_PREFIX) || trimmedSrc.startsWith("/embed/dashboardsv3/")) {
    const normalized = normalizeDashboardEmbedReference(trimmedSrc);
    if (!normalized.ok) {
      return { ok: false, message: normalized.message };
    }
    return { ok: true };
  }

  const trimmedWorkspace = workspaceUrl?.trim() ?? "";

  if (!trimmedWorkspace) {
    return {
      ok: false,
      message:
        "Workspace URL is missing for this app. Configure the workspace connection and try again.",
    };
  }

  let workspaceUri: URL;
  try {
    workspaceUri = new URL(trimmedWorkspace);
  } catch {
    return {
      ok: false,
      message:
        "The app workspace URL is not valid. Update the workspace connection.",
    };
  }

  if (workspaceUri.protocol !== "https:" || !workspaceUri.hostname) {
    return {
      ok: false,
      message:
        "The app workspace URL is not valid. Update the workspace connection.",
    };
  }

  let embedUri: URL;
  try {
    embedUri = new URL(trimmedSrc);
  } catch {
    return { ok: false, message: "Dashboard embed URL must use HTTPS." };
  }

  if (embedUri.protocol !== "https:") {
    return { ok: false, message: "Dashboard embed URL must use HTTPS." };
  }

  if (embedUri.username !== "" || embedUri.password !== "") {
    return { ok: false, message: "Dashboard embed URL is not valid." };
  }

  if (
    embedUri.hostname.toLowerCase() !== workspaceUri.hostname.toLowerCase()
  ) {
    return {
      ok: false,
      message:
        "Dashboard embed URL must use the same workspace host as this app.",
    };
  }

  if (!isLikelyDatabricksWorkspaceHost(embedUri.hostname)) {
    return {
      ok: false,
      message:
        "Dashboard embed URL host is not recognized as a Databricks workspace.",
    };
  }

  let path = embedUri.pathname.replace(/\/+$/, "");
  if (!path.startsWith(EMBED_PATH_PREFIX)) {
    return {
      ok: false,
      message:
        "Dashboard embed URL must use a Lakeview embed path (/embed/dashboardsv3/...).",
    };
  }

  const remainder = path.slice(EMBED_PATH_PREFIX.length);
  if (remainder.length === 0 || remainder.includes("/")) {
    return {
      ok: false,
      message:
        "Dashboard embed URL is missing a valid dashboard id in the path.",
    };
  }

  return { ok: true };
}

/**
 * Builds an iframe URL for canvas preview from a hostless or absolute embed reference.
 * Returns null when a hostless path cannot be resolved without a workspace URL.
 */
export function resolveDashboardEmbedPreviewUrl(
  src: string,
  workspaceUrl: string | null | undefined,
): string | null {
  const trimmedSrc = src.trim();
  if (!trimmedSrc) return null;

  const normalized = normalizeDashboardEmbedReference(trimmedSrc);
  if (!normalized.ok || !normalized.reference) {
    return /^https:\/\//i.test(trimmedSrc) ? trimmedSrc : null;
  }

  if (/^https:\/\//i.test(trimmedSrc)) {
    return trimmedSrc;
  }

  const trimmedWorkspace = workspaceUrl?.trim() ?? "";
  if (!trimmedWorkspace) return null;

  let workspaceUri: URL;
  try {
    workspaceUri = new URL(trimmedWorkspace);
  } catch {
    return null;
  }
  if (workspaceUri.protocol !== "https:" || !workspaceUri.hostname) {
    return null;
  }

  const referenceUrl = new URL(normalized.reference, "https://vdab.invalid");
  const query = new URLSearchParams();
  const widgetId = referenceUrl.searchParams.get("fullscreenWidget");
  if (widgetId) query.set("fullscreenWidget", widgetId);
  const queryText = query.toString();
  return `${workspaceUri.origin}${referenceUrl.pathname}${queryText ? `?${queryText}` : ""}`;
}
