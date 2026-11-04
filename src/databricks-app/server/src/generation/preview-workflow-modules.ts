import { ApplicationError } from "../application-error.ts";
import type { ProjectWorkflowDefinition, ProjectWorkflowNode } from "../db/project-workflow-contract.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "./custom-modules-template.ts";
import { PREBUILT_MODULES_LIBRARY_SOURCE } from "./prebuilt-modules-library.ts";

export interface WorkflowModuleFiles {
  customModulesSource: string | null;
  prebuiltModulesLibrarySource: string | null;
}

interface PythonFunctionSignature {
  parameterNames: string[];
  acceptsContextOnlyCall: boolean;
}

/** Validates module action references and returns only the child files needed. */
export function resolveWorkflowModuleFiles(
  workflow: ProjectWorkflowDefinition,
  customModulesSource = DEFAULT_CUSTOM_MODULES_SOURCE,
  prebuiltModulesLibrarySource = PREBUILT_MODULES_LIBRARY_SOURCE,
): WorkflowModuleFiles {
  const nodes = workflow.workflows.flatMap((definition) => definition.nodes);
  const customModuleNodes = nodes.filter((node) => node.actionType === "callCustomModule");
  const prebuiltModuleNodes = nodes.filter((node) => node.actionType === "callPrebuiltModule");

  if (customModuleNodes.length > 0) {
    validateModuleActions(customModuleNodes, customModulesSource, "customModules");
  }
  if (prebuiltModuleNodes.length > 0) {
    validateModuleActions(prebuiltModuleNodes, prebuiltModulesLibrarySource, "prebuiltModulesLibrary");
  }

  return {
    customModulesSource: customModuleNodes.length > 0 || customModulesSource !== DEFAULT_CUSTOM_MODULES_SOURCE
      ? normalizeModuleSource(customModulesSource)
      : null,
    prebuiltModulesLibrarySource: prebuiltModuleNodes.length > 0
      ? normalizeModuleSource(prebuiltModulesLibrarySource)
      : null,
  };
}

function validateModuleActions(
  nodes: ProjectWorkflowNode[],
  source: string,
  sourceName: string,
): void {
  const functions = readTopLevelFunctions(source);
  for (const node of nodes) {
    const functionName = readFunctionName(node);
    const signature = functions.get(functionName);
    if (
      signature === undefined ||
      signature.parameterNames[0] !== "ctx" ||
      (node.actionType === "callCustomModule" && !signature.acceptsContextOnlyCall)
    ) {
      throw invalidModule(`Workflow action '${node.id}' references a missing or incompatible ${sourceName} function.`);
    }
    if (node.actionType === "callPrebuiltModule") {
      const namedArguments = node.params.namedArguments;
      if (!isRecord(namedArguments)) {
        throw invalidModule(`Workflow action '${node.id}' has invalid prebuilt module arguments.`);
      }
      const expectedArguments = signature.parameterNames.slice(1);
      const actualArguments = Object.keys(namedArguments);
      if (
        expectedArguments.length !== actualArguments.length ||
        expectedArguments.some((name) => !Object.hasOwn(namedArguments, name))
      ) {
        throw invalidModule(`Workflow action '${node.id}' does not match the selected prebuilt module parameters.`);
      }
    }
  }
}

function readFunctionName(node: ProjectWorkflowNode): string {
  const value = node.params.functionName;
  return typeof value === "string" ? value : "";
}

/** Reads top-level synchronous functions supported by generated workflow calls. */
function readTopLevelFunctions(source: string): Map<string, PythonFunctionSignature> {
  const functions = new Map<string, PythonFunctionSignature>();
  const codeMask = maskPythonCommentsAndStrings(source);
  const declarationPattern = /^def[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*\(/gm;

  for (const match of codeMask.matchAll(declarationPattern)) {
    const declarationStart = match.index;
    const name = match[1];
    const openingIndex = declarationStart + match[0].lastIndexOf("(");
    if (name === undefined) continue;

    const closingIndex = findClosingParenthesis(source, openingIndex);
    if (closingIndex === null) continue;
    if (findHeaderColon(source, closingIndex + 1) === null) continue;

    const parameters = source.slice(openingIndex + 1, closingIndex);
    const parameterSources = splitParameterSources(parameters);
    functions.set(name, {
      parameterNames: parameterSources
        .filter((parameter) => parameter !== "/" && parameter !== "*")
        .map(readParameterName),
      acceptsContextOnlyCall: acceptsContextOnlyCall(parameterSources),
    });
  }
  return functions;
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

function findHeaderColon(source: string, startIndex: number): number | null {
  let depth = 0;
  let quote: string | null = null;
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

function findClosingParenthesis(source: string, openingIndex: number): number | null {
  let depth = 0;
  let quote: string | null = null;
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
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

function splitParameterSources(source: string): string[] {
  if (source.trim() === "") return [];
  const parameters: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: string | null = null;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
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
      continue;
    }
    if (character === "(" || character === "[" || character === "{") depth += 1;
    if (character === ")" || character === "]" || character === "}") depth -= 1;
    if (character === "," && depth === 0) {
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

function hasDefaultValue(parameter: string): boolean {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  for (let index = 0; index < parameter.length; index += 1) {
    const character = parameter[index];
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
      continue;
    }
    if (character === "(" || character === "[" || character === "{") depth += 1;
    if (character === ")" || character === "]" || character === "}") depth -= 1;
    if (
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

function readParameterName(source: string): string {
  const firstPart = source.trim().split(/[=:]/, 1)[0]?.trim() ?? "";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(firstPart)) return "";
  return firstPart;
}

function normalizeModuleSource(source: string): string {
  return source.trimEnd() + "\n";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidModule(detail: string): ApplicationError {
  return new ApplicationError(422, "preview_workflow_module_invalid", "Workflow module is invalid", detail);
}
