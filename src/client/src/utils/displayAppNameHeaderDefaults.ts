/**
 * Theme flag for showing the Streamlit app-name title on the canvas and in
 * generated preview/deploy source. Keep parsing aligned with the server theme
 * allowlist in project-service.
 */

/** Theme JSON key for the display-app-name-header toggle. */
export const DISPLAY_APP_NAME_HEADER_THEME_KEY = "displayAppNameHeader";

/**
 * Sentinel selection id for the canvas app-name header chrome.
 * Not a real component key; selecting it opens Page Properties.
 */
export const APP_NAME_HEADER_SELECTION_ID = "__appNameHeader__";

/** Default when unset or invalid: header is hidden. */
export const DISPLAY_APP_NAME_HEADER_DEFAULT = false;

/**
 * Parses a theme JSON / string / boolean display-app-name-header value.
 * Invalid or missing values yield the default (false).
 */
export function parseDisplayAppNameHeader(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim().toLowerCase();
    if (trimmedValue === "true") {
      return true;
    }
    if (trimmedValue === "false") {
      return false;
    }
  }

  return DISPLAY_APP_NAME_HEADER_DEFAULT;
}

/**
 * Reads and normalizes the display-app-name-header flag from an app theme record.
 */
export function getDisplayAppNameHeaderFromTheme(
  theme: Record<string, string> | undefined | null,
): boolean {
  return parseDisplayAppNameHeader(theme?.[DISPLAY_APP_NAME_HEADER_THEME_KEY]);
}
