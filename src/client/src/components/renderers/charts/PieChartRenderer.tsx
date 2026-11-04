import type { FC } from "react";
import { lazy, Suspense, useMemo } from "react";
import type { Data } from "plotly.js";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { getAxisTitle, parseChartAxis } from "../../../types/chartAxisConfig";
import { useRadialChartPreviewSeries } from "../../../hooks/useMockPlotData";
import { buildCircularChartColors } from "./circularChartUtils";
import type { RadialChartRendererProps } from "./chartRendererProps";
import { useChartThemeColors } from "./useChartThemeColors";

const Plot = lazy(() => import("./PlotlyBasic"));

const PieChartRenderer: FC<VdabCanvasRendererProps> = ({ component, theme }) => {
  const chartColors = useChartThemeColors();
  const raw = component.props as RadialChartRendererProps;
  const categoryAxis = parseChartAxis(raw.category);
  const valueAxis = parseChartAxis(raw.value);
  const title = raw.title || "Pie Chart";
  const seriesColor = raw.seriesColor || "#1f77b4";
  const categoryTitle = getAxisTitle(categoryAxis, "pie-category");
  const valueTitle = getAxisTitle(valueAxis, "pie-value");
  const titleColor = theme.textColor;
  const hasConfig = Boolean(
    categoryAxis.field &&
      categoryAxis.field.length > 0 &&
      valueAxis.field &&
      valueAxis.field.length > 0,
  );

  const previewSeedKey = `${component.id}|pie|${categoryAxis.field}|${categoryAxis.scaleType}|${categoryAxis.transform}|${valueAxis.field}|${valueAxis.scaleType}|${valueAxis.transform}`;

  const { loading: previewLoading, data: previewRadial } =
    useRadialChartPreviewSeries(hasConfig, previewSeedKey, categoryAxis);

  const plotData: Data[] = useMemo(
    () => [
      {
        type: "pie",
        labels: previewRadial?.labels ?? [],
        values: previewRadial?.values ?? [],
        marker: {
          colors: buildCircularChartColors(seriesColor),
        },
        textinfo: "label",
        hovertemplate: "%{label}: %{value}<extra></extra>",
        sort: false,
        direction: "clockwise",
      },
    ],
    [previewRadial, seriesColor],
  );

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
          deployed app aggregates {valueAxis.transform}({valueTitle}) by{" "}
          {categoryTitle}.
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
                margin: { t: 20, r: 20, b: 20, l: 20 },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                font: { color: chartColors.axisText },
                showlegend: true,
                legend: {
                  orientation: "h",
                  y: -0.12,
                  x: 0,
                  font: {
                    color: chartColors.legendText,
                  },
                },
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
            Configure Category and Value to render this chart
          </div>
        )}
      </div>
    </div>
  );
};

export default PieChartRenderer;
