const SECRET_ENVIRONMENT_PREFIX = "VDAB_SECRET_";

/** Returns the runtime environment variable assigned to one App secret key. */
export function getProjectDeploymentSecretEnvironmentVariable(
  resourceName: string,
): string {
  return `${SECRET_ENVIRONMENT_PREFIX}${resourceName.toUpperCase().replaceAll("-", "_")}`;
}
