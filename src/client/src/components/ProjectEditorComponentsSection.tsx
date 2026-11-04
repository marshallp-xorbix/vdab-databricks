import type { ReactNode } from "react";
import { Button } from "./ui/button";
import ProjectComponentsEditor from "./ProjectComponentsEditor";
import type { useProjectEditor } from "../hooks/useProjectEditor";
import { PAGE_WIDTH_THEME_KEY } from "../utils/pageWidthDefaults";

type ProjectEditorState = ReturnType<typeof useProjectEditor>;

interface IProjectEditorComponentsSectionProps {
  isActive: boolean;
  toolbar: ReactNode;
  editor: Pick<
    ProjectEditorState,
    | "componentsQuery"
    | "registryQuery"
    | "workflowQuery"
    | "replaceComponentsMutation"
    | "replaceWorkflowMutation"
    | "updateProjectMutation"
    | "components"
    | "workflow"
    | "isMetadataDirty"
    | "isComponentsDirty"
    | "isWorkflowDirty"
    | "isCustomModulesDirty"
    | "isCanvasSaving"
    | "componentsDocument"
    | "canEdit"
    | "handleComponentsChange"
    | "setWorkflow"
    | "theme"
    | "setTheme"
  >;
}

function ProjectEditorComponentsSection({
  isActive,
  toolbar,
  editor,
}: Readonly<IProjectEditorComponentsSectionProps>) {
  const {
    componentsQuery,
    registryQuery,
    replaceComponentsMutation,
    replaceWorkflowMutation,
    updateProjectMutation,
    components,
    workflow,
    isMetadataDirty,
    isComponentsDirty,
    isWorkflowDirty,
    isCustomModulesDirty,
    componentsDocument,
    canEdit,
    handleComponentsChange,
    setWorkflow,
  } = editor;
  const saveError = replaceComponentsMutation.error;

  return (
    <section hidden={!isActive} className="h-full min-h-0">
      {canEdit && replaceComponentsMutation.isError && (
        <p role="alert" className="px-3 py-2 text-sm text-destructive">
          Automatic save failed. {saveError instanceof Error
            ? saveError.message
            : "Use Save to retry."}
        </p>
      )}
      {canEdit && replaceWorkflowMutation.isError && (
        <p role="alert" className="px-3 py-2 text-sm text-destructive">
          Workflow save failed. {replaceWorkflowMutation.error instanceof Error ? replaceWorkflowMutation.error.message : "Use Save to retry."}
        </p>
      )}
      {canEdit && isComponentsDirty && !replaceComponentsMutation.isError && (
        <p role="status" aria-live="polite" className="px-3 py-2 text-sm">
          {isMetadataDirty || isWorkflowDirty || isCustomModulesDirty
            ? "Component auto-save will resume after the other project changes are saved."
            : replaceComponentsMutation.isPending
              ? "Saving components…"
              : "Component changes save automatically after you pause editing. Use Save to save now."}
        </p>
      )}
      {canEdit && !isComponentsDirty && !replaceComponentsMutation.isPending && (
        <p role="status" aria-live="polite" className="sr-only">
          Components saved.
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
          definitions={registryQuery.data?.components ?? []}
          theme={editor.theme as Record<string, string>}
          isDisabled={
            !canEdit || editor.isCanvasSaving ||
            isMetadataDirty ||
            replaceComponentsMutation.isPending ||
            replaceWorkflowMutation.isPending ||
            updateProjectMutation.isPending
          }
          workflow={workflow}
          isWorkflowReady={editor.workflowQuery.isSuccess}
          toolbar={toolbar}
          onComponentsChange={handleComponentsChange}
          onWorkflowChange={setWorkflow}
          onPageWidthChange={(pageWidth) =>
            editor.setTheme((currentTheme) => ({
              ...currentTheme,
              [PAGE_WIDTH_THEME_KEY]: String(pageWidth),
            }))
          }
        />
      )}
    </section>
  );
}

export default ProjectEditorComponentsSection;
