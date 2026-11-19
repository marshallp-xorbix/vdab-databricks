/**
 * Rewrites AI Builder workflow references that use editor code names or
 * editor field names onto the portable component-key contract before validation.
 */
export function resolveAiBuilderWorkflowReferences(
  workflows: unknown[],
  components: unknown[],
): unknown[] {
  const keyByCodeName = buildKeyByCodeName(components);
  const existingKeys = collectComponentKeys(components);
  return workflows.map((workflow) => resolveWorkflow(workflow, keyByCodeName, existingKeys));
}

function resolveWorkflow(
  value: unknown,
  keyByCodeName: Map<string, string>,
  existingKeys: Set<string>,
): unknown {
  if (!isRecord(value)) return value;
  const workflow = { ...value };
  if (isRecord(workflow.trigger)) {
    const trigger = { ...workflow.trigger };
    renameProperty(trigger, "componentCodeName", "componentKey");
    trigger.componentKey = resolveReference(trigger.componentKey, keyByCodeName, existingKeys);
    workflow.trigger = trigger;
  }
  if (Array.isArray(workflow.nodes)) {
    workflow.nodes = workflow.nodes.map((node) => resolveNode(node, keyByCodeName, existingKeys));
  }
  return workflow;
}

function resolveNode(
  value: unknown,
  keyByCodeName: Map<string, string>,
  existingKeys: Set<string>,
): unknown {
  if (!isRecord(value) || !isRecord(value.params)) return value;
  const node: Record<string, unknown> = { ...value, params: { ...value.params } };
  const params = node.params as Record<string, unknown>;
  const actionType = typeof node.actionType === "string" ? node.actionType : "";

  if (actionType === "showModal") {
    renameProperty(params, "modalCodeName", "modalComponentKey");
    params.modalComponentKey = resolveReference(
      params.modalComponentKey,
      keyByCodeName,
      existingKeys,
    );
  } else if (actionType === "saveToTable") {
    renameProperty(params, "sourceFormComponentCodeName", "sourceFormComponentKey");
    params.sourceFormComponentKey = resolveReference(
      params.sourceFormComponentKey,
      keyByCodeName,
      existingKeys,
    );
    if (Array.isArray(params.columnMappings)) {
      params.columnMappings = params.columnMappings.map((mapping) => {
        if (!isRecord(mapping)) return mapping;
        const next = { ...mapping };
        renameProperty(next, "formChildComponentCodeName", "formChildComponentKey");
        next.formChildComponentKey = resolveReference(
          next.formChildComponentKey,
          keyByCodeName,
          existingKeys,
        );
        return next;
      });
    }
  } else if (actionType === "buildSql" && Array.isArray(params.placeholders)) {
    params.placeholders = params.placeholders.map((placeholder) => {
      if (!isRecord(placeholder)) return placeholder;
      const next = { ...placeholder };
      renameProperty(next, "componentCodeName", "componentKey");
      next.componentKey = resolveReference(next.componentKey, keyByCodeName, existingKeys);
      return next;
    });
  } else if (actionType === "setBinding" && isRecord(params.target)) {
    const target = { ...params.target };
    renameProperty(target, "componentCodeName", "componentKey");
    target.componentKey = resolveReference(target.componentKey, keyByCodeName, existingKeys);
    params.target = target;
  }

  return node;
}

function resolveReference(
  value: unknown,
  keyByCodeName: Map<string, string>,
  existingKeys: Set<string>,
): unknown {
  if (typeof value !== "string") return value;
  if (existingKeys.has(value)) return value;
  const resolved = keyByCodeName.get(value.toLocaleLowerCase("en-US"));
  return resolved ?? value;
}

function buildKeyByCodeName(components: unknown[]): Map<string, string> {
  const keyByCodeName = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const component of components) {
    if (!isRecord(component) || typeof component.key !== "string") continue;
    if (typeof component.codeName !== "string" || component.codeName.trim() === "") continue;
    const normalized = component.codeName.toLocaleLowerCase("en-US");
    if (ambiguous.has(normalized)) continue;
    if (keyByCodeName.has(normalized) && keyByCodeName.get(normalized) !== component.key) {
      keyByCodeName.delete(normalized);
      ambiguous.add(normalized);
      continue;
    }
    keyByCodeName.set(normalized, component.key);
  }
  return keyByCodeName;
}

function collectComponentKeys(components: unknown[]): Set<string> {
  const keys = new Set<string>();
  for (const component of components) {
    if (isRecord(component) && typeof component.key === "string") {
      keys.add(component.key);
    }
  }
  return keys;
}

function renameProperty(
  record: Record<string, unknown>,
  from: string,
  to: string,
): void {
  if (!(from in record)) return;
  if (!(to in record)) {
    record[to] = record[from];
  }
  delete record[from];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
