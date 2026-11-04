import type { FC } from "react";
import { lazy, Suspense, useMemo } from "react";
import type { Data } from "plotly.js";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { getAxisTitle, parseChartAxis } from "../../../types/chartAxisConfig";
import { useCartesianChartPreviewSeries } from "../../../hooks/useMockPlotData";
import type { CartesianChartRendererProps } from "./chartRendererProps";
import { buildChartAxisLayout } from "./chartAxisLayout";
import { useChartThemeColors } from "./useChartThemeColors";

const Plot = lazy(() => import("./PlotlyBasic"));

const BarChartRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const chartColors = useChartThemeColors();
  const raw = component.props as CartesianChartRendererProps;
  const xAxis = parseChartAxis(raw.xAxis);
  const yAxis = parseChartAxis(raw.yAxis);
  const title = raw.title || "Bar Chart";
  const seriesColor = raw.seriesColor || "#1f77b4";
  const xTitle = getAxisTitle(xAxis, "bar-x");
  const yTitle = getAxisTitle(yAxis, "bar-y");
  const titleColor = theme.textColor;
  const hasConfig = Boolean(xAxis.field && xAxis.field.length > 0);
  const xLayoutType = xAxis.scaleType === "continuous" ? "linear" : "category";

  const previewSeedKey = `${component.id}|bar|${xAxis.field}|${xAxis.scaleType}|${xAxis.transform}|${yAxis.field}|${yAxis.scaleType}|${yAxis.transform}`;

  const { loading: previewLoading, data: previewSeries } =
    useCartesianChartPreviewSeries("bar", hasConfig, previewSeedKey, xAxis);

  const plotData: Data[] = useMemo(
    () =>
      hasConfig
        ? [
            {
              type: "bar",
              x: previewSeries?.x ?? [],
              y: previewSeries?.y ?? [],
              marker: { color: seriesColor },
              name: yTitle,
              hovertemplate: "%{x}: %{y}<extra></extra>",
            },
          ]
        : [],
    [hasConfig, previewSeries, seriesColor, yTitle],
  );

  const summaryParts = [
    yAxis.transform !== "none" ? yAxis.transform.toUpperCase() : null,
    yTitle || (yAxis.transform === "count" ? "*" : null),
    xTitle ? `by ${xTitle}` : null,
  ].filter(Boolean);

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
          deployed app runs generated SQL (
          {summaryParts.join(" ") || "aggregated"}).
        </div>
      )}
      <div className="w-full h-[250px]">
        {hasConfig ? (
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
                xaxis: buildChartAxisLayout(xTitle, chartColors, xLayoutType),
                yaxis: buildChartAxisLayout(yTitle, chartColors),
                showlegend: false,
              }}
              config={{
                responsive: true,
                displaylogo: false,
                displayModeBar: false,
              }}
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
            />
          </Suspense>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Configure X and Y axes to render this chart
          </div>
        )}
      </div>
    </div>
  );
};

export default BarChartRenderer;
