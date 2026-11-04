const MAX_REFERENCE_LENGTH = 4096;
const DASHBOARD_EMBED_PATH = /^\/embed\/dashboardsv3\/[A-Za-z0-9_-]{1,128}$/;
const WIDGET_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}~[A-Za-z0-9_-]{1,128}$/;

export type DashboardEmbedReferenceResult =
  | { ok: true; reference: string }
  | { ok: false; message: string };

/** Removes workspace host and ID authority from a pasted dashboard URL. */
export function normalizeDashboardEmbedReference(
  value: string,
): DashboardEmbedReferenceResult {
  if (value.length > MAX_REFERENCE_LENGTH) {
    return { ok: false, message: "Dashboard embed URL is too long." };
  }

  const reference = value.trim();
  if (reference === "") {
    return { ok: true, reference: "" };
  }
  if (reference.startsWith("//")) {
    return { ok: false, message: "Enter an HTTPS dashboard embed URL or path." };
  }

  const absolute = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(reference);
  let parsedUrl: URL;
  try {
    parsedUrl = absolute
      ? new URL(reference)
      : new URL(reference, "https://vdab.invalid");
  } catch {
    return { ok: false, message: "Dashboard embed URL is invalid." };
  }

  if (
    (absolute && parsedUrl.protocol !== "https:") ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.hash !== ""
  ) {
    return {
      ok: false,
      message: "Use an HTTPS dashboard embed URL without credentials or fragments.",
    };
  }
  if (!DASHBOARD_EMBED_PATH.test(parsedUrl.pathname)) {
    return {
      ok: false,
      message: "Use the /embed/dashboardsv3/{dashboard-id} path.",
    };
  }

  for (const name of parsedUrl.searchParams.keys()) {
    if (name !== "o" && name !== "fullscreenWidget") {
      return { ok: false, message: `Query parameter '${name}' is not supported.` };
    }
  }
  const workspaceIds = parsedUrl.searchParams.getAll("o");
  if (workspaceIds.length > 1 || (workspaceIds.length === 1 && !/^\d{1,32}$/.test(workspaceIds[0] ?? ""))) {
    return { ok: false, message: "Dashboard workspace metadata is invalid." };
  }

  const widgetIds = parsedUrl.searchParams.getAll("fullscreenWidget");
  if (widgetIds.length > 1 || (widgetIds.length === 1 && !WIDGET_ID_PATTERN.test(widgetIds[0] ?? ""))) {
    return { ok: false, message: "Dashboard widget selection is invalid." };
  }

  const widgetId = widgetIds[0];
  return {
    ok: true,
    reference: widgetId === undefined
      ? parsedUrl.pathname
      : `${parsedUrl.pathname}?fullscreenWidget=${encodeURIComponent(widgetId)}`,
  };
}
