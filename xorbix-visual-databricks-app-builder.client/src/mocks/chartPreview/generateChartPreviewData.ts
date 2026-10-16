import type { ChartAxisConfig } from "../../types/chartAxisConfig";
import {
  buildMockCategoryLabels,
  buildMockLineX,
  buildMockXLabels,
} from "./buildMockAxisLabels";
import {
  chartPreviewMeasureRowSchema,
} from "./chartPreviewSchemas";
import { stablePreviewSeed } from "./previewSeed";

export interface ChartPreviewCartesianSeries {
  x: (string | number)[];
  y: number[];
}

export interface ChartPreviewRadialSeries {
  labels: string[];
  values: number[];
}

export async function generateCartesianPreviewSeries(
  kind: "bar" | "line",
  count: number,
  seedKey: string,
  xAxis: ChartAxisConfig,
): Promise<ChartPreviewCartesianSeries> {
  const { createGenerator } = await import("json-schema-faker");
  const { faker } = await import("@faker-js/faker");

  const seed = stablePreviewSeed(seedKey);
  const gen = createGenerator({ seed, extensions: { faker } });
  const y: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const row = (await gen.generate(chartPreviewMeasureRowSchema)) as {
      value: number;
    };
    y.push(row.value);
  }

  const x =
    kind === "line"
      ? buildMockLineX(count, seed, xAxis)
      : buildMockXLabels(count, seed, xAxis);

  return { x, y };
}

export async function generateRadialPreviewSeries(
  count: number,
  seedKey: string,
  categoryAxis: ChartAxisConfig,
): Promise<ChartPreviewRadialSeries> {
  const { createGenerator } = await import("json-schema-faker");
  const { faker } = await import("@faker-js/faker");

  const seed = stablePreviewSeed(seedKey);
  const gen = createGenerator({
    seed,
    extensions: { faker },
  });
  const labels = buildMockCategoryLabels(count, seed, categoryAxis);
  const values: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const row = (await gen.generate(chartPreviewMeasureRowSchema)) as {
      value: number;
    };
    values.push(row.value);
  }

  return { labels, values };
}
