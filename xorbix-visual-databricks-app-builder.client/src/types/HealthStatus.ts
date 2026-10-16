export const HEALTH_STATUS = {
  Healthy: "Healthy",
  Degraded: "Degraded",
  Unhealthy: "Unhealthy",
} as const;

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];
