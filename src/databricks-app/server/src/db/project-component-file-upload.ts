import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const FILE_UPLOAD_PROPERTY_NAMES = ["label"];
const MAX_FILE_UPLOAD_LABEL_LENGTH = 500;
const MAX_VOLUME_RESOURCE_NAME_LENGTH = 255;
const MAX_VOLUME_FOLDER_LENGTH = 1024;

/** Validates the retained FileUpload property shape at the save/import boundary. */
export function validateFileUploadProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, FILE_UPLOAD_PROPERTY_NAMES)) {
    throw invalidComponents();
  }

  const label = properties.label;
  if (
    label !== undefined &&
    label !== null &&
    (typeof label !== "string" ||
      label.trim() === "" ||
      label.length > MAX_FILE_UPLOAD_LABEL_LENGTH)
  ) {
    throw invalidComponents();
  }
}

/** Validates the optional, project-local databricksVolume binding shape. */
export function validateFileUploadBindings(
  bindings: ProjectJsonObject | null,
): void {
  if (bindings === null) {
    return;
  }

  if (
    hasUnexpectedProperties(bindings, ["databricksVolume"]) ||
    !isRecord(bindings.databricksVolume)
  ) {
    throw invalidComponents();
  }

  const binding = bindings.databricksVolume;
  if (
    hasUnexpectedProperties(binding, ["bindingType", "source"]) ||
    binding.bindingType !== "databricksVolume" ||
    !isRecord(binding.source)
  ) {
    throw invalidComponents();
  }

  const source = binding.source;
  if (
    hasUnexpectedProperties(source, ["kind", "valueType", "resource"]) ||
    source.kind !== "resource" ||
    source.valueType !== "file" ||
    !isRecord(source.resource)
  ) {
    throw invalidComponents();
  }

  const resource = source.resource;
  if (
    hasUnexpectedProperties(resource, [
      "type",
      "catalog",
      "schema",
      "volume",
      "filePath",
    ]) ||
    resource.type !== "databricksVolume" ||
    !isOptionalResourceName(resource.catalog) ||
    !isOptionalResourceName(resource.schema) ||
    !isOptionalResourceName(resource.volume) ||
    typeof resource.filePath !== "string" ||
    !isValidRelativeVolumePath(resource.filePath)
  ) {
    throw invalidComponents();
  }
}

function isOptionalResourceName(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= MAX_VOLUME_RESOURCE_NAME_LENGTH &&
      value.trim() === value &&
      !value.includes("/") &&
      !value.includes("\\") &&
      value !== "." &&
      value !== ".." &&
      !/[\u0000-\u001f\u007f]/.test(value))
  );
}

function isValidRelativeVolumePath(value: string): boolean {
  if (
    value.length > MAX_VOLUME_FOLDER_LENGTH ||
    value.trim() !== value ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return false;
  }

  return (
    value === "" ||
    value
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}
