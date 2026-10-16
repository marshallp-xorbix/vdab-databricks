export interface CallPrebuiltModuleParams {
  functionName: string;
  /** Values for parameters after `ctx`; emitted as Python string literals. */
  namedArguments: Record<string, string>;
}
