import { ReactPlugin } from "@microsoft/applicationinsights-react-js";
import {
  ApplicationInsights,
  SeverityLevel,
} from "@microsoft/applicationinsights-web";

/**
 * Application Insights telemetry service for frontend logging.
 *
 * Call {@link initTelemetry} once at startup with the connection string resolved at RUNTIME from the API
 * (`/api/config`). When no connection string is available **and** the app is running in dev mode, telemetry is
 * still written to the browser console so local debugging works without any configuration.
 *
 * Resolving the connection string at runtime — rather than baking it into the build — lets a single build
 * artifact be promoted across dev/stg/prd unchanged. In production builds, console output from telemetry
 * helpers is suppressed entirely; data is sent silently to Application Insights.
 */

const isDevMode = import.meta.env.DEV === true;

/** React integration plugin — pass this to `<AppInsightsContext.Provider>` if needed. */
export const reactPlugin = new ReactPlugin();

/**
 * Raw Application Insights instance, populated by {@link initTelemetry}. Module-private — use the public
 * helpers below for day-to-day use; they no-op safely before initialization completes.
 */
let appInsights: ApplicationInsights | null = null;

let telemetryInitialized = false;

/**
 * Initialize Application Insights with a connection string resolved at runtime. Safe to call once at app
 * startup; subsequent calls are ignored. When no connection string is supplied, telemetry stays console-only
 * (dev mode) or silent (production).
 *
 * @param connectionString The Application Insights connection string for the current environment, or
 *   null/undefined to leave cloud reporting disabled.
 */
export function initTelemetry(connectionString?: string | null): void {
  if (telemetryInitialized) {
    return;
  }
  telemetryInitialized = true;

  if (!connectionString) {
    if (isDevMode) {
      console.info(
        "[Telemetry] No Application Insights connection string — telemetry will be console-only",
      );
    }
    return;
  }

  const ai = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true,
      enableRequestHeaderTracking: true,
      enableResponseHeaderTracking: true,
      enableAjaxPerfTracking: true,
      enableCorsCorrelation: true,
      maxAjaxCallsPerView: -1, // unlimited
      disableFetchTracking: false,
      extensions: [reactPlugin],
    },
  });

  if (!import.meta.env.VITE_DISABLE_APP_INSIGHTS) {
    ai.loadAppInsights();
    ai.trackPageView();
    if (isDevMode) {
      console.info(
        "[Telemetry] Application Insights initialized with cloud reporting",
      );
    }
  }

  appInsights = ai;
}

// ─── Public Helpers ──────────────────────────────────────────────

/**
 * Set the authenticated user context so all subsequent telemetry is
 * correlated to this user in the Application Insights portal.
 * Call this after login; call `clearAuthenticatedUser()` on logout.
 */
export function setAuthenticatedUser(userId: string, accountId?: string): void {
  if (isDevMode) {
    console.info(`[Telemetry] Authenticated user set: ${userId}`);
  }
  appInsights?.setAuthenticatedUserContext(userId, accountId, true);
}

/**
 * Clear the authenticated user context (e.g. on logout).
 */
export function clearAuthenticatedUser(): void {
  if (isDevMode) {
    console.info("[Telemetry] Authenticated user cleared");
  }
  appInsights?.clearAuthenticatedUserContext();
}

/**
 * Track a named custom event with optional properties and measurements.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>,
): void {
  if (isDevMode) {
    console.info(`[Telemetry] Event: ${name}`, {
      ...properties,
      ...measurements,
    });
  }
  appInsights?.trackEvent({ name, properties, measurements });
}

/**
 * Track a dependency call (e.g. an API request) with duration.
 */
export function trackDependency(opts: {
  name: string;
  target: string;
  duration: number;
  success: boolean;
  resultCode?: number;
  data?: string;
  properties?: Record<string, string>;
}): void {
  if (isDevMode) {
    console.info(
      `[Telemetry] Dependency: ${opts.name} → ${opts.target} | ${opts.duration}ms | success=${opts.success}`,
      opts.properties,
    );
  }
  appInsights?.trackDependencyData({
    id: crypto.randomUUID(),
    name: opts.name,
    target: opts.target,
    duration: opts.duration,
    success: opts.success,
    responseCode: opts.resultCode ?? 0,
    type: "HTTP",
    data: opts.data,
    properties: opts.properties,
  });
}

/**
 * Track an exception with optional custom properties.
 */
export function trackException(
  error: unknown,
  properties?: Record<string, string>,
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (isDevMode) {
    console.error("[Telemetry] Exception:", err, properties);
  }
  appInsights?.trackException({ exception: err, properties });
}

/**
 * Track a performance metric with a named measurement.
 */
export function trackMetric(
  name: string,
  value: number,
  properties?: Record<string, string>,
): void {
  if (isDevMode) {
    console.info(`[Telemetry] Metric: ${name}=${value}`, properties);
  }
  appInsights?.trackMetric({ name, average: value, properties });
}

type TraceSeverity =
  | "Verbose"
  | "Information"
  | "Warning"
  | "Error"
  | "Critical";

const severityMap: Record<TraceSeverity, SeverityLevel> = {
  Verbose: SeverityLevel.Verbose,
  Information: SeverityLevel.Information,
  Warning: SeverityLevel.Warning,
  Error: SeverityLevel.Error,
  Critical: SeverityLevel.Critical,
};

/**
 * Track a trace / log message with optional severity and properties.
 */
export function trackTrace(
  message: string,
  severity: TraceSeverity = "Information",
  properties?: Record<string, string>,
): void {
  if (isDevMode) {
    console.info(`[Telemetry] Trace (${severity}): ${message}`, properties);
  }
  appInsights?.trackTrace({
    message,
    severityLevel: severityMap[severity],
    properties,
  });
}

/**
 * Flush pending telemetry. Call this before page unload if needed.
 */
export function flushTelemetry(): void {
  appInsights?.flush();
}
