import React from "react";
import ReactDOM from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { API_BASE_URL } from "./config/api";
import { initTelemetry } from "./telemetry";

interface IClientConfig {
  applicationInsightsConnectionString?: string | null;
}

// Load per-environment runtime configuration from the API and start telemetry. This is fire-and-forget so it
// never blocks hydration; the telemetry helpers no-op safely until initialization completes. Fetching the
// Application Insights connection string at runtime (rather than baking it into the build) is what lets one
// build artifact be promoted across dev/stg/prd unchanged.
if (import.meta.env.VITE_VDAB_RUNTIME === "databricks") {
  initTelemetry(undefined);
} else {
  fetch(`${API_BASE_URL}/api/config`)
    .then((response) =>
      response.ok ? (response.json() as Promise<IClientConfig>) : null,
    )
    .then((config) => initTelemetry(config?.applicationInsightsConnectionString))
    .catch(() => initTelemetry(undefined));
}

ReactDOM.hydrateRoot(
  document,
  <React.StrictMode>
    <HydratedRouter />
  </React.StrictMode>,
);
