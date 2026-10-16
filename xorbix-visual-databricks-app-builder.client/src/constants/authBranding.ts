import { readAppliedTheme } from "../context/ThemeContext";

/**
 * URL for static assets in `public/` (served at the site root by Vite).
 * File on disk: `public/images/site-background.png`
 * Used for develop light branded shells (Apps list, auth); dark mode uses flat tokens.
 */
export const BACKGROUND_URL = "/images/site-background.png";

/**
 * Light-theme primary navy — must match `:root { --primary }` in `App.css`.
 */
export const BRAND_NAVY = "#001641";

/**
 * Dark-theme primary (VS Code / Fluent blue) — must match `.dark { --primary }` in `App.css`.
 */
export const BRAND_PRIMARY_DARK = "#0078D4";

/**
 * @deprecated Use {@link BRAND_NAVY} (light) or {@link BRAND_PRIMARY_DARK} (dark).
 * Kept for residual imports during migration away from marketing coral.
 */
export const BRAND_CORAL = BRAND_NAVY;

/**
 * Accent blue for meta icons / highlights — must match `--brand-accent` in `App.css` (dark).
 * Light theme uses a similar sky/royal blue via CSS; this hex is for JS fallbacks.
 */
export const BRAND_TEAL = "#3794FF";

/** Logo in `public/` — spaces encoded for reliable URLs. */
export const VDAB_LOGO_URL = encodeURI("/vdab - logo.png");

/**
 * Resolves the active product primary hex from the document theme class.
 * Prefer CSS `var(--primary)` / Tailwind `bg-primary` when possible.
 */
export function getThemePrimaryHex(): string {
  return readAppliedTheme() === "light" ? BRAND_NAVY : BRAND_PRIMARY_DARK;
}

/** Auth & marketing: uses theme primary. */
export const authInputFocusClassName =
  "focus:border-primary focus:ring-primary/20";

export const authLinkClassName = "text-primary font-medium hover:underline";

export const authMutedLinkClassName =
  "text-muted-foreground hover:text-primary transition-colors";

export const authAccentTextClassName = "text-primary";

export const authSpinnerClassName = "text-primary";
