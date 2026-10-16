import type { ChartAxisConfig } from "../../../types/chartAxisConfig";

interface BaseChartRendererProps {
  title?: string;
  seriesColor?: string;
}

export interface CartesianChartRendererProps extends BaseChartRendererProps {
  xAxis?: ChartAxisConfig;
  yAxis?: ChartAxisConfig;
}

export interface RadialChartRendererProps extends BaseChartRendererProps {
  category?: ChartAxisConfig;
  value?: ChartAxisConfig;
}
