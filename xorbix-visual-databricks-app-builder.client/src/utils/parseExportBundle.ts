import { ExportBundleType, type IExportBundle } from "../models";

/** Result of parsing pasted or dropped export-bundle text. */
export interface IParsedBundle {
  bundle?: IExportBundle;
  error?: string;
}

/**
 * Parses and minimally validates export-bundle JSON. Accepts either a full
 * {@link IExportBundle} envelope or a bare array of elements (treated as the
 * expected type).
 *
 * @param text - The raw JSON text.
 * @param expectedType - The bundle type the caller can import on this page.
 * @returns The parsed bundle, or an error message describing why it was rejected.
 */
export function parseExportBundle(
  text: string,
  expectedType: ExportBundleType,
): IParsedBundle {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: "Paste or drop exported JSON to continue." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { error: "The provided text is not valid JSON." };
  }

  // Allow a bare array of elements as a convenience.
  if (Array.isArray(parsed)) {
    return {
      bundle: {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        type: expectedType,
        apps: expectedType === ExportBundleType.Apps ? parsed : undefined,
        connections:
          expectedType === ExportBundleType.Connections ? parsed : undefined,
      },
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { error: "The JSON must be an export bundle object." };
  }

  const bundle = parsed as IExportBundle;
  const hasApps = Array.isArray(bundle.apps);
  const hasConnections = Array.isArray(bundle.connections);
  if (!hasApps && !hasConnections) {
    return {
      error: "The bundle does not contain any apps or connections.",
    };
  }

  return { bundle };
}
