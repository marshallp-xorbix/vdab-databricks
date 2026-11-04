export interface PrebuiltModuleFunctionOption {
  functionName: string;
  signature: string;
  /** Parameters after `ctx`, in definition order. */
  parameterNames: string[];
}

const FUNCTION_DEF_PATTERN = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/;

function splitTopLevelArgs(argsSection: string): string[] {
  const trimmed = argsSection.trim();
  if (!trimmed) {
    return [];
  }

  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < trimmed.length; index++) {
    const c = trimmed[index];
    if (c === "(" || c === "[" || c === "{") {
      depth++;
    } else if (c === ")" || c === "]" || c === "}") {
      depth = Math.max(0, depth - 1);
    } else if (c === "," && depth === 0) {
      parts.push(trimmed.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(trimmed.slice(start));
  return parts;
}

function getParameterName(segment: string): string | null {
  const trimmed = segment.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("*")) {
    return null;
  }

  let head = trimmed;
  const equalsIndex = head.indexOf("=");
  if (equalsIndex >= 0) {
    head = head.slice(0, equalsIndex).trim();
  }

  const colonIndex = head.indexOf(":");
  if (colonIndex >= 0) {
    head = head.slice(0, colonIndex).trim();
  }

  const spaceIndex = head.indexOf(" ");
  if (spaceIndex >= 0) {
    head = head.slice(0, spaceIndex).trim();
  }

  if (!head || head === "self") {
    return null;
  }

  return head;
}

/**
 * Parses top-level `def` lines from `prebuilt_modules_library.py`.
 * Only includes functions whose first parameter is exactly `ctx`.
 */
export const parsePrebuiltModuleFunctionOptions = (
  source: string,
): PrebuiltModuleFunctionOption[] => {
  const lines = source.split(/\r?\n/);
  const seen = new Set<string>();
  const functions: PrebuiltModuleFunctionOption[] = [];

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

    const rawParams = splitTopLevelArgs(args);
    if (rawParams.length === 0) {
      return;
    }

    const firstName = getParameterName(rawParams[0]);
    if (firstName !== "ctx") {
      return;
    }

    const parameterNames: string[] = [];
    for (let i = 1; i < rawParams.length; i++) {
      const name = getParameterName(rawParams[i]);
      if (name == null) {
        return;
      }

      parameterNames.push(name);
    }

    seen.add(functionName);
    functions.push({
      functionName,
      signature: `${functionName}(${args})`,
      parameterNames,
    });
  });

  return functions;
};
