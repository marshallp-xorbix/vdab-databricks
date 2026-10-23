import type {
  IProjectComponent,
  IProjectPreview,
} from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import { useProjectComponentEditor } from "../hooks/useProjectComponentEditor";
import ProjectComponentList from "./ProjectComponentList";
import ProjectComponentPropertiesEditor from "./ProjectComponentPropertiesEditor";
import ProjectComponentTreeActions from "./ProjectComponentTreeActions";
import ProjectComponentsAddControls from "./ProjectComponentsAddControls";
import ProjectComponentsSavePanel from "./ProjectComponentsSavePanel";

interface IProjectComponentsEditorProps {
  components: IProjectComponent[];
  isDirty: boolean;
  isSaving: boolean;
  isDisabled: boolean;
  isSaveDisabled: boolean;
  saveError: string | null;
  preview: IProjectPreview | null;
  isPreviewing: boolean;
  previewError: string | null;
  workflow: IProjectWorkflowDefinition;
  isWorkflowLoaded: boolean;
  onComponentsChange: (components: IProjectComponent[]) => void;
  onWorkflowChange: (workflow: IProjectWorkflowDefinition) => void;
  onSave: () => void;
  onReload: () => void;
  onPreview: () => void;
}

function ProjectComponentsEditor({
  components,
  isDirty,
  isSaving,
  isDisabled,
  isSaveDisabled,
  saveError,
  preview,
  isPreviewing,
  previewError,
  workflow,
  isWorkflowLoaded,
  onComponentsChange,
  onWorkflowChange,
  onSave,
  onReload,
  onPreview,
}: Readonly<IProjectComponentsEditorProps>) {
  const editor = useProjectComponentEditor({
    components,
    workflow,
    onComponentsChange,
    onWorkflowChange,
  });

  return (
    <section
      aria-labelledby="project-components-heading"
      className="grid gap-5 rounded-xl border border-border bg-card p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="project-components-heading" className="text-xl font-semibold">
            App components
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add controls and layout containers. Children inside an expander,
            column, row, tab, or form follow the order shown in the component
            list.
          </p>
        </div>
        <div className="grid justify-items-end gap-2">
          <ProjectComponentsAddControls
            isDisabled={isDisabled}
            onAdd={editor.addComponent}
          />
          <ProjectComponentTreeActions
            component={editor.selectedComponent}
            isDisabled={isDisabled}
            isRemoveDisabled={!isWorkflowLoaded}
            canMoveUp={editor.canMoveUp}
            canMoveDown={editor.canMoveDown}
            onMoveUp={() => editor.moveSelectedComponent("up")}
            onMoveDown={() => editor.moveSelectedComponent("down")}
            onRemove={editor.removeSelectedComponent}
          />
        </div>
      </header>

      {components.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No components yet. Add a control to start the app canvas.
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
          <ProjectComponentList
            components={components}
            selectedKey={editor.selectedKey}
            disabled={isDisabled}
            onSelect={editor.selectComponent}
          />

          {editor.selectedComponent && (
            <ProjectComponentPropertiesEditor
              component={editor.selectedComponent}
              components={components}
              isDisabled={isDisabled}
              activeTabIndex={editor.activeTabIndex}
              onPropertiesChange={editor.changeSelectedProperties}
              onBindingsChange={editor.changeSelectedBindings}
              onActiveTabChange={editor.setActiveTabIndex}
              onAddLayoutChild={editor.addLayoutChild}
              onAddFormChild={editor.addFormChild}
              onAddModalChild={editor.addModalChild}
              onRemoveTab={editor.removeSelectedTab}
            />
          )}
        </div>
      )}

      <ProjectComponentsSavePanel
        isDirty={isDirty}
        isSaving={isSaving}
        isDisabled={isDisabled}
        isSaveDisabled={isSaveDisabled}
        saveError={saveError}
        preview={preview}
        isPreviewing={isPreviewing}
        previewError={previewError}
        onSave={onSave}
        onReload={onReload}
        onPreview={onPreview}
      />
    </section>
  );
}

export default ProjectComponentsEditor;
