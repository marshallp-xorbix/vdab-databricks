/** Default editable Python file used by new standalone projects. */
export const DEFAULT_CUSTOM_MODULES_SOURCE = `# VDAB custom Python helpers.
# Use Call Custom Module actions to invoke top-level functions defined here.
# Each function receives ctx with get_value, set_value, and set_label methods.
`;

/** Custom module source is versioned with the rest of its project. */
export interface ProjectCustomModulesDocument {
  projectId: string;
  version: number;
  source: string;
}

/** Complete replacement request for the project's custom Python module file. */
export interface ProjectCustomModulesInput {
  expectedVersion: number;
  source: string;
}
