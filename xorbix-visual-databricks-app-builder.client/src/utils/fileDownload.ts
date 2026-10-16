/**
 * Helpers for triggering client-side file downloads without a server round-trip.
 */

/**
 * Triggers a browser download of the given text content as a file.
 *
 * @param fileName - The suggested file name (including extension).
 * @param content - The file contents.
 * @param mimeType - The MIME type of the content. Defaults to `application/json`.
 */
export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string = "application/json",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Builds a timestamped, filesystem-safe export file name.
 *
 * @param prefix - A short descriptor, e.g. `"apps"` or `"connections"`.
 * @returns A name like `vdab-apps-export-2026-06-11.json`.
 */
export function buildExportFileName(prefix: string): string {
  const date = new Date().toISOString().split("T")[0];
  return `vdab-${prefix}-export-${date}.json`;
}
