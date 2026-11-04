import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import type { IProjectComponent } from "../models/ProjectComponents";

/** Removes workflows whose triggers or action parameters reference deleted components. */
export function removeWorkflowsForProjectComponents(
  workflow: IProjectWorkflowDefinition,
  removedComponents: IProjectComponent[],
): IProjectWorkflowDefinition {
  const removedKeys = new Set(
    removedComponents.map((component) => component.key),
  );
  const removedCodeNames = new Set(
    removedComponents
      .map((component) => component.codeName?.trim().toLowerCase())
      .filter((codeName): codeName is string => Boolean(codeName)),
  );
  if (removedKeys.size === 0) {
    return workflow;
  }

  const workflows = workflow.workflows.filter((candidate) => {
    if (removedKeys.has(candidate.trigger.componentKey)) {
      return false;
    }

    return !containsRemovedCodeName(candidate.nodes, removedCodeNames);
  });
  return workflows.length === workflow.workflows.length
    ? workflow
    : { ...workflow, workflows };
}

function containsRemovedCodeName(
  value: unknown,
  removedCodeNames: ReadonlySet<string>,
): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) =>
      containsRemovedCodeName(entry, removedCodeNames),
    );
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.entries(value).some(([propertyName, propertyValue]) => {
    if (
      propertyName === "componentCodeName" &&
      typeof propertyValue === "string" &&
      removedCodeNames.has(propertyValue.trim().toLowerCase())
    ) {
      return true;
    }

    return containsRemovedCodeName(propertyValue, removedCodeNames);
  });
}
