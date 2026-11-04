export interface CustomModuleFunctionOption {
  functionName: string;
  signature: string;
}

interface PythonFunctionHeader {
  parameters: string;
}

/** Parses supported top-level Python functions callable with the workflow context. */
export const parseCustomModuleFunctionOptions = (
  source: string,
): CustomModuleFunctionOption[] => {
  const codeMask = maskPythonCommentsAndStrings(source);
  const declarationPattern = /^def[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*\(/gm;
  const seen = new Set<string>();
  const functions: CustomModuleFunctionOption[] = [];

  for (const match of codeMask.matchAll(declarationPattern)) {
    const declarationStart = match.index;
    const functionName = match[1];
    const openingIndex = declarationStart + match[0].lastIndexOf("(");
    if (functionName === undefined) continue;

    const header = readFunctionHeader(source, openingIndex);
    if (header === null || seen.has(functionName)) continue;

    const parameters = splitParameterSources(header.parameters);
    if (!acceptsContextOnlyCall(parameters)) continue;

    seen.add(functionName);
    functions.push({
      functionName,
      signature: `${functionName}(${formatParameters(header.parameters)})`,
    });
  }

  return functions;
};

function readFunctionHeader(
  source: string,
  openingIndex: number,
): PythonFunctionHeader | null {
  const closingIndex = findClosingParenthesis(source, openingIndex);
  if (closingIndex === null) return null;

  const colonIndex = findHeaderColon(source, closingIndex + 1);
  if (colonIndex === null) return null;

  return {
    parameters: source.slice(openingIndex + 1, closingIndex),
  };
}

function formatParameters(parameters: string): string {
  return parameters.replace(/\s+/g, " ").trim().replace(/,\s*$/, "");
}

function maskPythonCommentsAndStrings(source: string): string {
  const characters = source.split("");
  let quote: "'" | '"' | null = null;
  let tripleQuote = false;
  let inComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === undefined) continue;

    if (inComment) {
      if (character === "\n") {
        inComment = false;
      } else {
        characters[index] = " ";
      }
      continue;
    }

    if (quote !== null) {
      if (character !== "\n") characters[index] = " ";
      if (character === "\\") {
        index += 1;
        if (source[index] !== "\n" && source[index] !== undefined) {
          characters[index] = " ";
        }
      } else if (
        tripleQuote &&
        source[index] === quote &&
        source[index + 1] === quote
      ) {
        characters[index] = " ";
        characters[index + 1] = " ";
        characters[index + 2] = " ";
        index += 2;
        quote = null;
        tripleQuote = false;
      } else if (!tripleQuote && character === quote) {
        quote = null;
      } else if (!tripleQuote && character === "\n") {
        quote = null;
      }
      continue;
    }

    if (character === "#") {
      characters[index] = " ";
      inComment = true;
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      tripleQuote = source[index + 1] === character && source[index + 2] === character;
      characters[index] = " ";
      if (tripleQuote) {
        characters[index + 1] = " ";
        characters[index + 2] = " ";
        index += 2;
      }
    }
  }

  return characters.join("");
}

function findClosingParenthesis(source: string, openingIndex: number): number | null {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === undefined) continue;

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "#") {
      index = source.indexOf("\n", index);
      if (index < 0) return null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return null;
}

function findHeaderColon(source: string, startIndex: number): number | null {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === undefined) continue;

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "#") {
      index = source.indexOf("\n", index);
      if (index < 0) return null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "(" || character === "[" || character === "{") {
      depth += 1;
    } else if (character === ")" || character === "]" || character === "}") {
      depth -= 1;
    } else if (character === ":" && depth === 0) {
      return index;
    }
  }

  return null;
}

function splitParameterSources(source: string): string[] {
  const parameters: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === undefined) continue;

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "(" || character === "[" || character === "{") {
      depth += 1;
    } else if (character === ")" || character === "]" || character === "}") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      parameters.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  parameters.push(source.slice(start).trim());
  return parameters.filter((parameter) => parameter !== "");
}

function acceptsContextOnlyCall(parameters: string[]): boolean {
  const firstParameter = parameters[0];
  if (firstParameter === undefined || firstParameter.startsWith("*")) return false;
  if (readParameterName(firstParameter) !== "ctx") return false;

  return parameters.slice(1).every((parameter) =>
    parameter === "/" ||
    parameter === "*" ||
    parameter.startsWith("*") ||
    hasDefaultValue(parameter)
  );
}

function readParameterName(source: string): string {
  const firstPart = source.trim().split(/[=:]/, 1)[0]?.trim() ?? "";
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(firstPart) ? firstPart : "";
}

function hasDefaultValue(parameter: string): boolean {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = 0; index < parameter.length; index += 1) {
    const character = parameter[index];
    if (character === undefined) continue;

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "(" || character === "[" || character === "{") {
      depth += 1;
    } else if (character === ")" || character === "]" || character === "}") {
      depth -= 1;
    } else if (
      character === "=" &&
      depth === 0 &&
      parameter[index - 1] !== "=" &&
      parameter[index + 1] !== "="
    ) {
      return true;
    }
  }

  return false;
}
