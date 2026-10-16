export const STORY_CATEGORY_COLORS = [
  "#2dd4bf",
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
  "#34d399",
  "#fb7185",
  "#60a5fa",
] as const;

export const STORY_TYPE_COLORS = [
  "#67e8f9",
  "#fcd34d",
  "#f9a8d4",
  "#86efac",
  "#fdba74",
  "#a5b4fc",
] as const;

/**
 * Stable string hash for color indexing.
 */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Category → palette color.
 */
export function catColor(cat: string): string {
  return STORY_CATEGORY_COLORS[hashStr(cat) % STORY_CATEGORY_COLORS.length];
}

/**
 * Relationship/type → palette color.
 */
export function typeColor(t: string): string {
  return STORY_TYPE_COLORS[hashStr(t) % STORY_TYPE_COLORS.length];
}

/**
 * Health score (0–100) → green-leaning RGB.
 */
export function healthColor(h: number): string {
  const v = Math.max(0, Math.min(100, h));
  const r = Math.round(255 * (1 - v / 100));
  const g = Math.round(180 * (v / 100) + 40);
  return `rgb(${r},${g},120)`;
}

/**
 * Risk score (0–100) → warmer RGB as risk rises.
 */
export function riskColor(r: number): string {
  const v = Math.max(0, Math.min(100, r));
  return `rgb(${Math.round(80 + v * 1.7)},${Math.round(200 - v * 1.4)},70)`;
}
