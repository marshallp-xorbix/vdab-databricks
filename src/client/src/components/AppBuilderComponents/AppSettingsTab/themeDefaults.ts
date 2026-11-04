import {
  readAppliedTheme,
  type ThemeMode,
} from "../../../context/ThemeContext";

export type AppThemeColorKey =
  | "primaryColor"
  | "backgroundColor"
  | "secondaryBackgroundColor"
  | "textColor";

export type AppTheme = Partial<Record<AppThemeColorKey, string>>;

export type ProductThemeMode = ThemeMode;

/**
 * Develop / light-product Streamlit canvas defaults.
 */
export const STREAMLIT_THEME_DEFAULTS_LIGHT = {
  primaryColor: "#001641",
  backgroundColor: "#FFFFFF",
  secondaryBackgroundColor: "#F0F2F6",
  textColor: "#31333F",
} as const;

/**
 * VS Code–inspired dark canvas defaults (lighter greys than near-black).
 */
export const STREAMLIT_THEME_DEFAULTS_DARK = {
  primaryColor: "#0078D4",
  backgroundColor: "#252526",
  secondaryBackgroundColor: "#2D2D30",
  textColor: "#CCCCCC",
} as const;

/**
 * @deprecated Prefer {@link getStreamlitThemeDefaults}. Alias of dark defaults
 * (product default theme is dark).
 */
export const STREAMLIT_THEME_DEFAULTS = STREAMLIT_THEME_DEFAULTS_DARK;

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const normalizeHexColor = (
  value: string | undefined,
  fallback: string,
): string => {
  if (value && HEX_COLOR_PATTERN.test(value)) {
    return value.toUpperCase();
  }

  return fallback;
};

/**
 * Reads the active product theme from the document element.
 */
export const getProductThemeMode = (): ProductThemeMode => readAppliedTheme();

/**
 * Canvas / Streamlit defaults for the given (or current) product theme.
 */
export const getStreamlitThemeDefaults = (
  mode?: ProductThemeMode,
): typeof STREAMLIT_THEME_DEFAULTS_LIGHT | typeof STREAMLIT_THEME_DEFAULTS_DARK => {
  const resolvedMode = mode ?? getProductThemeMode();
  return resolvedMode === "light"
    ? STREAMLIT_THEME_DEFAULTS_LIGHT
    : STREAMLIT_THEME_DEFAULTS_DARK;
};

/**
 * Resolves the canvas background from an app theme, falling back to
 * product-theme defaults when unset.
 */
export const resolveAppThemeBackground = (
  theme: Record<string, string> | undefined | null,
  productTheme?: ProductThemeMode,
): string => {
  const defaults = getStreamlitThemeDefaults(productTheme);
  return normalizeHexColor(theme?.backgroundColor, defaults.backgroundColor);
};

/**
 * Resolves a single app theme color key with product-theme-aware fallback.
 */
export const resolveAppThemeColor = (
  theme: Record<string, string> | undefined | null,
  key: AppThemeColorKey,
  productTheme?: ProductThemeMode,
): string => {
  const defaults = getStreamlitThemeDefaults(productTheme);
  return normalizeHexColor(theme?.[key], defaults[key]);
};
