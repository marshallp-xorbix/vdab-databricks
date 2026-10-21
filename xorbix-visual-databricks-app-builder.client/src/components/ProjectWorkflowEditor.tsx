import { useEffect, useState } from "react";
import WorkflowBuilderView from "./AppBuilderComponents/AppCanvas/WorkflowBuilderView";
import { Button } from "./ui/button";
import ProjectCustomModulesEditor from "./ProjectCustomModulesEditor";
import { useProjectCustomModules } from "../hooks/useProjectCustomModules";
import { useReplaceProjectCustomModules } from "../hooks/useReplaceProjectCustomModules";
import { useWorkspaceServingEndpoints } from "../hooks/useWorkspaceServingEndpoints";
import AiBuilderPanel from "./AiBuilderPanel";
import { PREBUILT_MODULES_LIBRARY_SOURCE } from "../utils/prebuiltModulesLibrarySource";
import type { IProjectComponent } from "../models/ProjectComponents";
import type {
  IProjectWorkflowDefinition,
} from "../models/ProjectWorkflow";
import type { IComponentDefinition } from "../models/ComponentRegistry";
import {
  toPortableWorkflowDefinition,
  toWorkflowBuilderComponents,
  toWorkflowBuilderDefinition,
} from "../utils/projectWorkflowContractAdapter";

interface IProjectWorkflowEditorProps {
  projectId: string;
  version: number;
  components: IProjectComponent[];
  definitions: IComponentDefinition[];
  workflow: IProjectWorkflowDefinition;
  onComponentsChange: (components: IProjectComponent[]) => void;
  isDisabled: boolean;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  onWorkflowChange: (workflow: IProjectWorkflowDefinition) => void;
  onSave: () => void;
  onReload: () => void;
  onCustomModulesDirtyChange: (isDirty: boolean) => void;
}

/** Hosts the retained visual workflow editor on standalone project contracts. */
export function ProjectWorkflowEditor({
  projectId,
  version,
  components,
  definitions,
  workflow,
  onComponentsChange,
  isDisabled,
  isDirty,
  isSaving,
  saveError,
  onWorkflowChange,
  onSave,
  onReload,
  onCustomModulesDirtyChange,
}: Readonly<IProjectWorkflowEditorProps>) {
  const customModulesQuery = useProjectCustomModules(projectId);
  const replaceCustomModulesMutation = useReplaceProjectCustomModules();
  const servingEndpointsQuery = useWorkspaceServingEndpoints();
  const [customModulesSource, setCustomModulesSource] = useState("");
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
      setCustomModulesSource(customModulesDocument.source);
      setLoadedProjectId(projectId);
    }
  }, [customModulesDocument, loadedProjectId, projectId]);

  useEffect(() => {
    onCustomModulesDirtyChange(isCustomModulesDirty);
  }, [isCustomModulesDirty, onCustomModulesDirtyChange]);

  async function handleSaveCustomModules() {
    if (!customModulesDocument || isDisabled) return;
    try {
      const saved = await replaceCustomModulesMutation.mutateAsync({
        projectId,
        version: customModulesDocument.version,
        source: customModulesSource,
      });
      setCustomModulesSource(saved.source);
      setLoadedProjectId(projectId);
      onCustomModulesDirtyChange(false);
    } catch {
      // Mutation state below exposes the safe API failure and reload action.
    }
  }

  async function handleReloadCustomModules() {
    replaceCustomModulesMutation.reset();
    const refreshed = await customModulesQuery.refetch();
    if (refreshed.data) {
      setCustomModulesSource(refreshed.data.source);
      setLoadedProjectId(projectId);
      onCustomModulesDirtyChange(false);
    }
  }

  function handleCustomModulesSourceChange(source: string) {
    setCustomModulesSource(source);
    onCustomModulesDirtyChange(source !== customModulesDocument?.source);
  }

  const editorComponents = toWorkflowBuilderComponents(components, definitions);
  const editorWorkflow = toWorkflowBuilderDefinition(workflow, components);

  return (
    <section
      aria-labelledby="project-workflows-heading"
      className="grid gap-4 rounded-xl border border-border bg-card p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="project-workflows-heading" className="text-xl font-semibold">
            Workflows
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect component events to routed actions. Databricks actions use the signed-in user’s workspace permissions.
          </p>
        </div>
        <Button
          type="button"
          disabled={workflowIsDisabled || !isDirty || isSaving}
          onClick={onSave}
        >
          {isSaving ? "Saving…" : "Save workflows"}
        </Button>
      </header>

      {saveError && (
        <div role="alert" className="grid gap-2 rounded-md border border-destructive/30 p-3">
          <p>{saveError}</p>
          <div>
            <Button type="button" variant="outline" onClick={onReload}>
              Reload latest workflows
            </Button>
          </div>
        </div>
      )}

      {isDirty && <p role="status">Workflow changes are not saved.</p>}
      {!isDirty && isSaving && <p role="status">Saving workflows…</p>}
      {!isDirty && !isSaving && <p role="status" aria-live="polite">Workflows saved.</p>}

      <div
        aria-disabled={workflowIsDisabled}
        className={`h-[720px] min-h-[600px] overflow-hidden rounded-lg border border-border ${
          workflowIsDisabled ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <fieldset
          disabled={workflowIsDisabled}
          className="h-full min-w-0 border-0 p-0"
        >
          <WorkflowBuilderView
            components={editorComponents}
            workflowDefinition={editorWorkflow}
            customModulesCode={customModulesSource}
            prebuiltModulesLibrarySource={PREBUILT_MODULES_LIBRARY_SOURCE}
            normalizedAppResources={[]}
            onChange={(nextDefinition) =>
              onWorkflowChange(
                toPortableWorkflowDefinition(nextDefinition, components),
              )
            }
          />
        </fieldset>
      </div>
      {customModulesQuery.isPending && <p role="status">Loading custom modules…</p>}
      {customModulesQuery.isError && (
        <p role="alert">
          {customModulesQuery.error instanceof Error
            ? customModulesQuery.error.message
            : "Custom Python modules could not be loaded."}
        </p>
      )}
      {customModulesDocument && (
        <ProjectCustomModulesEditor
          source={customModulesSource}
          isDirty={isCustomModulesDirty}
          isSaving={replaceCustomModulesMutation.isPending}
          isDisabled={isDisabled || customModulesQuery.isPending}
          errorMessage={
            replaceCustomModulesMutation.isError
              ? replaceCustomModulesMutation.error instanceof Error
                ? replaceCustomModulesMutation.error.message
                : "Custom Python modules could not be saved."
              : null
          }
          onSourceChange={handleCustomModulesSourceChange}
          onSave={() => void handleSaveCustomModules()}
          onReload={() => void handleReloadCustomModules()}
        />
      )}
      {customModulesDocument && (
        <AiBuilderPanel
          projectId={projectId}
          version={version}
          endpoints={servingEndpointsQuery.data?.items ?? []}
          components={components}
          workflow={workflow}
          customModulesSource={customModulesSource}
          isDisabled={isDisabled || customModulesQuery.isPending || servingEndpointsQuery.isError}
          onApplyProposal={(proposal) => {
            onComponentsChange(proposal.components);
            onWorkflowChange(proposal.workflow);
            setCustomModulesSource(proposal.customModulesSource);
          }}
        />
      )}
      {servingEndpointsQuery.isError && (
        <p role="alert">
          {servingEndpointsQuery.error instanceof Error
            ? servingEndpointsQuery.error.message
            : "Serving endpoints could not be loaded for AI Builder."}
        </p>
      )}
    </section>
  );
}
