import { useMemo } from "react";
import { useTheme } from "../../../context/ThemeContext";
import {
  readChartThemeColors,
  type ChartThemeColors,
} from "./chartRendererStyles";

/**
 * Chart colors that update when the product light/dark theme changes.
 */
export function useChartThemeColors(): ChartThemeColors {
  const { theme } = useTheme();
  // `theme` is a deliberate re-read trigger — readChartThemeColors() reads CSS vars from the DOM.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- theme forces memo refresh after setTheme
  return useMemo(() => readChartThemeColors(), [theme]);
}
