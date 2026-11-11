/**
 * Python that normalizes Databricks Apps DATABRICKS_HOST values.
 * Apps may inject a host without an https:// scheme; the Node runtime already
 * normalizes that case, and generated child apps must do the same.
 */
export const WORKSPACE_HOST_NORMALIZE_PYTHON = [
  "workspace_host = os.environ.get('DATABRICKS_HOST', '').strip()",
  "if workspace_host and not re.match(r'^[A-Za-z][A-Za-z0-9+.-]*://', workspace_host):",
  "    workspace_host = f'https://{workspace_host}'",
] as const;

/** Same normalize for a custom Python variable name. */
export function workspaceHostNormalizePython(variableName: string): readonly string[] {
  return [
    `${variableName} = os.environ.get('DATABRICKS_HOST', '').strip()`,
    `if ${variableName} and not re.match(r'^[A-Za-z][A-Za-z0-9+.-]*://', ${variableName}):`,
    `    ${variableName} = f'https://{${variableName}}'`,
  ];
}
