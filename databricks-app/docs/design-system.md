# Design system

The builder keeps the established VDAB product appearance in both light and dark themes. The goal is continuity with the former builder UI while fitting Databricks' standalone workspace shell.

## Theme and color

- Use CSS variables and semantic Tailwind/shadcn tokens so light/dark modes remain aligned. Theme variables are defined in `xorbix-visual-databricks-app-builder.client/src/App.css`.
- Light mode uses a white/light canvas and the existing navy brand accent. Dark mode uses VS Code-style charcoal surfaces with the blue interaction accent.
- Preserve semantic contrast for text, borders, focus rings, selected states, and disabled controls. Avoid introducing raw color values where an existing token serves the same role.
- App-level generated Streamlit themes are project data and may override the product theme for the child app.

## Components and layout

Use the existing shadcn/ui components and Tailwind utilities. Keep the product's thin separators, modest corner radii, compact builder panels, and clear surface elevation. Do not introduce a second component library or a parallel CSS framework.

## Interaction and accessibility

Maintain responsive canvas/editor behavior, keyboard-operable navigation and dialogs, visible focus, labeled controls, readable validation/error states, and WCAG 2.2 AA contrast. Confirm destructive changes before applying them. Follow nearby component patterns and the detailed [frontend standards](../../.documentation/standards/frontend-patterns.md).
