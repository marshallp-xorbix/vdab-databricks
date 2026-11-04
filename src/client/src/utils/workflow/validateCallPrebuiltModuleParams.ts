import { isWorkflowActionNode } from "../../types/workflow";
import type { WorkflowNode } from "../../types/workflow";
import { parsePrebuiltModuleFunctionOptions } from "./parsePrebuiltModuleFunctionOptions";
import { getCallCustomModuleFunctionNameErrors } from "./validateCallCustomModuleParams";

export const validateCallPrebuiltModuleNode = (
  node: WorkflowNode,
  prebuiltModulesLibrarySource: string,
): string[] => {
  if (!isWorkflowActionNode(node, "CallPrebuiltModule")) {
    return [];
  }

  const errors: string[] = [
    ...getCallCustomModuleFunctionNameErrors(node.params.functionName),
  ];

  const trimmedSource = prebuiltModulesLibrarySource.trim();
  if (!trimmedSource) {
    errors.push("Prebuilt modules library is not loaded yet.");
    return errors;
  }

  const options = parsePrebuiltModuleFunctionOptions(trimmedSource);
  const selected = options.find(
    (o) => o.functionName === node.params.functionName.trim(),
  );

  if (node.params.functionName.trim() && !selected) {
    errors.push(
      `Function "${node.params.functionName.trim()}" was not found in prebuilt_modules_library.py (requires ctx as first parameter).`,
    );
    return errors;
  }

  if (!selected) {
    return errors;
  }

  const expected = new Set(selected.parameterNames);
  for (const key of Object.keys(node.params.namedArguments)) {
    if (!expected.has(key)) {
      errors.push(`Unknown argument "${key}" for ${selected.functionName}.`);
    }
  }

  for (const name of selected.parameterNames) {
    if (!(name in node.params.namedArguments)) {
      errors.push(`Missing argument "${name}" for ${selected.functionName}.`);
    }
  }

  return errors;
};
