import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface IProjectCustomModulesEditorProps {
  source: string;
  isDirty: boolean;
  isSaving: boolean;
  isDisabled: boolean;
  errorMessage: string | null;
  onSourceChange: (source: string) => void;
  onSave: () => void;
  onReload: () => void;
}

/** Edits the project Python file packaged only into generated child apps. */
export function ProjectCustomModulesEditor({
  source,
  isDirty,
  isSaving,
  isDisabled,
  errorMessage,
  onSourceChange,
  onSave,
  onReload,
}: Readonly<IProjectCustomModulesEditorProps>) {
  return (
    <section aria-labelledby="project-custom-modules-heading" className="grid gap-3 rounded-md border border-border p-4">
      <header>
        <h3 id="project-custom-modules-heading" className="font-medium">Custom Python modules</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This source is included in generated child apps and runs there when invoked by a workflow. It is never executed by the builder preview service.
        </p>
      </header>
      <Textarea
        aria-label="Custom Python module source"
        className="min-h-64 font-mono text-sm"
        disabled={isDisabled || isSaving}
        spellCheck={false}
        value={source}
        onChange={(event) => onSourceChange(event.target.value)}
      />
      {errorMessage && <p role="alert">{errorMessage}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={isDisabled || isSaving || !isDirty} onClick={onSave}>
          {isSaving ? "Saving modules…" : "Save modules"}
        </Button>
        {errorMessage && (
          <Button type="button" variant="outline" disabled={isSaving} onClick={onReload}>
            Reload latest modules
          </Button>
        )}
        {isDirty && <span role="status">Module changes are not saved.</span>}
      </div>
    </section>
  );
}

export default ProjectCustomModulesEditor;
