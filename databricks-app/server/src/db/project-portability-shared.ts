import type { PortableResourceKind, PortableResourceReference } from "./project-portability-contract.ts";
import { PORTABLE_RESOURCE_KINDS } from "./project-portability-contract.ts";

export function addUsage(
  reference: PortableResourceReference,
  usage: { componentKey?: string; workflowNodeId?: string },
): void {
  if (usage.componentKey) reference.componentKeys = uniqueValues([...(reference.componentKeys ?? []), usage.componentKey]);
  if (usage.workflowNodeId) reference.workflowNodeIds = uniqueValues([...(reference.workflowNodeIds ?? []), usage.workflowNodeId]);
}

export function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

export function isPortableResourceKind(value: unknown): value is PortableResourceKind {
  return typeof value === "string" && (PORTABLE_RESOURCE_KINDS as readonly string[]).includes(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

