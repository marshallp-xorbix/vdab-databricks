import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import { useWorkspaceCatalogs } from "../hooks/useWorkspaceCatalogs";
import { useWorkspaceSchemas } from "../hooks/useWorkspaceSchemas";
import { useWorkspaceVolumes } from "../hooks/useWorkspaceVolumes";
import {
  createDatabricksVolumeBinding,
  readDatabricksVolumeBinding,
  validateVolumeFolder,
  type IDatabricksVolumeBinding,
} from "../utils/projectFileUploadBinding";

interface IFileUploadPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function FileUploadPropertiesEditor({
  componentKey,
  properties,
  bindings,
  disabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<IFileUploadPropertiesEditorProps>) {
  const selection = readDatabricksVolumeBinding(bindings);
  const catalogs = useWorkspaceCatalogs();
  const schemas = useWorkspaceSchemas(selection?.catalog ?? null);
  const volumes = useWorkspaceVolumes(
    selection?.catalog ?? null,
    selection?.schema ?? null,
  );
  const labelId = `file-upload-label-${componentKey}`;
  const catalogId = `file-upload-catalog-${componentKey}`;
  const schemaId = `file-upload-schema-${componentKey}`;
  const volumeId = `file-upload-volume-${componentKey}`;
  const folderId = `file-upload-folder-${componentKey}`;
  const folderError = selection ? validateVolumeFolder(selection.filePath) : null;

  function changeSelection(nextSelection: IDatabricksVolumeBinding) {
    onBindingsChange(createDatabricksVolumeBinding(nextSelection));
  }

  function changeCatalog(catalog: string) {
    if (catalog === "") {
      onBindingsChange(null);
      return;
    }

    changeSelection({
      catalog,
      schema: null,
      volume: null,
      filePath: selection?.filePath ?? "",
    });
  }

  function changeSchema(schema: string) {
    if (!selection) {
      return;
    }

    changeSelection({ ...selection, schema: schema || null, volume: null });
  }

  function changeVolume(volume: string) {
    if (!selection) {
      return;
    }

    changeSelection({ ...selection, volume: volume || null });
  }

  function changeFolder(filePath: string) {
    if (selection) {
      changeSelection({ ...selection, filePath });
    }
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">File upload properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={labelId}>Label</Label>
        <Input
          id={labelId}
          name="label"
          required
          maxLength={500}
          value={readText(properties.label)}
          onChange={(event) => onPropertiesChange({ ...properties, label: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={catalogId}>Current-workspace catalog</Label>
        <select
          id={catalogId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selection?.catalog ?? ""}
          onChange={(event) => changeCatalog(event.target.value)}
        >
          <option value="">Keep uploads in memory</option>
          {includeCurrentSelection(
            catalogs.data?.items.map((item) => item.name) ?? [],
            selection?.catalog,
          ).map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        {catalogs.isPending && <p role="status" className="text-xs text-muted-foreground">Loading catalogs…</p>}
        {catalogs.isError && <p role="alert" className="text-xs text-destructive">{catalogs.error.message}</p>}
        {!catalogs.isPending && !catalogs.isError && (catalogs.data?.items.length ?? 0) === 0 && (
          <p role="status" className="text-xs text-muted-foreground">No catalogs are visible to this user.</p>
        )}
      </div>
      {selection && (
        <>
          <div className="grid gap-2">
            <Label htmlFor={schemaId}>Schema</Label>
            <select
              id={schemaId}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selection.schema ?? ""}
              disabled={!selection.catalog || schemas.isPending || schemas.isError}
              onChange={(event) => changeSchema(event.target.value)}
            >
              <option value="">Select a schema</option>
              {includeCurrentSelection(
                schemas.data?.items.map((item) => item.name) ?? [],
                selection.schema,
              ).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            {schemas.isPending && <p role="status" className="text-xs text-muted-foreground">Loading schemas…</p>}
            {schemas.isError && <p role="alert" className="text-xs text-destructive">{schemas.error.message}</p>}
            {!schemas.isPending && !schemas.isError && (schemas.data?.items.length ?? 0) === 0 && (
              <p role="status" className="text-xs text-muted-foreground">No schemas are visible in this catalog.</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={volumeId}>Volume</Label>
            <select
              id={volumeId}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selection.volume ?? ""}
              disabled={!selection.schema || volumes.isPending || volumes.isError}
              onChange={(event) => changeVolume(event.target.value)}
            >
              <option value="">Select a volume</option>
              {includeCurrentSelection(
                volumes.data?.items.map((item) => item.name) ?? [],
                selection.volume,
              ).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            {volumes.isPending && <p role="status" className="text-xs text-muted-foreground">Loading volumes…</p>}
            {volumes.isError && <p role="alert" className="text-xs text-destructive">{volumes.error.message}</p>}
            {!volumes.isPending && !volumes.isError && (volumes.data?.items.length ?? 0) === 0 && (
              <p role="status" className="text-xs text-muted-foreground">No volumes are visible in this schema.</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={folderId}>Destination folder</Label>
            <Input
              id={folderId}
              name="filePath"
              maxLength={1024}
              placeholder="incoming/2026"
              value={selection.filePath}
              onChange={(event) => changeFolder(event.target.value)}
            />
            {folderError && <p role="alert" className="text-xs text-destructive">{folderError}</p>}
            <p className="text-xs text-muted-foreground">Use a relative folder inside the selected Volume.</p>
          </div>
          {(!selection.catalog || !selection.schema || !selection.volume) && (
            <p role="status" className="text-sm text-muted-foreground">
              Choose a catalog, schema, and Volume to upload files. Incomplete selections are saved but cannot be previewed.
            </p>
          )}
        </>
      )}
      <p className="text-sm text-muted-foreground">
        Multiple files are accepted. Uploads use the current viewer’s Databricks permissions.
      </p>
    </fieldset>
  );
}

function includeCurrentSelection(options: string[], current: string | null | undefined): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "Upload File";
}

export default FileUploadPropertiesEditor;
