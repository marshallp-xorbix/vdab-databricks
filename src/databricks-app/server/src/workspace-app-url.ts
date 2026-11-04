import { ApplicationError } from "./application-error.ts";

const DATABRICKS_APPS_DOMAIN_SUFFIX = ".databricksapps.com";

/** Accepts only a Databricks-hosted HTTPS runtime URL for the returned App. */
export function readWorkspaceAppUrl(
  appName: string,
  value: unknown,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      if (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        !url.search &&
        !url.hash &&
        (url.pathname === "/" || url.pathname === "") &&
        url.hostname.startsWith(`${appName}-`) &&
        url.hostname.endsWith(DATABRICKS_APPS_DOMAIN_SUFFIX)
      )
        return url.origin;
    } catch {
      /* Invalid workspace metadata is mapped to a typed upstream error below. */
    }
  }
  throw new ApplicationError(
    502,
    "databricks_invalid_response",
    "Invalid App URL",
    "Databricks returned an invalid runtime URL for this App.",
  );
}
