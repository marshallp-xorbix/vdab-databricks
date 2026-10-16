import { faker } from "@faker-js/faker";
import type { ChartAxisConfig } from "../../types/chartAxisConfig";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Deterministic X labels for canvas preview that mirror common time grains (year / month / week / day).
 */
export function buildMockXLabels(
  count: number,
  seed: number,
  xAxis: ChartAxisConfig,
): string[] {
  faker.seed(seed);
  const t = xAxis.transform;

  if (t === "yearly") {
    const startYear = 2022 + (seed % 4);
    return Array.from({ length: count }, (_, i) => String(startYear + i));
  }

  if (t === "monthly") {
    const start = new Date(Date.UTC(2024, seed % 12, 1));
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setUTCMonth(d.getUTCMonth() + i);
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
    });
  }

  if (t === "weekly") {
    const baseYear = 2024 + (seed % 2);
    return Array.from({ length: count }, (_, i) => {
      const week = ((seed + i) % 52) + 1;
      return `${baseYear}-W${pad2(week)}`;
    });
  }

  if (t === "daily") {
    const start = new Date(2025, 0, 1 + (seed % 20));
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }

  return Array.from({ length: count }, () => faker.commerce.department());
}

/**
 * Line chart X: numeric spacing when continuous + no time bucket; otherwise categorical/time labels.
 */
export function buildMockLineX(
  count: number,
  seed: number,
  xAxis: ChartAxisConfig,
): (string | number)[] {
  if (xAxis.scaleType === "continuous" && xAxis.transform === "none") {
    const start = (seed % 11) - 5;
    const step = 1 + (seed % 4);
    return Array.from({ length: count }, (_, i) => start + i * step);
  }
  return buildMockXLabels(count, seed, xAxis);
}

/**
 * Deterministic category labels for pie / donut preview.
 * Uses temporal buckets when configured; otherwise uses domain-style categories.
 */
export function buildMockCategoryLabels(
  count: number,
  seed: number,
  axis: ChartAxisConfig,
): string[] {
  if (
    axis.transform === "yearly" ||
    axis.transform === "monthly" ||
    axis.transform === "weekly" ||
    axis.transform === "daily"
  ) {
    return buildMockXLabels(count, seed, axis);
  }

  faker.seed(seed);
  // Set faker category labels - just commerce departments now.
  return Array.from({ length: count }, () => faker.commerce.department());
}
