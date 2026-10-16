export interface CustomModuleFunctionOption {
  functionName: string;
  signature: string;
}

const FUNCTION_DEF_PATTERN = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/;

/**
 * Parses top-level python function definitions from custom_modules.py.
 * Ignores blank/commented lines and skips indented definitions.
 */
export const parseCustomModuleFunctionOptions = (
  source: string,
): CustomModuleFunctionOption[] => {
  const lines = source.split(/\r?\n/);
  const seen = new Set<string>();
  const functions: CustomModuleFunctionOption[] = [];

  lines.forEach((line) => {
    const trimmedStart = line.trimStart();
    if (!trimmedStart || trimmedStart.startsWith("#")) {
      return;
    }

    const match = trimmedStart.match(FUNCTION_DEF_PATTERN);
    if (!match) {
      return;
    }

    const functionName = match[1];
    const args = match[2]?.trim() ?? "";
    if (!functionName || seen.has(functionName)) {
      return;
    }

    seen.add(functionName);
    functions.push({
      functionName,
      signature: `${functionName}(${args})`,
    });
  });

  return functions;
};
