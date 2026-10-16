import { useEffect, useMemo, useState } from "react";
import type { JsonSchema } from "json-schema-faker";
import type { ChartAxisConfig } from "../types/chartAxisConfig";
import {
  generateCartesianPreviewSeries,
  generateRadialPreviewSeries,
  type ChartPreviewCartesianSeries,
  type ChartPreviewRadialSeries,
} from "../mocks/chartPreview/generateChartPreviewData";
import { stablePreviewSeed } from "../mocks/chartPreview/previewSeed";

export {
  chartPreviewMeasureRowSchema,
  chartPreviewSliceRowSchema,
} from "../mocks/chartPreview/chartPreviewSchemas";

/**
 * Schema-driven mock rows (json-schema-faker + faker). Loads libraries on demand.
 */
export function useMockPlotData(
  schema: JsonSchema | null,
  count: number,
  seedKey: string,
  enabled: boolean,
): { loading: boolean; rows: unknown[] | null } {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<unknown[] | null>(null);

  useEffect(() => {
    if (!enabled || schema === null || count <= 0) {
      setLoading(false);
      setRows(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { createGenerator } = await import("json-schema-faker");
      const { faker } = await import("@faker-js/faker");
      const gen = createGenerator({
        seed: stablePreviewSeed(seedKey),
        extensions: { faker },
      });
      const next: unknown[] = [];
      for (let i = 0; i < count; i += 1) {
        next.push(await gen.generate(schema));
      }
      if (!cancelled) {
        setRows(next);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schema, count, seedKey, enabled]);

  return { loading, rows };
}

const DEFAULT_BAR_LINE_COUNT = 10;
const DEFAULT_RADIAL_COUNT = 5;

export function useCartesianChartPreviewSeries(
  kind: "bar" | "line",
  enabled: boolean,
  seedKey: string,
  xAxis: ChartAxisConfig,
  count: number = DEFAULT_BAR_LINE_COUNT,
): { loading: boolean; data: ChartPreviewCartesianSeries | null } {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChartPreviewCartesianSeries | null>(null);

  const xFingerprint = useMemo(
    () => `${xAxis.field}|${xAxis.scaleType}|${xAxis.transform}`,
    [xAxis.field, xAxis.scaleType, xAxis.transform],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setData(null);

    void generateCartesianPreviewSeries(kind, count, seedKey, xAxis)
      .then((series) => {
        if (!cancelled) {
          setData(series);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [kind, enabled, seedKey, count, xFingerprint]);

  return { loading, data };
}

export function useRadialChartPreviewSeries(
  enabled: boolean,
  seedKey: string,
  categoryAxis: ChartAxisConfig,
  count: number = DEFAULT_RADIAL_COUNT,
): { loading: boolean; data: ChartPreviewRadialSeries | null } {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChartPreviewRadialSeries | null>(null);

  const categoryFingerprint = useMemo(
    () =>
      `${categoryAxis.field}|${categoryAxis.scaleType}|${categoryAxis.transform}`,
    [categoryAxis.field, categoryAxis.scaleType, categoryAxis.transform],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void generateRadialPreviewSeries(count, seedKey, categoryAxis).then((series) => {
      if (!cancelled) {
        setData(series);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, seedKey, count, categoryFingerprint]);

  return { loading, data };
}
