import { Button } from "./ui/button";
import { ProjectWorkflowEditor } from "./ProjectWorkflowEditor";
import type { useProjectEditor } from "../hooks/useProjectEditor";

type ProjectEditorState = ReturnType<typeof useProjectEditor>;

interface IProjectEditorWorkflowSectionProps {
  isActive: boolean;
  projectId: string;
  editor: Pick<
    ProjectEditorState,
    | "hasOpenedWorkflows"
    | "workflowQuery"
    | "workflowDocument"
    | "componentsDocument"
    | "registryQuery"
    | "components"
    | "workflow"
    | "canEdit"
    | "isMetadataDirty"
    | "updateProjectMutation"
    | "replaceComponentsMutation"
    | "replaceWorkflowMutation"
    | "isWorkflowDirty"
    | "handleComponentsChange"
    | "setWorkflow"
    | "handleReloadWorkflow"
    | "setCustomModulesDirty"
  >;
  customModulesSource: string;
  hasLoadedCustomModulesSource: boolean;
  onCustomModulesSourceChange: (source: string) => void;
}

function ProjectEditorWorkflowSection({
  isActive,
  projectId,
  editor,
  customModulesSource,
  hasLoadedCustomModulesSource,
  onCustomModulesSourceChange,
}: Readonly<IProjectEditorWorkflowSectionProps>) {
  const {
    hasOpenedWorkflows,
    workflowQuery,
    workflowDocument,
    componentsDocument,
    registryQuery,
    components,
    workflow,
    canEdit,
    isMetadataDirty,
    updateProjectMutation,
    replaceComponentsMutation,
    replaceWorkflowMutation,
    isWorkflowDirty,
    handleComponentsChange,
    setWorkflow,
    handleReloadWorkflow,
    setCustomModulesDirty,
  } = editor;

  if (!hasOpenedWorkflows) {
    return null;
  }

  return (
    <section hidden={!isActive} className="h-full min-h-0">
      {workflowQuery.isPending && (
        <p role="status" aria-live="polite">
          Loading workflows…
        </p>
      )}
      {workflowQuery.isError && (
        <div role="alert" className="grid gap-2">
          <p>
            {workflowQuery.error instanceof Error
              ? workflowQuery.error.message
              : "Project workflows could not be loaded."}
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void workflowQuery.refetch()}
            >
              Retry loading workflows
            </Button>
          </div>
        </div>
      )}
      {workflowDocument && componentsDocument && registryQuery.data && (
        <ProjectWorkflowEditor
          projectId={projectId}
          version={workflowDocument.version}
          components={components}
          definitions={registryQuery.data.components}
          workflow={workflow}
          isDirty={isWorkflowDirty}
          isSaving={replaceWorkflowMutation.isPending}
          onComponentsChange={handleComponentsChange}
          isDisabled={
            !canEdit ||
            isMetadataDirty ||
            updateProjectMutation.isPending ||
            replaceComponentsMutation.isPending ||
            replaceWorkflowMutation.isPending
          }
          saveError={
            replaceWorkflowMutation.isError
              ? replaceWorkflowMutation.error instanceof Error
                ? replaceWorkflowMutation.error.message
                : "The workflows could not be saved."
              : null
          }
          onWorkflowChange={setWorkflow}
          onReload={() => void handleReloadWorkflow()}
          onCustomModulesDirtyChange={setCustomModulesDirty}
          customModulesSource={customModulesSource}
          hasLoadedCustomModulesSource={hasLoadedCustomModulesSource}
          onCustomModulesSourceChange={onCustomModulesSourceChange}
        />
      )}
      {registryQuery.isError && (
        <p role="alert">
          {registryQuery.error instanceof Error
            ? registryQuery.error.message
            : "The component registry could not be loaded for workflow editing."}
        </p>
      )}
    </section>
  );
}

export default ProjectEditorWorkflowSection;
