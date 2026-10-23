import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export async function readFirstListedProjectId(response: Response): Promise<string> {
  const payload: unknown = await response.json();

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("items" in payload) ||
    !Array.isArray(payload.items) ||
    payload.items.length === 0
  ) {
    throw new Error("The packaged app did not return the created project.");
  }

  return readProjectId(payload.items[0]);
}

export function readProjectId(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new Error("The packaged app returned an invalid project response.");
  }

  return value.id;
}

export function readRegistryComponentCount(value: unknown): number {
  return readArrayProperty(value, "components").length;
}

export function readRegistryBindingCount(value: unknown): number {
  return readArrayProperty(value, "bindingSchemas").length;
}

export function readRegistryStoryCount(value: unknown): number {
  return readArrayProperty(value, "components").filter(
    (component: unknown) =>
      isRecord(component) &&
      typeof component.type === "string" &&
      component.type.endsWith("Story"),
  ).length;
}

export function readComponentDefinitionType(value: unknown): string {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error(
      "The packaged app returned an invalid component definition.",
    );
  }

  return value.type;
}

export function readArrayProperty(value: unknown, property: string): unknown[] {
  if (
    !isRecord(value) ||
    !(property in value) ||
    !Array.isArray(value[property])
  ) {
    throw new Error(`The packaged app returned an invalid ${property} array.`);
  }

  return value[property];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readProjectCreator(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("createdBy" in value) ||
    typeof value.createdBy !== "string"
  ) {
    throw new Error("The packaged app returned an invalid project creator.");
  }

  return value.createdBy;
}

export function readProjectVersion(value: unknown): number {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    typeof value.version !== "number"
  ) {
    throw new Error("The packaged app returned an invalid project version.");
  }

  return value.version;
}

export function readComponentCount(value: unknown): number {
  if (
    typeof value !== "object" ||
    value === null ||
    !("components" in value) ||
    !Array.isArray(value.components)
  ) {
    throw new Error(
      "The packaged app returned an invalid component collection.",
    );
  }

  return value.components.length;
}

export function readComponentType(value: unknown, index: number): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("components" in value) ||
    !Array.isArray(value.components)
  ) {
    throw new Error(
      "The packaged app returned an invalid component collection.",
    );
  }

  const component: unknown = value.components[index];
  if (
    typeof component !== "object" ||
    component === null ||
    !("type" in component) ||
    typeof component.type !== "string"
  ) {
    throw new Error("The packaged app returned an invalid component type.");
  }

  return component.type;
}

export function readFirstComponentKey(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("components" in value) ||
    !Array.isArray(value.components) ||
    value.components.length === 0
  ) {
    throw new Error("The packaged app returned no saved components.");
  }

  const component: unknown = value.components[0];

  if (
    typeof component !== "object" ||
    component === null ||
    !("key" in component) ||
    typeof component.key !== "string"
  ) {
    throw new Error("The packaged app returned an invalid component key.");
  }

  return component.key;
}

export function readPreviewOnly(value: unknown): boolean {
  if (!isRecord(value) || value.previewOnly !== true) {
    throw new Error("The packaged app returned an invalid preview response.");
  }

  return true;
}

export function readPreviewAppSource(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("The packaged app returned no preview files.");
  }

  const appFile: unknown = value.files.find(
    (file: unknown) => isRecord(file) && file.path === "app.py",
  );
  if (!isRecord(appFile) || typeof appFile.content !== "string") {
    throw new Error("The packaged app returned no generated app.py file.");
  }

  return appFile.content;
}

export function runGeneratedWorkflowHarness(value: unknown): void {
  const files = readPreviewPythonFiles(value);
  const pythonExecutable =
    process.env.VDAB_PYTHON_EXECUTABLE ??
    (process.platform === "win32" ? "python" : "python3");
  const harnessPath = resolve(
    import.meta.dirname,
    "smoke-generated-workflow.py",
  );
  const result = spawnSync(pythonExecutable, [harnessPath], {
    input: JSON.stringify({ files }),
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 4_000_000,
  });

  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report: unknown = JSON.parse(result.stdout);
  assert.ok(
    isRecord(report) && report.event === "generated-workflow-smoke.passed",
  );
  assert.deepEqual(report.checks, [
    "button-callback-all-actions-success",
    "button-callback-sql-failure-route",
    "button-callback-job-failure-route",
    "form-save-to-table-success",
    "form-save-to-table-failure-route",
    "all-eight-generated-stories-empty-results",
    "viewer-sql-and-volume-redirects-denied",
    "generated-sql-response-and-result-bounds",
  ]);
}

export function readPreviewPythonFiles(
  value: unknown,
): Array<{ path: string; content: string }> {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error(
      "The packaged app returned no preview files for workflow runtime verification.",
    );
  }
  const allowedPaths = new Set([
    "app.py",
    "custom_modules.py",
    "prebuilt_modules_library.py",
  ]);
  return value.files.flatMap((entry: unknown) => {
    if (
      !isRecord(entry) ||
      typeof entry.path !== "string" ||
      typeof entry.content !== "string" ||
      !allowedPaths.has(entry.path)
    ) {
      return [];
    }
    const invalidTextIndex = findUnpairedSurrogateIndex(entry.content);
    if (invalidTextIndex !== null) {
      throw new Error(
        `Generated ${entry.path} contains invalid Unicode at UTF-16 offset ${invalidTextIndex}.`,
      );
    }
    return [{ path: entry.path, content: entry.content }];
  });
}

export function findUnpairedSurrogateIndex(value: string): number | null {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1);
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        index += 1;
      } else {
        return index;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return index;
    }
  }
  return null;
}

export function readPreviewModuleSource(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("The packaged app returned no preview files.");
  }
  const moduleFile: unknown = value.files.find(
    (file: unknown) => isRecord(file) && file.path === "custom_modules.py",
  );
  if (!isRecord(moduleFile) || typeof moduleFile.content !== "string") {
    throw new Error(
      "The packaged app returned no generated custom_modules.py file.",
    );
  }
  return moduleFile.content;
}

export function readCustomModulesSource(value: unknown): string {
  if (!isRecord(value) || typeof value.source !== "string") {
    throw new Error(
      "The packaged app returned an invalid custom modules document.",
    );
  }
  return value.source;
}

export function readPortableProjectName(value: unknown): string {
  if (
    !isRecord(value) ||
    !isRecord(value.project) ||
    typeof value.project.name !== "string"
  ) {
    throw new Error("The packaged app returned an invalid standalone export.");
  }
  return value.project.name;
}

export function readImportedProject(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.project)) {
    throw new Error(
      "The packaged app returned an invalid project import result.",
    );
  }
  return value.project;
}

export function readWorkspaceBoundComponentKeys(value: unknown): string[] {
  if (
    !isRecord(value) ||
    !isRecord(value.project) ||
    !Array.isArray(value.project.components)
  ) {
    throw new Error("The packaged app returned invalid portable components.");
  }
  return value.project.components.flatMap((entry: unknown) => {
    if (
      !isRecord(entry) ||
      typeof entry.key !== "string" ||
      !isRecord(entry.bindings)
    ) {
      return [];
    }
    return Object.hasOwn(entry.bindings, "resource") ||
      Object.values(entry.bindings).some(
        (binding: unknown) =>
          isRecord(binding) &&
          (Object.hasOwn(binding, "resource") ||
            (isRecord(binding.source) &&
              Object.hasOwn(binding.source, "resource"))),
      )
      ? [entry.key]
      : [];
  });
}

export function readImportRequiresChildAppSelection(value: unknown): boolean {
  if (!isRecord(value) || value.requiresChildAppSelection !== true) {
    throw new Error(
      "The packaged app did not require a new child-App selection.",
    );
  }
  return true;
}

export function readUnresolvedResourceCount(value: unknown): number {
  if (!isRecord(value) || !Array.isArray(value.unresolvedResources)) {
    throw new Error(
      "The packaged app returned invalid unresolved resource references.",
    );
  }
  return value.unresolvedResources.length;
}
