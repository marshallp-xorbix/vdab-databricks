import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import WorkflowBuilderView from "./AppBuilderComponents/AppCanvas/WorkflowBuilderView";
import { Button } from "./ui/button";
import { useProjectCustomModules } from "../hooks/useProjectCustomModules";
import { PREBUILT_MODULES_LIBRARY_SOURCE } from "../utils/prebuiltModulesLibrarySource";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import type { IComponentDefinition } from "../models/ComponentRegistry";
import {
  toPortableWorkflowDefinition,
  toWorkflowBuilderComponents,
  toWorkflowBuilderDefinition,
} from "../utils/projectWorkflowContractAdapter";

interface IProjectWorkflowEditorProps {
  projectId: string;
  components: IProjectComponent[];
  definitions: IComponentDefinition[];
  workflow: IProjectWorkflowDefinition;
  isDirty: boolean;
  isSaving: boolean;
  isDisabled: boolean;
  saveError: string | null;
  onWorkflowChange: (workflow: IProjectWorkflowDefinition) => void;
  onReload: () => void;
  onCustomModulesDirtyChange: (isDirty: boolean) => void;
  customModulesSource: string;
  hasLoadedCustomModulesSource: boolean;
  onCustomModulesSourceChange: (source: string) => void;
}

/** Hosts the visual workflow editor for a project. */
function ProjectWorkflowEditor({
  projectId,
  components,
  definitions,
  workflow,
  isDirty,
  isSaving,
  isDisabled,
  saveError,
  onWorkflowChange,
  onReload,
  onCustomModulesDirtyChange,
  customModulesSource,
  hasLoadedCustomModulesSource,
  onCustomModulesSourceChange,
}: Readonly<IProjectWorkflowEditorProps>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedWorkflow = searchParams.get("workflowFocus");
  const focusedAction = searchParams.get("actionFocus");
  const focusRequest = useMemo(
    () =>
      focusedWorkflow
        ? {
            workflowCodeName: focusedWorkflow,
            ...(focusedAction ? { nodeId: focusedAction } : {}),
          }
        : null,
    [focusedWorkflow, focusedAction],
  );
  const customModulesQuery = useProjectCustomModules(projectId);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const customModulesDocument = customModulesQuery.data;
  const isCustomModulesDirty = Boolean(
    customModulesDocument &&
      loadedProjectId === projectId &&
      customModulesSource !== customModulesDocument.source,
  );
  const workflowIsDisabled = isDisabled;

  useEffect(() => {
    if (
      customModulesDocument &&
      customModulesDocument.projectId === projectId &&
      loadedProjectId !== projectId
    ) {
      if (!hasLoadedCustomModulesSource) {
        onCustomModulesSourceChange(customModulesDocument.source);
      }
      setLoadedProjectId(projectId);
    }
  }, [
    customModulesDocument,
    hasLoadedCustomModulesSource,
    loadedProjectId,
    onCustomModulesSourceChange,
    projectId,
  ]);

  useEffect(() => {
    onCustomModulesDirtyChange(isCustomModulesDirty);
  }, [isCustomModulesDirty, onCustomModulesDirtyChange]);

  const editorComponents = toWorkflowBuilderComponents(components, definitions);
  const editorWorkflow = toWorkflowBuilderDefinition(workflow, components);

  return (
    <section aria-label="Workflows" className="flex h-full min-h-0 flex-col overflow-hidden">
      {saveError && (
        <div
          role="alert"
          className="grid gap-2 rounded-md border border-destructive/30 p-3"
        >
          <p>{saveError}</p>
          <div>
            <Button type="button" variant="outline" onClick={onReload}>
              Reload latest workflows
            </Button>
          </div>
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {isDirty
          ? "Workflow changes are not saved."
          : isSaving
            ? "Saving workflows…"
            : "Workflows saved."}
      </p>

      <div
        aria-disabled={workflowIsDisabled}
        className={`min-h-0 flex-1 overflow-hidden ${
          workflowIsDisabled ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <fieldset
          disabled={workflowIsDisabled}
          className="h-full min-w-0 border-0 p-0"
        >
          <WorkflowBuilderView
            focusRequest={focusRequest}
            onFocusHandled={() =>
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  next.delete("workflowFocus");
                  next.delete("actionFocus");
                  return next;
                },
                { replace: true },
              )
            }
            components={editorComponents}
            workflowDefinition={editorWorkflow}
            customModulesCode={customModulesSource}
            prebuiltModulesLibrarySource={PREBUILT_MODULES_LIBRARY_SOURCE}
            onChange={(nextDefinition) =>
              onWorkflowChange(
                toPortableWorkflowDefinition(nextDefinition, components),
              )
            }
          />
        </fieldset>
      </div>
    </section>
  );
}

export default ProjectWorkflowEditor;
