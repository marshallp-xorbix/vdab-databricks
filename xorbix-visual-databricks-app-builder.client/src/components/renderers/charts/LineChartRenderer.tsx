import type { FC, ReactNode } from "react";
import { lazy, Suspense, useMemo } from "react";
import type { Data } from "plotly.js";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { getAxisTitle, parseChartAxis } from "../../../types/chartAxisConfig";
import { useCartesianChartPreviewSeries } from "../../../hooks/useMockPlotData";
import type { CartesianChartRendererProps } from "./chartRendererProps";
import { buildChartAxisLayout } from "./chartAxisLayout";
import { useChartThemeColors } from "./useChartThemeColors";

const Plot = lazy(() => import("./PlotlyBasic"));

const LineChartRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const chartColors = useChartThemeColors();
  const raw = component.props as CartesianChartRendererProps;
  const xAxis = parseChartAxis(raw.xAxis);
  const yAxis = parseChartAxis(raw.yAxis);
  const title = raw.title || "Line Chart";
  const seriesColor = raw.seriesColor || "#1f77b4";
  const xTitle = getAxisTitle(xAxis, "line-x");
  const yTitle = getAxisTitle(yAxis, "line-y");
  const titleColor = theme.textColor;
  const hasConfig = Boolean(
    xAxis.field &&
      xAxis.field.length > 0 &&
      yAxis.field &&
      yAxis.field.length > 0,
  );

  const previewSeedKey = `${component.id}|line|${xAxis.field}|${xAxis.scaleType}|${xAxis.transform}|${yAxis.field}|${yAxis.scaleType}|${yAxis.transform}`;

  const { loading: previewLoading, data: previewSeries } =
    useCartesianChartPreviewSeries("line", hasConfig, previewSeedKey, xAxis);

  const xAxisPlotType = useMemo((): "linear" | "category" => {
    const x = previewSeries?.x;
    if (!x || x.length === 0) {
      return xAxis.scaleType === "continuous" ? "linear" : "category";
    }
    const allNumeric = x.every(
      (v) => typeof v === "number" && Number.isFinite(v),
    );
    if (xAxis.scaleType === "continuous" && allNumeric) {
      return "linear";
    }
    return "category";
  }, [previewSeries?.x, xAxis.scaleType]);

  const plotData: Data[] = useMemo(
    () =>
      hasConfig
        ? [
            {
              type: "scatter",
              mode: "lines+markers",
              x: previewSeries?.x ?? [],
              y: previewSeries?.y ?? [],
              line: {
                color: seriesColor,
                width: 2,
              },
              marker: {
                color: seriesColor,
                size: 6,
              },
              name: yTitle,
              hovertemplate: "%{x}, %{y}<extra></extra>",
            },
          ]
        : [],
    [hasConfig, previewSeries, seriesColor, yTitle],
  );

  let chartBody: ReactNode;
  if (!hasConfig) {
    chartBody = (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
        Configure X and Y axes to render this chart
      </div>
    );
  } else if (previewLoading) {
    chartBody = (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
        Generating sample data…
      </div>
    );
  } else if (!previewSeries) {
    chartBody = (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
        Unable to generate sample preview
      </div>
    );
  } else {
    chartBody = (
      <Suspense
        fallback={
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Loading chart...
          </div>
        }
      >
        <Plot
          data={plotData}
          layout={{
            autosize: true,
            margin: { t: 20, r: 20, b: 70, l: 72 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            xaxis: buildChartAxisLayout(xTitle, chartColors, xAxisPlotType),
            yaxis: buildChartAxisLayout(yTitle, chartColors),
            showlegend: false,
            datarevision: previewSeedKey,
          }}
          revision={previewSeedKey}
          config={{
            responsive: true,
            displaylogo: false,
            displayModeBar: false,
          }}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
        />
      </Suspense>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col p-2 bg-transparent rounded border border-border"
      style={{ minHeight: "300px" }}
    >
      <h3 className="mb-2 text-sm font-medium" style={{ color: titleColor }}>
        {title}
      </h3>
      {hasConfig && (
        <div className="text-xs text-muted-foreground mb-2 italic">
          Preview only
          {previewLoading ? " (generating sample data…) " : " (sample data) "}—
          deployed app uses {yTitle} over {xTitle} (respecting scale types).
        </div>
      )}
      <div className="w-full h-[250px]">{chartBody}</div>
    </div>
  );
};

export default LineChartRenderer;
