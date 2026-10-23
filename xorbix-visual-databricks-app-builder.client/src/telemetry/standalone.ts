/** No-op telemetry adapter for the standalone Databricks App build. */
export const reactPlugin = null;

/** Accepts the legacy initialization call without starting SaaS telemetry. */
export function initTelemetry(_connectionString?: string | null): void {
  void _connectionString;
}

/** Ignores legacy identity metadata in the standalone product. */
export function setAuthenticatedUser(
  _userId: string,
  _accountId?: string,
): void {
  void _userId;
  void _accountId;
}

/** Clears no identity state because standalone telemetry is disabled. */
export function clearAuthenticatedUser(): void {}

/** Ignores legacy event tracking in the standalone product. */
export function trackEvent(
  _name: string,
  _properties?: Record<string, string>,
  _measurements?: Record<string, number>,
): void {
  void _name;
  void _properties;
  void _measurements;
}

/** Ignores legacy dependency tracking in the standalone product. */
export function trackDependency(_options: {
  name: string;
  target: string;
  duration: number;
  success: boolean;
  resultCode?: number;
  data?: string;
  properties?: Record<string, string>;
}): void {
  void _options;
}

/** Ignores legacy exception tracking in the standalone product. */
export function trackException(
  _error: unknown,
  _properties?: Record<string, string>,
): void {
  void _error;
  void _properties;
}

/** Ignores legacy metric tracking in the standalone product. */
export function trackMetric(
  _name: string,
  _value: number,
  _properties?: Record<string, string>,
): void {
  void _name;
  void _value;
  void _properties;
}

/** Ignores legacy trace tracking in the standalone product. */
export function trackTrace(
  _message: string,
  _severity?: "Verbose" | "Information" | "Warning" | "Error" | "Critical",
  _properties?: Record<string, string>,
): void {
  void _message;
  void _severity;
  void _properties;
}

/** Flushes no queue because standalone telemetry is disabled. */
export function flushTelemetry(): void {}
