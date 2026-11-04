import type { ProjectJsonObject } from "../models/ProjectComponents";

export interface IDatabricksVolumeBinding {
  catalog: string | null;
  schema: string | null;
  volume: string | null;
  filePath: string;
}

/** Reads the Volume selection from the portable FileUpload binding shape. */
export function readDatabricksVolumeBinding(
  bindings: ProjectJsonObject | null,
): IDatabricksVolumeBinding | null {
  const bindingValue = bindings?.databricksVolume;
  if (!isRecord(bindingValue) || !isRecord(bindingValue.source)) {
    return null;
  }

  const resource = bindingValue.source.resource;
  if (!isRecord(resource)) {
    return null;
  }

  return {
    catalog: readNullableString(resource.catalog),
    schema: readNullableString(resource.schema),
    volume: readNullableString(resource.volume),
    filePath: typeof resource.filePath === "string" ? resource.filePath : "",
  };
}

/** Creates the project-local binding shape used by the Volume selector. */
export function createDatabricksVolumeBinding(
  selection: IDatabricksVolumeBinding,
): ProjectJsonObject {
  return {
    databricksVolume: {
      bindingType: "databricksVolume",
      source: {
        kind: "resource",
        valueType: "file",
        resource: {
          type: "databricksVolume",
          catalog: selection.catalog,
          schema: selection.schema,
          volume: selection.volume,
          filePath: selection.filePath,
        },
      },
    },
  };
}

/** Returns a normalized relative folder or a user-readable validation error. */
export function validateVolumeFolder(value: string): string | null {
  if (
    value.length > 1024 ||
    value.trim() !== value ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("\\") ||
    // eslint-disable-next-line no-control-regex -- Control characters are unsafe in workspace paths.
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return "Use a relative folder path without leading or trailing slashes.";
  }

  if (value !== "" && value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return "Folder paths cannot contain empty, current, or parent directory segments.";
  }

  return null;
}

function readNullableString(value: unknown): string | null {
  return value === null || typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
