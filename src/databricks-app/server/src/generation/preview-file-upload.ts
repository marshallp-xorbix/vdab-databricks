import type {
  ProjectComponent,
  ProjectJsonObject,
} from "../db/project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "../db/project-component-json.ts";
import { invalidFileUpload } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import { appendWorkflowCallbackArguments } from "./preview-workflow-runtime.ts";

const MAX_LABEL_LENGTH = 500;
const MAX_RESOURCE_NAME_LENGTH = 255;
const MAX_FOLDER_LENGTH = 1024;

interface FileUploadProperties {
  label: string;
  volumePath: string | null;
}

/** Validates FileUpload settings and returns the optional complete Volume path. */
export function readFileUploadProperties(
  component: ProjectComponent,
): FileUploadProperties {
  if (
    component.type !== "FileUpload" ||
    component.schemaVersion !== 1 ||
    component.children.length > 0 ||
    !isSupportedFileUploadLayout(component.layout)
  ) {
    throw invalidFileUpload(
      "FileUpload supports one uploader, an optional Volume binding, and no child components.",
    );
  }

  const properties = component.properties;
  if (hasUnexpectedProperties(properties, ["label"])) {
    throw invalidFileUpload("FileUpload contains unsupported properties.");
  }

  const label = properties.label;
  if (
    label !== undefined &&
    label !== null &&
    (typeof label !== "string" ||
      label.trim() === "" ||
      label.length > MAX_LABEL_LENGTH)
  ) {
    throw invalidFileUpload("FileUpload label must be non-empty text.");
  }

  return {
    label: typeof label === "string" ? label : "Upload File",
    volumePath: readVolumePath(component.bindings),
  };
}

/** Appends a multi-file uploader and its caller-authorized Volume behavior. */
export function appendFileUpload(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  workflowEventKey?: string,
): void {
  const properties = readFileUploadProperties(component);
  const codeName = component.codeName ?? component.key;
  const displayLabel = `_vdab_disp_lbl_${variableName}`;
  const processedFilesKey = `${variableName}_processed_files`;
  const uploaderKey = `${variableName}_uploader`;

  lines.push(
    "",
    `${`_vdab_lbl_${variableName}`} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabel} = _vdab_lbl_${variableName} if _vdab_lbl_${variableName} is not None else ${pythonString(properties.label)}`,
    `${variableName} = st.file_uploader(`,
    `    label=${displayLabel},`,
    "    accept_multiple_files=True,",
    `    key=${pythonString(uploaderKey)},`,
  );
  appendWorkflowCallbackArguments(lines, component.key, workflowEventKey);
  lines.push(
    ")",
    `if ${pythonString(processedFilesKey)} not in st.session_state:`,
    `    st.session_state[${pythonString(processedFilesKey)}] = []`,
  );

  if (properties.volumePath === null) {
    appendInMemoryUpload(lines, variableName, processedFilesKey);
    return;
  }

  appendVolumeUpload(
    lines,
    variableName,
    processedFilesKey,
    properties.volumePath,
  );
}

function readVolumePath(bindings: ProjectJsonObject | null): string | null {
  if (bindings === null) {
    return null;
  }

  if (
    hasUnexpectedProperties(bindings, ["databricksVolume"]) ||
    !isRecord(bindings.databricksVolume)
  ) {
    throw invalidFileUpload("FileUpload has an invalid Volume binding.");
  }

  const binding = bindings.databricksVolume;
  const source = isRecord(binding) ? binding.source : null;
  const resource = isRecord(source) ? source.resource : null;
  if (
    !isRecord(binding) ||
    hasUnexpectedProperties(binding, ["bindingType", "source"]) ||
    binding.bindingType !== "databricksVolume" ||
    !isRecord(source) ||
    hasUnexpectedProperties(source, ["kind", "valueType", "resource"]) ||
    source.kind !== "resource" ||
    source.valueType !== "file" ||
    !isRecord(resource) ||
    hasUnexpectedProperties(resource, [
      "type",
      "catalog",
      "schema",
      "volume",
      "filePath",
    ]) ||
    resource.type !== "databricksVolume"
  ) {
    throw invalidFileUpload("FileUpload has an invalid Volume binding.");
  }

  const catalog = readOptionalResourceName(resource.catalog);
  const schema = readOptionalResourceName(resource.schema);
  const volume = readOptionalResourceName(resource.volume);
  const filePath = resource.filePath;

  if (typeof filePath !== "string" || !isValidRelativeFolder(filePath)) {
    throw invalidFileUpload("The Volume destination must be a safe relative folder.");
  }

  if (catalog === null || schema === null || volume === null) {
    throw invalidFileUpload(
      "Choose a catalog, schema, and Volume before generating a FileUpload preview.",
    );
  }

  return ["Volumes", catalog, schema, volume, ...readFolderSegments(filePath)].join("/");
}

function readOptionalResourceName(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_RESOURCE_NAME_LENGTH ||
    value.trim() !== value ||
    value.includes("/") ||
    value.includes("\\") ||
    value === "." ||
    value === ".." ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidFileUpload("Volume resource names must be valid text.");
  }

  return value;
}

function isValidRelativeFolder(value: string): boolean {
  if (
    value.length > MAX_FOLDER_LENGTH ||
    value.trim() !== value ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return false;
  }

  return readFolderSegments(value).every(
    (segment) => segment !== "" && segment !== "." && segment !== "..",
  );
}

function readFolderSegments(value: string): string[] {
  return value === "" ? [] : value.split("/");
}

function isSupportedFileUploadLayout(layout: ProjectJsonObject | null): boolean {
  if (layout === null) {
    return true;
  }

  if (hasUnexpectedProperties(layout, ["y", "tabIndex"])) {
    return false;
  }

  const y = layout.y;
  const tabIndex = layout.tabIndex;
  return (
    (y === undefined ||
      (typeof y === "number" && Number.isFinite(y) && y >= 0)) &&
    (tabIndex === undefined ||
      (typeof tabIndex === "number" &&
        Number.isSafeInteger(tabIndex) &&
        tabIndex >= 0))
  );
}

function appendInMemoryUpload(
  lines: string[],
  variableName: string,
  processedFilesKey: string,
): void {
  lines.push(
    `if ${variableName}:`,
    `    vdab_processed_${variableName} = st.session_state[${pythonString(processedFilesKey)}]`,
    `    vdab_added_${variableName} = 0`,
    `    for vdab_file_${variableName} in ${variableName}:`,
    `        vdab_bytes_${variableName} = vdab_file_${variableName}.getvalue()`,
    `        vdab_name_${variableName} = _vdab_safe_upload_name(vdab_file_${variableName}.name)`,
    `        vdab_signature_${variableName} = _vdab_upload_signature(vdab_name_${variableName}, vdab_bytes_${variableName})`,
    `        if vdab_signature_${variableName} not in vdab_processed_${variableName}:`,
    `            vdab_processed_${variableName}.append(vdab_signature_${variableName})`,
    `            vdab_added_${variableName} += 1`,
    `    st.session_state[${pythonString(processedFilesKey)}] = vdab_processed_${variableName}`,
    `    if vdab_added_${variableName} > 0:`,
    `        st.toast(f"Added {vdab_added_${variableName}} file(s) (in memory)", icon=":material/info:")`,
    "else:",
    `    st.session_state.pop(${pythonString(processedFilesKey)}, None)`,
  );
}

function appendVolumeUpload(
  lines: string[],
  variableName: string,
  processedFilesKey: string,
  volumePath: string,
): void {
  lines.push(
    `if ${variableName}:`,
    `    vdab_processed_${variableName} = st.session_state[${pythonString(processedFilesKey)}]`,
    `    vdab_seen_names_${variableName} = set()`,
    `    vdab_uploaded_count_${variableName} = 0`,
    `    for vdab_file_${variableName} in ${variableName}:`,
    `        try:`,
    `            vdab_name_${variableName} = _vdab_safe_upload_name(vdab_file_${variableName}.name)`,
    `        except ValueError:`,
    `            st.error("Upload skipped: a file name cannot be used safely.")`,
    `            continue`,
    `        if vdab_name_${variableName} in vdab_seen_names_${variableName}:`,
    `            st.error("Upload skipped: two files use the same destination name.")`,
    `            continue`,
    `        vdab_seen_names_${variableName}.add(vdab_name_${variableName})`,
    `        vdab_bytes_${variableName} = vdab_file_${variableName}.getvalue()`,
    `        vdab_signature_${variableName} = _vdab_upload_signature(vdab_name_${variableName}, vdab_bytes_${variableName})`,
    `        if vdab_signature_${variableName} in vdab_processed_${variableName}:`,
    `            continue`,
    `        try:`,
    `            _vdab_upload_to_volume(vdab_bytes_${variableName}, ${pythonString(volumePath)}, vdab_name_${variableName})`,
    `        except RuntimeError as vdab_error_${variableName}:`,
    `            st.error(str(vdab_error_${variableName}))`,
    `            continue`,
    `        vdab_processed_${variableName}.append(vdab_signature_${variableName})`,
    `        vdab_uploaded_count_${variableName} += 1`,
    `    st.session_state[${pythonString(processedFilesKey)}] = vdab_processed_${variableName}`,
    `    if vdab_uploaded_count_${variableName} > 0:`,
    `        st.success(f"Uploaded {vdab_uploaded_count_${variableName}} file(s) to the selected Volume.")`,
    "else:",
    `    st.session_state.pop(${pythonString(processedFilesKey)}, None)`,
  );
}
