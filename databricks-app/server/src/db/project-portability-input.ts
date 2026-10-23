import { ApplicationError } from "../application-error.ts";
import { addUsage, isPortableResourceKind, isRecord } from "./project-portability-shared.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "./project-custom-modules-contract.ts";
import { readProjectCustomModulesInput } from "./project-custom-modules-input.ts";
import { readComponentsInput } from "./project-components-input.ts";
import type {
  ImportedProjectAggregate,
  PortableResourceKind,
  PortableResourceReference,
} from "./project-portability-contract.ts";
import { readProjectWorkflowInput } from "./project-workflow-input.ts";

const MAX_IMPORT_BYTES = 1_048_576;
const MAX_PROJECT_NAME_LENGTH = 100;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2_000;
const MAX_THEME_BYTES = 64_000;
const FORBIDDEN_PROPERTY_NAME = /workspace[_-]?(?:connection[_-]?)?id|workspace[_-]?(?:host|url)|tenant[_-]?id|account[_-]?id|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|api[_-]?key|credential|authorization/i;
const DATABRICKS_TOKEN_PATTERN = /\bdapi[a-f0-9]{32}\b/i;
const BEARER_SECRET_PATTERN = /\bBearer\s+[A-Za-z0-9._~-]{20,}/i;

export { createStandaloneProjectExport } from "./project-portability-export.ts";

/** Validates an untrusted standalone export and removes unresolved component bindings. */
export function readStandaloneProjectImport(value: unknown): ImportedProjectAggregate {
  let serializedValue: string;
  try {
    serializedValue = JSON.stringify(value);
  } catch {
    throw invalidProjectImport("The project export is not valid JSON data.");
  }
  if (serializedValue === undefined || Buffer.byteLength(serializedValue, "utf8") > MAX_IMPORT_BYTES) {
    throw invalidProjectImport("The project export exceeds the 1 MiB import limit.");
  }
  const root = requireRecord(value, "export");
  requireExactKeys(root, ["format", "schemaVersion", "exportedAt", "project"], "export");
  if (root.format !== "vdab-project" || root.schemaVersion !== 1) {
    throw invalidProjectImport("Only standalone VDAB project schema version 1 is supported.");
  }
  if (typeof root.exportedAt !== "string" || !Number.isFinite(Date.parse(root.exportedAt))) {
    throw invalidProjectImport("The export timestamp is invalid.");
  }

  const project = requireRecord(root.project, "project");
  requireExactKeys(project, [
    "name", "description", "theme", "customModulesSource", "components",
    "workflow", "resourceReferences", "childAppLink",
  ], "project");
  const name = requireText(project.name, MAX_PROJECT_NAME_LENGTH, "project name");
  const description = project.description === null
    ? null
    : requireText(project.description, MAX_PROJECT_DESCRIPTION_LENGTH, "project description", true);
  const references = readResourceReferences(project.resourceReferences);
  validatePortableResourceLinks(project, references);
  const referencesWithUsage = collectPortableResourceUsage(project, references);
  validateChildAppLink(project.childAppLink);
  validatePortableKeys(project, "project");
  const theme = readTheme(project.theme);
  const customModulesSource = project.customModulesSource === null
    ? DEFAULT_CUSTOM_MODULES_SOURCE
    : readProjectCustomModulesInput({ expectedVersion: 1, source: project.customModulesSource }).source;
  const portableComponents = readComponentsInput({
    version: 1,
    components: removePortableBindingPlaceholders(project.components),
  }).components;
  const workflow = readProjectWorkflowInput({
    version: 1,
    workflow: removeWorkflowPortableReferences(project.workflow),
  }).workflow;
  const normalized = {
    name,
    description,
    theme,
    customModulesSource,
    components: portableComponents,
    workflow,
    resourceReferences: referencesWithUsage,
  };

  return normalized;
}

function removePortableBindingPlaceholders(value: unknown): unknown {
  if (!Array.isArray(value)) throw invalidProjectImport("Project components must be an array.");
  return value.map((entry) => {
    const component = requireRecord(entry, "component");
    const { resourceReferenceKeys: _resourceReferenceKeys, ...componentWithoutReferenceKeys } = component;
    if (isRecord(component.bindings) && typeof component.bindings.portableResourceKey === "string") {
      requireExactKeys(component.bindings, ["portableResourceKey"], "portable component binding");
      return { ...componentWithoutReferenceKeys, bindings: null };
    }
    if (containsWorkspaceResource(component.bindings)) {
      throw invalidProjectImport("Workspace resource bindings must be represented by an unresolved portable resource key.");
    }
    return componentWithoutReferenceKeys;
  });
}

function removeWorkflowPortableReferences(value: unknown): unknown {
  const workflow = requireRecord(value, "workflow");
  if (!Array.isArray(workflow.workflows)) throw invalidProjectImport("Workflow definitions must be an array.");
  return {
    ...workflow,
    workflows: workflow.workflows.map((entry) => {
      const definition = requireRecord(entry, "workflow definition");
      if (!Array.isArray(definition.nodes)) throw invalidProjectImport("Workflow actions must be an array.");
      return {
        ...definition,
        nodes: definition.nodes.map((entryNode) => {
          const node = requireRecord(entryNode, "workflow action");
          const params = requireRecord(node.params, "workflow action parameters");
          const { portableResourceKey: _portableResourceKey, ...portableParams } = params;
          return { ...node, params: portableParams };
        }),
      };
    }),
  };
}

function containsWorkspaceResource(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsWorkspaceResource);
  if (!isRecord(value)) return false;
  if (isRecord(value.resource) || isRecord(value.source) && isRecord(value.source.resource)) return true;
  return Object.values(value).some(containsWorkspaceResource);
}

function readResourceReferences(value: unknown): PortableResourceReference[] {
  if (!Array.isArray(value) || value.length > 500) {
    throw invalidProjectImport("Resource references must be an array of at most 500 items.");
  }
  const keys = new Set<string>();
  return value.map((entry) => {
    const reference = requireRecord(entry, "resource reference");
    if (Object.keys(reference).some((key) => !["key", "kind", "label", "componentKeys", "workflowNodeIds"].includes(key))) {
      throw invalidProjectImport("Resource reference contains unsupported fields.");
    }
    if (!["key", "kind", "label"].every((key) => Object.hasOwn(reference, key))) {
      throw invalidProjectImport("Resource reference is missing required fields.");
    }
    const key = requireText(reference.key, 160, "resource reference key");
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(key) || keys.has(key)) {
      throw invalidProjectImport("Resource reference keys must be unique portable identifiers.");
    }
    if (!isPortableResourceKind(reference.kind)) throw invalidProjectImport("A resource reference kind is unsupported.");
    keys.add(key);
    return {
      key,
      kind: reference.kind,
      label: requireText(reference.label, 500, "resource label"),
      ...optionalKeyListProperty("componentKeys", readOptionalKeyList(reference.componentKeys, "component keys")),
      ...optionalKeyListProperty("workflowNodeIds", readOptionalKeyList(reference.workflowNodeIds, "workflow node IDs")),
    };
  });
}

function validateChildAppLink(value: unknown): void {
  const childAppLink = requireRecord(value, "child app link");
  requireExactKeys(childAppLink, ["requiresSelection", "sourceDisplayName"], "child app link");
  if (childAppLink.requiresSelection !== true) {
    throw invalidProjectImport("An imported project must require a new child App selection.");
  }
  if (childAppLink.sourceDisplayName !== null) requireText(childAppLink.sourceDisplayName, 160, "child App display name", true);
}

function readTheme(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (!isRecord(value)) throw invalidProjectImport("Project theme must be an object or null.");
  validatePortableKeys(value, "theme");
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_THEME_BYTES) {
    throw invalidProjectImport("Project theme is too large.");
  }
  return value;
}

function validatePortableKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validatePortableKeys(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_PROPERTY_NAME.test(key)) {
      throw invalidProjectImport(`The export contains a forbidden authority field at ${path}.${key}.`);
    }
    if (typeof entry === "string" && (DATABRICKS_TOKEN_PATTERN.test(entry) || BEARER_SECRET_PATTERN.test(entry))) {
      throw invalidProjectImport(`The export contains a secret-like value at ${path}.${key}.`);
    }
    validatePortableKeys(entry, `${path}.${key}`);
  }
}

function validatePortableResourceLinks(
  value: unknown,
  references: PortableResourceReference[],
): void {
  const referenceKeys = new Set(references.map((reference) => reference.key));
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (!isRecord(entry)) return;
    if (typeof entry.portableResourceKey === "string" && !referenceKeys.has(entry.portableResourceKey)) {
      throw invalidProjectImport("A component points to a missing portable resource reference.");
    }
    if (Array.isArray(entry.resourceReferenceKeys) && entry.resourceReferenceKeys.some((key) => typeof key !== "string" || !referenceKeys.has(key))) {
      throw invalidProjectImport("A component points to a missing portable resource reference.");
    }
    if (typeof entry.resourceKey === "string" && entry.resourceKey.startsWith("unresolved_")) {
      const key = entry.resourceKey.slice("unresolved_".length);
      if (!referenceKeys.has(key)) throw invalidProjectImport("A workflow points to a missing portable resource reference.");
    }
    Object.values(entry).forEach(visit);
  };
  visit(value);
}

function collectPortableResourceUsage(
  project: Record<string, unknown>,
  references: PortableResourceReference[],
): PortableResourceReference[] {
  const referenceByKey = new Map(references.map((reference) => [reference.key, structuredClone(reference)]));
  const addComponent = (key: unknown, componentKey: unknown): void => {
    if (typeof key !== "string" || typeof componentKey !== "string") return;
    const reference = referenceByKey.get(key);
    if (reference) addUsage(reference, { componentKey });
  };
  const components = Array.isArray(project.components) ? project.components : [];
  for (const entry of components) {
    if (!isRecord(entry)) continue;
    const componentKey = entry.key;
    if (Array.isArray(entry.resourceReferenceKeys)) entry.resourceReferenceKeys.forEach((key) => addComponent(key, componentKey));
    if (isRecord(entry.bindings)) addComponent(entry.bindings.portableResourceKey, componentKey);
  }
  const workflow = isRecord(project.workflow) ? project.workflow : null;
  const definitions = workflow && Array.isArray(workflow.workflows) ? workflow.workflows : [];
  for (const definition of definitions) {
    if (!isRecord(definition) || !Array.isArray(definition.nodes)) continue;
    for (const node of definition.nodes) {
      if (!isRecord(node) || !isRecord(node.params)) continue;
      const resourceKey = node.params.portableResourceKey;
      const unresolvedKey = isRecord(node.params.job)
        ? node.params.job.resourceKey
        : isRecord(node.params.targetTable) ? node.params.targetTable.resourceKey : undefined;
      const key = typeof resourceKey === "string"
        ? resourceKey
        : typeof unresolvedKey === "string" && unresolvedKey.startsWith("unresolved_")
          ? unresolvedKey.slice("unresolved_".length)
          : null;
      const reference = key === null ? undefined : referenceByKey.get(key);
      if (reference && typeof node.id === "string") addUsage(reference, { workflowNodeId: node.id });
    }
  }
  return [...referenceByKey.values()];
}

function readOptionalKeyList(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 500 || value.some((entry) => typeof entry !== "string" || entry.length < 1 || entry.length > 160)) {
    throw invalidProjectImport(`Resource ${label} are invalid.`);
  }
  if (new Set(value).size !== value.length) throw invalidProjectImport(`Resource ${label} must be unique.`);
  return value as string[];
}

function optionalKeyListProperty(
  key: "componentKeys" | "workflowNodeIds",
  value: string[] | undefined,
): Partial<Pick<PortableResourceReference, typeof key>> {
  return value === undefined ? {} : { [key]: value };
}

function requireExactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw invalidProjectImport(`${label} contains unsupported or missing fields.`);
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidProjectImport(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, maximum: number, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > maximum || (!allowEmpty && value.trim().length === 0)) {
    throw invalidProjectImport(`${label} must be text of at most ${maximum} characters.`);
  }
  return value.trim();
}

function invalidProjectImport(detail: string): ApplicationError {
  return new ApplicationError(400, "invalid_project_export", "Invalid project export", detail);
}
