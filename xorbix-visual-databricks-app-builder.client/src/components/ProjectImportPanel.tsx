import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useImportProject } from "../hooks/useImportProject";
import type { IProjectImportResult } from "../models/ProjectPortability";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface IProjectImportPanelProps {
  className?: string;
}

const MAX_PROJECT_IMPORT_BYTES = 1_048_576;

/** Imports a portable project and explains which workspace resources need reselection. */
function ProjectImportPanel({ className }: Readonly<IProjectImportPanelProps>) {
  const importProjectMutation = useImportProject();
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<IProjectImportResult | null>(
    null,
  );

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!selectedFile) return;
    setImportError(null);
    setImportResult(null);
    if (selectedFile.size > MAX_PROJECT_IMPORT_BYTES) {
      setImportError("Choose a project export smaller than 1 MiB.");
      return;
    }
    try {
      const bundle: unknown = JSON.parse(await selectedFile.text());
      const result = await importProjectMutation.mutateAsync(bundle);
      setImportResult(result);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "The project could not be imported.",
      );
    }
  }

  return (
    <section
      aria-labelledby="import-project-heading"
      className={`rounded-xl border border-border bg-card p-6 ${className ?? ""}`}
    >
      <h2 id="import-project-heading" className="text-lg font-semibold">
        Import a standalone project
      </h2>
      <p
        id="project-import-help"
        className="mt-2 text-sm text-muted-foreground"
      >
        Choose a VDAB v1 project file. Imported workspace resources and the
        child App must be selected again.
      </p>
      <div className="mt-4 grid gap-2">
        <Label htmlFor="project-import-file">Project JSON file</Label>
        <Input
          id="project-import-file"
          type="file"
          accept="application/json,.json"
          aria-describedby={
            importError
              ? "project-import-help project-import-error"
              : "project-import-help"
          }
          aria-invalid={importError !== null}
          disabled={importProjectMutation.isPending}
          onChange={(event) => void handleImport(event)}
        />
      </div>
      {importProjectMutation.isPending && (
        <p role="status" className="mt-3">
          Importing project…
        </p>
      )}
      {importError && (
        <p
          id="project-import-error"
          role="alert"
          className="mt-3 text-sm text-destructive"
        >
          {importError}
        </p>
      )}
      {importResult && (
        <div
          className="mt-4 rounded-md border border-border p-4"
          role="status"
          aria-live="polite"
        >
          <p>
            Imported{" "}
            <Link
              className="underline underline-offset-4"
              to={`/apps/${importResult.project.id}`}
            >
              {importResult.project.name}
            </Link>
            . Choose a child App before deploying.
          </p>
          {importResult.unresolvedResources.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium">
                Select these resources again in the project editor:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {importResult.unresolvedResources.map((reference) => (
                  <li key={reference.key}>
                    {reference.kind}: {reference.label}
                    {reference.componentKeys?.length
                      ? ` — components ${reference.componentKeys.join(", ")}`
                      : ""}
                    {reference.workflowNodeIds?.length
                      ? ` — workflow actions ${reference.workflowNodeIds.join(", ")}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2">No workspace resources need reselection.</p>
          )}
        </div>
      )}
    </section>
  );
}

export default ProjectImportPanel;
