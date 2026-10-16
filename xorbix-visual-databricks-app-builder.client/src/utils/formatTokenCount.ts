/**
 * Formats token counts for compact display (e.g. 10000 -> "10k").
 * Uses floor rounding so labels never round up before the next tier is reached.
 */
export function formatTokenCount(value: number): string {
  if (value >= 1_000_000) {
    const scaledMillions = Math.floor((value / 1_000_000) * 10) / 10;
    return Number.isInteger(scaledMillions)
      ? `${scaledMillions}M`
      : `${scaledMillions.toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (value >= 1_000) {
    const scaledThousands = Math.floor((value / 1_000) * 10) / 10;
    return Number.isInteger(scaledThousands)
      ? `${scaledThousands}k`
      : `${scaledThousands.toFixed(1).replace(/\.0$/, "")}k`;
  }

  return String(value);
}
