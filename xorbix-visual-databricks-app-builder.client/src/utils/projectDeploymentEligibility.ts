import type {
  IProjectDeploymentReadiness,
  IWorkspaceAppDeploymentTarget,
  IWorkspaceSecretResourceSelection,
} from "../models/ProjectDeployments";

const APP_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/;

interface IProjectDeploymentEligibilityInput {
  appName: string;
  canEdit: boolean | undefined;
  hasUnsavedChanges: boolean;
  isLinkedTarget: boolean;
  confirmOverwrite: boolean;
  isPending: boolean;
  readiness: IProjectDeploymentReadiness | undefined;
  readinessIsError: boolean;
  target: IWorkspaceAppDeploymentTarget | null;
  targetIsPending: boolean;
  targetIsError: boolean;
  secretResources: IWorkspaceSecretResourceSelection[];
}

interface IProjectDeploymentEligibility {
  missingScopes: string[];
  hasBlocker: boolean;
  canStart: boolean;
}

/** Computes whether the current target and saved project are safe to deploy. */
export function getProjectDeploymentEligibility(
  input: IProjectDeploymentEligibilityInput,
): IProjectDeploymentEligibility {
  const requiredScopes = input.readiness?.userApiScopes ?? [];
  const missingScopes = input.target
    ? requiredScopes.filter(
        (scope) => !input.target?.userApiScopes.includes(scope),
      )
    : [];
  const hasBlocker = (input.readiness?.blockers.length ?? 0) > 0;
  const targetValidated = Boolean(
    input.appName &&
      !input.targetIsPending &&
      !input.targetIsError &&
      (input.isLinkedTarget ? input.target : !input.target),
  );
  const secretSelectionIsValid = input.isLinkedTarget
    ? Boolean(
        input.target &&
          hasCompleteSecretSelection(input.target, input.secretResources),
      )
    : input.secretResources.every(isValidNewSecretSelection);

  return {
    missingScopes,
    hasBlocker,
    canStart: Boolean(
      input.canEdit &&
        !input.hasUnsavedChanges &&
        !input.isPending &&
        secretSelectionIsValid &&
        input.readiness &&
        !input.readinessIsError &&
        !hasBlocker &&
        APP_NAME_PATTERN.test(input.appName) &&
        targetValidated &&
        (!input.isLinkedTarget || input.confirmOverwrite) &&
        (!input.isLinkedTarget ||
          (input.target &&
            !input.target.usesGitSource &&
            missingScopes.length === 0)),
    ),
  };
}

function isValidNewSecretSelection(
  selection: IWorkspaceSecretResourceSelection,
): boolean {
  return (
    /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(selection.name) &&
    isValidSecretIdentifier(selection.scope) &&
    isValidSecretIdentifier(selection.key)
  );
}

function isValidSecretIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function hasCompleteSecretSelection(
  target: IWorkspaceAppDeploymentTarget,
  selections: IWorkspaceSecretResourceSelection[],
): boolean {
  const selectedResources = selections;
  return (
    selectedResources.length === target.secretResources.length &&
    target.secretResources.every(
      (resource) =>
        resource.secret.permission === "READ" &&
        selectedResources.some(
          (selection) =>
            selection.name === resource.name &&
            selection.scope === resource.secret.scope &&
            selection.key === resource.secret.key,
        ),
    )
  );
}
