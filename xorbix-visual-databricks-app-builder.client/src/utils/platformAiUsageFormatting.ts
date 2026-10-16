export const PLATFORM_AI_USAGE_PERCENT_ORANGE_THRESHOLD = 50;

export const PLATFORM_AI_USAGE_PERCENT_RED_THRESHOLD = 85;

export function getPlatformAiUsageProgressClass(percentUsed: number): string {
  if (percentUsed >= PLATFORM_AI_USAGE_PERCENT_RED_THRESHOLD) {
    return "bg-destructive";
  }

  if (percentUsed >= PLATFORM_AI_USAGE_PERCENT_ORANGE_THRESHOLD) {
    return "bg-warning";
  }

  return "bg-success";
}

export function formatPlatformAiResetDate(resetsAtUtc: string): string {
  const date = new Date(resetsAtUtc);
  if (Number.isNaN(date.getTime())) {
    return "next month";
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
