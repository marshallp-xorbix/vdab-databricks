import { Button } from "./ui/button";
import type { IProjectPreview } from "../models/ProjectComponents";

interface IProjectPreviewPanelProps {
  preview: IProjectPreview | null;
  isPending: boolean;
  isDisabled: boolean;
  errorMessage: string | null;
  onPreview: () => void;
}

function ProjectPreviewPanel({
  preview,
  isPending,
  isDisabled,
  errorMessage,
  onPreview,
}: Readonly<IProjectPreviewPanelProps>) {
  const pythonFile = preview?.files.find((file) => file.path === "app.py");

  return (
    <section aria-labelledby="project-preview-heading" className="grid gap-4 rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="project-preview-heading" className="text-lg font-semibold">
            Generated app preview
          </h3>
          <p className="text-sm text-muted-foreground">
            This source preview does not deploy or run the generated app.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={isDisabled || isPending} onClick={onPreview}>
          {isPending ? "Generating…" : "Generate preview"}
        </Button>
      </div>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {preview && pythonFile && (
        <div className="grid gap-2">
          <p className="text-sm font-medium">
            {pythonFile.path} · project version {preview.version}
          </p>
          <pre
            aria-label="Generated Python preview"
            className="max-h-[32rem] overflow-auto rounded-md bg-muted p-4 text-xs"
          >
            <code>{pythonFile.content}</code>
          </pre>
        </div>
      )}
    </section>
  );
}

export default ProjectPreviewPanel;
