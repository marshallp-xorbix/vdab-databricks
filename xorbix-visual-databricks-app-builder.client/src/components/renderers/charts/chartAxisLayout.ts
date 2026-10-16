import type { LayoutAxis } from "plotly.js";
import type { ChartThemeColors } from "./chartRendererStyles";

export function buildChartAxisLayout(
  title: string,
  colors: ChartThemeColors,
  axisType?: "linear" | "category",
): Partial<LayoutAxis> {
  return {
    title: {
      text: title,
      standoff: 12,
      font: { color: colors.axisText },
    },
    type: axisType,
    automargin: true,
    color: colors.axisText,
    tickfont: { color: colors.axisText },
    linecolor: colors.axisLine,
    gridcolor: colors.grid,
    zerolinecolor: colors.grid,
  };
}
