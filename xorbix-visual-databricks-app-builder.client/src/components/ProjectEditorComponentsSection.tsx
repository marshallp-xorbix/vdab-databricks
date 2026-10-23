import { Button } from "./ui/button";
import ProjectComponentsEditor from "./ProjectComponentsEditor";
import type { useProjectEditor } from "../hooks/useProjectEditor";

type ProjectEditorState = ReturnType<typeof useProjectEditor>;

interface IProjectEditorComponentsSectionProps {
  isActive: boolean;
  editor: Pick<
    ProjectEditorState,
    | "componentsQuery"
    | "replaceComponentsMutation"
    | "replaceWorkflowMutation"
    | "updateProjectMutation"
    | "components"
    | "workflow"
    | "hasLoadedWorkflow"
    | "isMetadataDirty"
    | "isComponentsDirty"
    | "isWorkflowDirty"
    | "isCustomModulesDirty"
    | "componentsDocument"
    | "canEdit"
    | "previewMutation"
    | "handleComponentsChange"
    | "setWorkflow"
    | "handleSaveComponents"
    | "handleReloadComponents"
    | "handlePreview"
  >;
}

function ProjectEditorComponentsSection({
  isActive,
  editor,
}: Readonly<IProjectEditorComponentsSectionProps>) {
  const {
    componentsQuery,
    replaceComponentsMutation,
    replaceWorkflowMutation,
    updateProjectMutation,
    components,
    workflow,
    hasLoadedWorkflow,
    isMetadataDirty,
    isComponentsDirty,
    isWorkflowDirty,
    isCustomModulesDirty,
    componentsDocument,
    canEdit,
    previewMutation,
    handleComponentsChange,
    setWorkflow,
    handleSaveComponents,
    handleReloadComponents,
    handlePreview,
  } = editor;

  return (
    <section hidden={!isActive}>
      {canEdit && isComponentsDirty && (
        <p role="status" aria-live="polite">
          {replaceComponentsMutation.isError
            ? "Automatic save failed. Use Save components to retry."
            : isMetadataDirty || isWorkflowDirty || isCustomModulesDirty
              ? "Component auto-save will resume after the other project changes are saved."
              : "Component changes save automatically after you pause editing. Use Save components to save now."}
        </p>
      )}
      {componentsQuery.isPending && (
        <p role="status" aria-live="polite">
          Loading components…
        </p>
      )}
      {componentsQuery.isError && (
        <div role="alert" className="grid gap-2">
          <p>
            {componentsQuery.error instanceof Error
              ? componentsQuery.error.message
              : "Project components could not be loaded."}
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void componentsQuery.refetch()}
            >
              Retry loading components
            </Button>
          </div>
        </div>
      )}
      {componentsDocument && (
        <ProjectComponentsEditor
          components={components}
          isDirty={isComponentsDirty}
          isSaving={replaceComponentsMutation.isPending}
          isDisabled={
            !canEdit ||
            isMetadataDirty ||
            replaceComponentsMutation.isPending ||
            replaceWorkflowMutation.isPending ||
            updateProjectMutation.isPending
          }
          isSaveDisabled={isWorkflowDirty || isCustomModulesDirty}
          saveError={
            replaceComponentsMutation.isError
              ? replaceComponentsMutation.error instanceof Error
                ? replaceComponentsMutation.error.message
                : "The components could not be saved."
              : null
          }
          preview={previewMutation.data ?? null}
          isPreviewing={previewMutation.isPending}
          previewError={
            previewMutation.isError
              ? previewMutation.error instanceof Error
                ? previewMutation.error.message
                : "The preview could not be generated."
              : null
          }
          workflow={workflow}
          isWorkflowLoaded={hasLoadedWorkflow}
          onComponentsChange={handleComponentsChange}
          onWorkflowChange={setWorkflow}
          onSave={() => void handleSaveComponents()}
          onReload={() => void handleReloadComponents()}
          onPreview={() => void handlePreview()}
        />
      )}
    </section>
  );
}

export default ProjectEditorComponentsSection;
