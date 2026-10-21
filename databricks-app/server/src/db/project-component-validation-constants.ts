export const MAX_COMPONENT_COUNT = 500;
export const MAX_COMPONENTS_JSON_BYTES = 900_000;
export const MAX_COMPONENT_DEPTH = 20;
export const COMPONENT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
export const COMPONENT_CODE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,159}$/;
export const UNSAFE_PROPERTY_PATTERN = /workspace[_-]?(connection[_-]?)?id|workspace[_-]?(url|host)|databricks[_-]?connection[_-]?id|connection[_-]?id|tenant[_-]?id|account[_-]?id|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|api[_-]?key|credential|authorization/i;
export const DATE_FORMATS = new Set([
  "YYYY/MM/DD", "YYYY.MM.DD", "YYYY-MM-DD", "DD/MM/YYYY", "DD.MM.YYYY",
  "DD-MM-YYYY", "MM/DD/YYYY", "MM.DD.YYYY", "MM-DD-YYYY",
]);
export const SLIDER_FORMATS = new Set([
  "plain", "localized", "percent", "dollar", "euro", "yen", "compact",
  "scientific", "engineering", "accounting", "bytes",
]);
export const SLIDER_PRINTF_FORMAT_PATTERN = /^%\.?\d*[df%]$/;
export const LABEL_FONT_SIZES = new Set(["small", "medium", "large"]);
export const DEFAULT_LAYOUT_SLOT_COUNT = 2;
export const MAX_LAYOUT_SLOT_COUNT = 12;
export const MAX_TAB_NAME_LENGTH = 100;
export const MAX_FORM_DIMENSION_PIXELS = 10_000;
export const MAX_MODAL_TITLE_LENGTH = 2_000;
export const MAX_LEGACY_MODAL_DIMENSION_PIXELS = 2_147_483_647;
export const DEFAULT_SLIDER_MIN_VALUE = 0;
export const DEFAULT_SLIDER_MAX_VALUE = 100;
export const DEFAULT_SLIDER_VALUE = 50;
export const DEFAULT_SLIDER_UPPER_VALUE = 60;
export const DEFAULT_SLIDER_STEP = 1;
export const MAX_SLIDER_VALUE = Number.MAX_SAFE_INTEGER;
