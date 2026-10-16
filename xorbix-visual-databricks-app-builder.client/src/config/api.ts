// API base URL.
// - Deployed builds use a same-origin (relative) base so a single build artifact can be promoted across
//   dev/stg/prd unchanged — the SPA is co-hosted with the API and calls its own origin.
// - When running the Vite dev server (where the SPA and API are on different ports), the explicit local API
//   URL is used (injected by the Aspire AppHost, falling back to localhost).
const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE_URL || "http://localhost:7023"
  : "";

/**
 * Databricks OAuth redirect URI, derived from the current origin at runtime.
 *
 * Resolving this at runtime (instead of baking VITE_REDIRECT_URL into the build) lets one build artifact be
 * promoted across environments unchanged. The SPA is always served from the same origin that hosts the API,
 * so `window.location.origin` is the correct, environment-appropriate redirect host. Every origin that signs
 * in to Databricks must have its `/callback` registered in the Databricks App Connection.
 */
const getDatabricksRedirectUri = (): string => `${window.location.origin}/callback`;

export { API_BASE_URL, getDatabricksRedirectUri };
