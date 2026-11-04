/** Formats persisted UTC project timestamps for the current viewer. */
export function formatProjectDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

/** Narrows the settings query value to an implemented settings tab. */
export function readSettingsTab(value: string | null): string {
  return value === "theme" || value === "resources" || value === "permissions"
    ? value
    : "details";
}

/** Reads the initial deployment mode from the wizard's navigation hint. */
export function readDeploymentMode(
  value: string | null,
): "createNew" | "linkExisting" {
  return value === "linkExisting" ? "linkExisting" : "createNew";
}

/** Selects the AI panel only for its explicit URL value. */
export function readWorkflowTool(value: string | null): "workflow" | "ai" {
  return value === "ai" ? "ai" : "workflow";
}
