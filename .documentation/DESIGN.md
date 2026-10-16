# VDAB Product Design System

Dual appearance: **Light** matches the historical develop chrome (navy primary, light builder panels). **Dark** is VS Code–inspired (blue primary, elevated greys). Per-app canvas / Streamlit themes resolve defaults from the active product theme; saved app themes still override.

## Principles

- Theme via CSS variables in `src/App.css` (`:root` = light, `:root.dark` = dark). Prefer semantic Tailwind classes over hardcoded colors.
- Light: full flip — light builder panels, light sidebars, develop surfaces.
- Dark: elevated boxes on a slightly lighter ground; soft card shadow for separation.
- Thin 1px borders; modest radius (~10–12px).
- Do **not** use coral (`#FF4D2D`) as product primary.

## Color

| Role | Dark (VS Code Dark Modern) | Light | Notes |
| --- | --- | --- | --- |
| Background | `#1E1E1E` | white | Editor / page ground |
| Foreground | `#CCCCCC` | near-black | Primary text |
| Shell / title bar | `#181818` | navy gradient | Flat in dark; blue is not a chrome fill |
| Card / elevated | `#252526` | white | Subtle lift |
| Nested / muted | `#2D2D30` | light grey | Secondary panels |
| Border | `rgb(255 255 255 / 18%)` | light grey | Thin separators |
| Primary (accent) | `#0078D4` | `#001641` | Buttons / selection only in dark |
| Active nav | soft white wash | navy | Not a solid blue pill in dark |

CSS variables live in `src/App.css`. Keep `src/constants/authBranding.ts` in sync (`BRAND_NAVY`, `BRAND_PRIMARY_DARK`).

## Typography

- Sans stack: Inter / system UI.
- Headings: bold, tight tracking, foreground color.
- Body: muted foreground; generous line-height.

## Radius & borders

- Base radius: `0.625rem` (~10px); cards ~12px.
- Borders: 1px; prefer `border-border` over hardcoded slate.
- No thick outlines.

## Buttons

| Variant | Use |
| --- | --- |
| `default` (solid primary) | Primary action only — navy in light, VS Code blue in dark |
| `outline` / ghost | Secondary; thin border, transparent fill |
| `secondary` | Quiet alternate actions |
| `link` | Inline text actions (primary) |

## Cards & inputs

- Cards: `bg-card`, `border-border`, `shadow-[var(--card-shadow)]`.
- Inputs: theme fill, thin border, primary focus ring.

## Shell chrome

- Light: develop gradient header/rail (navy → royal/sky) and builder photo chrome.
- Dark: VS Code greys with blue primary accents.
- Active nav: primary; accent for small status icons.

## Do / Don’t

**Do**

- Use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`).
- Prefer shared surface helpers:
  - Property editors: `src/components/properties/propertyEditorStyles.ts`
  - App Settings cards: `SettingsCard`
  - Main Flow / Workflow canvases: `ThemedReactFlow`
- Change palette in `App.css` (+ branding constants), not by editing hundreds of components.

**Don’t**

- Hardcode `bg-white`, `bg-slate-*`, `text-slate-*`, or `text-white` on themeable builder panels.
- Reintroduce coral as product primary.
- Add per-component `dark:` color pairs when a token flip would suffice.

## Theme preference

- Modes: `dark` | `light`.
- Default: `dark`.
- Persist in `localStorage` (`vdab-theme`); apply `class` on `<html>`.
- Toggle: signed-in users use Appearance in the account menu; guest/public top bars keep the icon toggle.
