export interface HealthCheck {
  name: string;
  status: string;
  description?: string | null;
  durationMs: number;
}

export interface HealthResponse {
  status: string;
  checks: HealthCheck[];
}
