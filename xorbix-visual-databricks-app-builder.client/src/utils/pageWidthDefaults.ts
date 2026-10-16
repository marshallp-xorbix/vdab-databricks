/**
 * App page content width for canvas preview and Streamlit `.block-container` max-width.
 * IMPORTANT: Keep numeric values in sync with `PageWidthBounds` in
 * `Xorbix-Visual-Databricks-App-Builder.Models/PageWidthBounds.cs`.
 * Dual definition is intentional — .NET and TypeScript cannot share a single constants module.
 */

/** Theme JSON key for app page content width. */
export const PAGE_WIDTH_THEME_KEY = "pageWidth";

/** Minimum page width in pixels (Streamlit default centered layout). */
export const PAGE_WIDTH_MIN = 730;

/** Maximum page width in pixels. */
export const PAGE_WIDTH_MAX = 1800;

/** Default page width when unset or invalid (matches the Streamlit minimum). */
export const PAGE_WIDTH_DEFAULT = PAGE_WIDTH_MIN;

/**
 * Clamps a page width to the supported range.
 */
export function clampPageWidth(value: number): number {
  return Math.min(PAGE_WIDTH_MAX, Math.max(PAGE_WIDTH_MIN, Math.round(value)));
}

/**
 * Parses a theme JSON / string / number page-width value.
 * Invalid or missing values yield the default.
 */
export function parsePageWidth(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampPageWidth(value);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      return PAGE_WIDTH_DEFAULT;
    }

    const parsedValue = Number(trimmedValue);
    if (Number.isFinite(parsedValue)) {
      return clampPageWidth(parsedValue);
    }
  }

  return PAGE_WIDTH_DEFAULT;
}

/**
 * Reads and normalizes page width from an app theme record.
 */
export function getPageWidthFromTheme(
  theme: Record<string, string> | undefined | null,
): number {
  return parsePageWidth(theme?.[PAGE_WIDTH_THEME_KEY]);
}
