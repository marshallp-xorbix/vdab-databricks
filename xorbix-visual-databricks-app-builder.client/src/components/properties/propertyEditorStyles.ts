/**
 * Shared Tailwind class strings for property editors.
 * Prefer these over inlined slate/white utilities so theme tokens stay centralized.
 */

/** Block label above a control (string/number/select). */
export const PROPERTY_FIELD_LABEL_CLASS =
  "mb-0.5 block text-xs font-medium text-muted-foreground";

/** Inline label (e.g. boolean row, series color). */
export const PROPERTY_INLINE_LABEL_CLASS =
  "text-xs font-medium text-muted-foreground";

/** Section eyebrow inside a property group (Visual settings, etc.). */
export const PROPERTY_SECTION_TITLE_CLASS =
  "text-xs font-medium text-muted-foreground";

/** Divider + spacing for nested property sections. */
export const PROPERTY_SECTION_DIVIDER_CLASS =
  "space-y-4 border-t border-border pt-2";

/** Secondary helper / description text. */
export const PROPERTY_HINT_CLASS = "text-xs text-muted-foreground";

/** Validation error under a field. */
export const PROPERTY_ERROR_CLASS = "text-xs text-destructive";

/** Default text input / select control chrome. */
export const PROPERTY_CONTROL_CLASS =
  "w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

/** Control chrome when the field has a validation error. */
export const PROPERTY_CONTROL_ERROR_CLASS =
  "border-destructive focus:ring-destructive";

/** Control chrome when the field is valid. */
export const PROPERTY_CONTROL_VALID_CLASS =
  "border-border focus:border-primary focus:ring-primary";
