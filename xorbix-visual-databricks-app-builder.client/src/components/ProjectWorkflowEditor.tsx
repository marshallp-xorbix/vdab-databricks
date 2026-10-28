import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import WorkflowBuilderView from "./AppBuilderComponents/AppCanvas/WorkflowBuilderView";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
} from "./ui/sheet";
import { useProjectCustomModules } from "../hooks/useProjectCustomModules";
import { useWorkspaceServingEndpoints } from "../hooks/useWorkspaceServingEndpoints";
import AiBuilderPanel from "./AiBuilderPanel";
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
  version: number;
  components: IProjectComponent[];
  definitions: IComponentDefinition[];
  workflow: IProjectWorkflowDefinition;
  isDirty: boolean;
  isSaving: boolean;
  onComponentsChange: (components: IProjectComponent[]) => void;
  isDisabled: boolean;
  saveError: string | null;
  onWorkflowChange: (workflow: IProjectWorkflowDefinition) => void;
  onReload: () => void;
  onCustomModulesDirtyChange: (isDirty: boolean) => void;
  customModulesSource: string;
  hasLoadedCustomModulesSource: boolean;
  onCustomModulesSourceChange: (source: string) => void;
}

/** Hosts the retained visual workflow editor on standalone project contracts. */
export function ProjectWorkflowEditor({
  projectId,
  version,
  components,
  definitions,
  workflow,
  isDirty,
  isSaving,
  onComponentsChange,
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
  const [activeTool, setActiveTool] = useState<"workflow" | "ai">(
    () => readWorkflowTool(searchParams.get("tool")),
  );
  const customModulesQuery = useProjectCustomModules(projectId);
  const servingEndpointsQuery = useWorkspaceServingEndpoints();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const customModulesDocument = customModulesQuery.data;
  const isCustomModulesDirty = Boolean(
    customModulesDocument &&
    loadedProjectId === projectId &&
    customModulesSource !== customModulesDocument.source,
  );
  const workflowIsDisabled = isDisabled;

  useEffect(() => {
    setActiveTool(readWorkflowTool(searchParams.get("tool")));
  }, [searchParams]);

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

  function handleCloseAiBuilder() {
    setActiveTool("workflow");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("tool");
      return next;
    }, { replace: true });
  }

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
        {isDirty ? "Workflow changes are not saved." : isSaving ? "Saving workflows…" : "Workflows saved."}
      </p>

      <div
        hidden={activeTool !== "workflow"}
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
      <Sheet
        modal={false}
        open={activeTool === "ai"}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleCloseAiBuilder();
        }}
      >
        <SheetContent
          side="right"
          overlayClassName="pointer-events-none"
          className="!inset-y-auto !top-auto !right-4 !bottom-4 !h-[70vh] !w-96 !max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-2 border-primary bg-card p-0 shadow-xl sm:!max-w-96 [&>button]:hidden"
        >
          <SheetDescription className="sr-only">
            Request a project change using a workspace serving endpoint and review it before applying.
          </SheetDescription>
            <div className="flex min-h-0 flex-1">
              {customModulesQuery.isPending && (
                <p role="status">Loading custom modules…</p>
              )}
              {customModulesQuery.isError && (
                <p role="alert">
                  {customModulesQuery.error instanceof Error
                    ? customModulesQuery.error.message
                    : "Custom Python modules could not be loaded."}
                </p>
              )}
              {servingEndpointsQuery.isError && (
                <p role="alert">
                  {servingEndpointsQuery.error instanceof Error
                    ? servingEndpointsQuery.error.message
                    : "Serving endpoints could not be loaded for AI Builder."}
                </p>
              )}
              {customModulesDocument && (
                <AiBuilderPanel
                  projectId={projectId}
                  version={version}
                  endpoints={servingEndpointsQuery.data?.items ?? []}
                  components={components}
                  workflow={workflow}
                  customModulesSource={customModulesSource}
                  isDisabled={
                    isDisabled ||
                    customModulesQuery.isPending ||
                    servingEndpointsQuery.isError
                  }
                  onClose={handleCloseAiBuilder}
                  onApplyProposal={(proposal) => {
                    onComponentsChange(proposal.components);
                    onWorkflowChange(proposal.workflow);
                    onCustomModulesSourceChange(proposal.customModulesSource);
                  }}
                />
              )}
            </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function readWorkflowTool(value: string | null): "workflow" | "ai" {
  if (value === "ai") return value;
  return "workflow";
}
