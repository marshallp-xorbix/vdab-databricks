/** Normalizes Databricks Apps hosts, which may omit the HTTPS scheme. */
export function normalizeWorkspaceHost(workspaceHost: string): string {
  const value = workspaceHost.trim();
  const hasScheme = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value);
  if (!value || (!hasScheme && /[/?#]/.test(value))) {
    throw invalidWorkspaceHost();
  }

  let parsedHost: URL;
  try {
    parsedHost = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    throw invalidWorkspaceHost();
  }

  if (
    parsedHost.protocol !== "https:" ||
    parsedHost.username ||
    parsedHost.password ||
    parsedHost.pathname !== "/" ||
    parsedHost.search ||
    parsedHost.hash
  ) {
    throw invalidWorkspaceHost();
  }

  return parsedHost.origin;
}

function invalidWorkspaceHost(): Error {
  return new Error("DATABRICKS_HOST must be an HTTPS workspace origin.");
}
