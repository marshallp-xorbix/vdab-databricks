export interface CallCustomModuleParams {
  /** Top-level function name on the `custom_modules` Python module. */
  functionName: string;
}

/** Normalized return value from the custom module (dict or wrapped). */
export interface CallCustomModuleResult {
  output: Record<string, unknown>;
  status: "success" | "error";
  error?: string;
}
