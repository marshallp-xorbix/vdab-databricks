/** Builds Databricks Apps environment variable names from resource keys (SaaS parity). */
export function appResourceEnvironmentVariableName(
  prefix: string,
  resourceKey: string,
): string {
  const suffix = toEnvironmentSuffix(resourceKey);
  return `${prefix}_${suffix}`;
}

export function genieSpaceEnvironmentVariableName(resourceKey: string): string {
  return appResourceEnvironmentVariableName("GENIE_SPACE", resourceKey);
}

export function servingEndpointEnvironmentVariableName(
  resourceKey: string,
): string {
  return appResourceEnvironmentVariableName("SERVING_ENDPOINT", resourceKey);
}

function toEnvironmentSuffix(resourceKey: string): string {
  const trimmed = resourceKey.trim();
  if (trimmed.length === 0) return "UNBOUND";
  let result = "";
  let lastUnderscore = false;
  for (const character of trimmed) {
    if (/[A-Za-z0-9]/.test(character)) {
      result += character.toUpperCase();
      lastUnderscore = false;
      continue;
    }
    if (result.length > 0 && !lastUnderscore) {
      result += "_";
      lastUnderscore = true;
    }
  }
  result = result.replace(/_+$/, "");
  return result.length > 0 ? result : "RESOURCE";
}
