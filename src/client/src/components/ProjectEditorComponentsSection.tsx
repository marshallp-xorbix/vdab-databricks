import type { ReactNode } from "react";
import { Button } from "./ui/button";
import ProjectComponentsEditor from "./ProjectComponentsEditor";
import type { useProjectEditor } from "../hooks/useProjectEditor";
import { DISPLAY_APP_NAME_HEADER_THEME_KEY } from "../utils/displayAppNameHeaderDefaults";
import { PAGE_WIDTH_THEME_KEY } from "../utils/pageWidthDefaults";

type ProjectEditorState = ReturnType<typeof useProjectEditor>;

interface IProjectEditorComponentsSectionProps {
  isActive: boolean;
  toolbar: ReactNode;
  customModulesSource?: string;
  editor: Pick<
    ProjectEditorState,
    | "componentsQuery"
    | "registryQuery"
    | "replaceComponentsMutation"
    | "replaceWorkflowMutation"
    | "updateProjectMutation"
    | "components"
    | "workflow"
    | "isMetadataDirty"
    | "isCanvasSaving"
    | "componentsDocument"
    | "canEdit"
    | "handleComponentsChange"
    | "setWorkflow"
    | "name"
    | "theme"
    | "setTheme"
  >;
}

function ProjectEditorComponentsSection({
  isActive,
  toolbar,
  customModulesSource = "",
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
          Components save failed.{" "}
          {saveError instanceof Error
            ? saveError.message
            : "Use Save to retry."}
        </p>
      )}
      {canEdit && replaceWorkflowMutation.isError && (
        <p role="alert" className="px-3 py-2 text-sm text-destructive">
          Workflow save failed. {replaceWorkflowMutation.error instanceof Error ? replaceWorkflowMutation.error.message : "Use Save to retry."}
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
          appName={editor.name}
          isDisabled={
            !canEdit || editor.isCanvasSaving ||
            isMetadataDirty ||
            replaceComponentsMutation.isPending ||
            replaceWorkflowMutation.isPending ||
            updateProjectMutation.isPending
          }
          workflow={workflow}
          toolbar={toolbar}
          customModulesCode={customModulesSource}
          onComponentsChange={handleComponentsChange}
          onWorkflowChange={setWorkflow}
          onPageWidthChange={(pageWidth) =>
            editor.setTheme((currentTheme) => ({
              ...currentTheme,
              [PAGE_WIDTH_THEME_KEY]: String(pageWidth),
            }))
          }
          onDisplayAppNameHeaderChange={(displayAppNameHeader) =>
            editor.setTheme((currentTheme) => ({
              ...currentTheme,
              [DISPLAY_APP_NAME_HEADER_THEME_KEY]: String(displayAppNameHeader),
            }))
          }
        />
      )}
    </section>
  );
}

export default ProjectEditorComponentsSection;
