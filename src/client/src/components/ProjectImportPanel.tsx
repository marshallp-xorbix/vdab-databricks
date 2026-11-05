import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useImportProject } from "../hooks/useImportProject";
import type { IProjectImportResult } from "../models/ProjectPortability";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface IProjectImportPanelProps {
  className?: string;
}

const MAX_PROJECT_IMPORT_BYTES = 10_485_760;

/** Imports a portable project and explains which workspace resources need reselection. */
function ProjectImportPanel({ className }: Readonly<IProjectImportPanelProps>) {
  const importProjectMutation = useImportProject();
  const [importError, setImportError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<IProjectImportResult[]>([]);

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!selectedFile) return;
    setImportError(null);
    setImportResults([]);
    if (selectedFile.size > MAX_PROJECT_IMPORT_BYTES) {
      setImportError("Choose a project export smaller than 10 MiB.");
      return;
    }
    try {
      const bundle: unknown = JSON.parse(await selectedFile.text());
      if (isCollection(bundle)) {
        if (bundle.projects.length > 100) throw new Error("A collection can contain at most 100 projects.");
        for (const project of bundle.projects) {
          const result = await importProjectMutation.mutateAsync(project);
          setImportResults((current) => [...current, result]);
        }
      } else {
        const result = await importProjectMutation.mutateAsync(bundle);
        setImportResults([result]);
      }
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
        Choose a VDAB v1 project or collection file. Imported workspace resources and the
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
      {importResults.map((importResult) => (
        <div
          key={importResult.project.id}
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
      ))}
    </section>
  );
}

export default ProjectImportPanel;

function isCollection(value: unknown): value is { format: "vdab-project-collection"; schemaVersion: 1; projects: unknown[] } {
  return typeof value === "object" && value !== null &&
    "format" in value && value.format === "vdab-project-collection" &&
    "schemaVersion" in value && value.schemaVersion === 1 &&
    "projects" in value && Array.isArray(value.projects);
}
