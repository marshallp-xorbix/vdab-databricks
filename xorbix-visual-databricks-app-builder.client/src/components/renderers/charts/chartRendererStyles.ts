/**
 * Plotly axis / legend colors resolved from CSS theme tokens.
 * Prefer calling via {@link useChartThemeColors} so charts re-render on theme change.
 */

export interface ChartThemeColors {
  axisText: string;
  axisLine: string;
  grid: string;
  legendText: string;
}

const LIGHT_FALLBACK: ChartThemeColors = {
  axisText: "#6e6e6e",
  axisLine: "#d5d7db",
  grid: "#e7e9ee",
  legendText: "#6e6e6e",
};

function readCssVar(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

/**
 * Reads chart chrome colors from the document theme tokens.
 */
export function readChartThemeColors(): ChartThemeColors {
  if (typeof document === "undefined") {
    return LIGHT_FALLBACK;
  }

  const styles = getComputedStyle(document.documentElement);
  return {
    axisText:
      readCssVar(styles, "--chart-axis-text") || LIGHT_FALLBACK.axisText,
    axisLine:
      readCssVar(styles, "--chart-axis-line") || LIGHT_FALLBACK.axisLine,
    grid: readCssVar(styles, "--chart-grid") || LIGHT_FALLBACK.grid,
    legendText:
      readCssVar(styles, "--chart-legend-text") || LIGHT_FALLBACK.legendText,
  };
}
