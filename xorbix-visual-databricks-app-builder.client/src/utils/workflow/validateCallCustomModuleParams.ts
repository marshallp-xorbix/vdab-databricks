import { isWorkflowActionNode } from "../../types/workflow";
import type { WorkflowNode } from "../../types/workflow";

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Mirrors backend CustomModuleFunctionNameSyntax: public top-level Python identifier only.
 */
export const getCallCustomModuleFunctionNameErrors = (
  functionName: string,
): string[] => {
  const errors: string[] = [];
  const trimmed = functionName.trim();

  if (!trimmed) {
    errors.push("Function name is required.");
    return errors;
  }

  if (trimmed.startsWith("_")) {
    errors.push("Function name must not start with an underscore.");
  }

  if (trimmed.includes("__")) {
    errors.push("Function name must not contain double underscores.");
  }

  if (!IDENTIFIER_PATTERN.test(trimmed)) {
    errors.push(
      "Function name must be a valid Python identifier (letter, then letters, digits, or underscores).",
    );
  }

  return errors;
};

export const validateCallCustomModuleNode = (
  node: WorkflowNode,
): string[] => {
  if (!isWorkflowActionNode(node, "CallCustomModule")) {
    return [];
  }

  return getCallCustomModuleFunctionNameErrors(node.params.functionName);
};
