import type {
  LakebaseAutoscalingBranchOption,
  LakebaseAutoscalingEndpointOption,
  LakebaseAutoscalingProjectOption,
} from "../../providers/DatabricksDataConnectorApi";

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AutoscalingDatabaseOption {
  value: string;
  label: string;
}

export interface ParsedAutoscalingInstanceName {
  projectId: string;
  branchUid: string;
}

export function isUuidLike(value?: string | null): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return false;
  }

  const lastSegment = trimmed.split("/").pop() ?? trimmed;
  return UUID_LIKE.test(lastSegment);
}

export function extractResourceIdSegment(path?: string | null): string {
  const trimmed = path?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  const lastSlash = trimmed.lastIndexOf("/");
  return lastSlash >= 0 ? trimmed.slice(lastSlash + 1).trim() : trimmed;
}

export function firstNonUuidLike(
  ...values: Array<string | undefined | null>
): string {
  for (const raw of values) {
    const value = raw?.trim() ?? "";
    if (value && !isUuidLike(value)) {
      return value;
    }
  }

  for (const raw of values) {
    const value = raw?.trim() ?? "";
    if (value) {
      return value;
    }
  }

  return "";
}

export function getAutoscalingProjectPickerLabel(
  project?: LakebaseAutoscalingProjectOption | null,
): string | null {
  if (!project) {
    return null;
  }

  const label = firstNonUuidLike(
    project.displayName,
    extractResourceIdSegment(project.projectName),
    project.projectId,
  );

  return label && !isUuidLike(label) ? label : null;
}

export function formatAutoscalingProjectLabel(
  project?: LakebaseAutoscalingProjectOption | null,
): string {
  return (
    getAutoscalingProjectPickerLabel(project) ??
    firstNonUuidLike(project?.projectName, project?.projectId)
  );
}

export function formatAutoscalingBranchLabel(
  branch?: LakebaseAutoscalingBranchOption | null,
): string {
  const branchId = extractResourceIdSegment(branch?.branchId);
  if (branchId) {
    return branchId;
  }

  return firstNonUuidLike(branch?.branchName);
}

export function parseAutoscalingInstanceName(
  instanceName?: string | null,
): ParsedAutoscalingInstanceName {
  const trimmed = instanceName?.trim() ?? "";
  if (!trimmed) {
    return { projectId: "", branchUid: "" };
  }

  const slash = trimmed.indexOf("/");
  if (slash <= 0) {
    return { projectId: trimmed, branchUid: "" };
  }

  return {
    projectId: trimmed.slice(0, slash).trim(),
    branchUid: trimmed.slice(slash + 1).trim(),
  };
}

export function pickWireDatabaseResourceId(
  endpoint?: LakebaseAutoscalingEndpointOption | null,
): string {
  const appsDatabaseId = endpoint?.appsDatabaseResourceId?.trim() ?? "";
  if (appsDatabaseId) {
    return appsDatabaseId;
  }

  return endpoint?.endpointId?.trim() ?? "";
}

function isComputeAutoscalingSecondaryLabel(value?: string | null): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return false;
  }

  return /\bCU\b/i.test(trimmed) || /\bENDPOINT_TYPE_/i.test(trimmed);
}

function secondaryLabelForDatabasePicker(
  endpoint?: LakebaseAutoscalingEndpointOption | null,
): string {
  const trimmed = endpoint?.selectorDisplay?.secondaryLabel?.trim() ?? "";
  return isComputeAutoscalingSecondaryLabel(trimmed) ? "" : trimmed;
}

function getLogicalPostgresDatabaseNameFromEndpoint(
  endpoint?: LakebaseAutoscalingEndpointOption | null,
): string {
  const postgresName = endpoint?.postgresDatabaseName?.trim() ?? "";
  if (postgresName && !postgresName.toLowerCase().startsWith("db-")) {
    return postgresName;
  }

  const secondaryLabel = secondaryLabelForDatabasePicker(endpoint);
  if (secondaryLabel && !secondaryLabel.toLowerCase().startsWith("db-")) {
    return secondaryLabel;
  }

  return "";
}

function isDatabaseLinkedEndpoint(
  endpoint?: LakebaseAutoscalingEndpointOption | null,
): boolean {
  const endpointType = (endpoint?.endpointType ?? "").toUpperCase();
  if (endpointType === "DATABASE_RESOURCE") {
    return true;
  }

  const endpointId = endpoint?.endpointId?.trim() ?? "";
  if (endpointId.startsWith("db-")) {
    return true;
  }

  return Boolean(endpoint?.appsDatabaseResourceId?.trim());
}

function preferEndpointForDatabaseRow(
  left: LakebaseAutoscalingEndpointOption,
  right: LakebaseAutoscalingEndpointOption,
): LakebaseAutoscalingEndpointOption {
  const score = (endpoint: LakebaseAutoscalingEndpointOption): number => {
    let total = 0;
    if ((endpoint.endpointType ?? "").toUpperCase() === "DATABASE_RESOURCE") {
      total += 4;
    }

    if (getLogicalPostgresDatabaseNameFromEndpoint(endpoint)) {
      total += 2;
    }

    if (endpoint.appsDatabaseResourceId?.trim()) {
      total += 1;
    }

    return total;
  };

  return score(right) > score(left) ? right : left;
}

function pickEndpointsForAppsDatabasePicker(
  branch?: LakebaseAutoscalingBranchOption | null,
): LakebaseAutoscalingEndpointOption[] {
  const endpoints = branch?.endpoints ?? [];
  const linkedEndpoints = endpoints.filter(isDatabaseLinkedEndpoint);
  const pool = linkedEndpoints.length > 0 ? linkedEndpoints : endpoints;
  const byKey = new Map<string, LakebaseAutoscalingEndpointOption[]>();

  for (const endpoint of pool) {
    const key = pickWireDatabaseResourceId(endpoint);
    if (!key) {
      continue;
    }

    const group = byKey.get(key) ?? [];
    group.push(endpoint);
    byKey.set(key, group);
  }

  const selected: LakebaseAutoscalingEndpointOption[] = [];
  for (const group of byKey.values()) {
    if (group.length === 1) {
      selected.push(group[0]);
      continue;
    }

    selected.push(group.reduce(preferEndpointForDatabaseRow));
  }

  return selected;
}

function endpointLabel(endpoint: LakebaseAutoscalingEndpointOption): string {
  const endpointId = endpoint.endpointId?.trim() ?? "";
  const appsDatabaseId = endpoint.appsDatabaseResourceId?.trim() ?? "";

  return (
    firstNonUuidLike(
      getLogicalPostgresDatabaseNameFromEndpoint(endpoint),
      endpoint.endpointName,
      endpoint.selectorDisplay?.primaryLabel,
      appsDatabaseId,
      endpointId,
    ) || appsDatabaseId || endpointId
  );
}

export function getPostgresDatabaseNameForWirePick(
  branch?: LakebaseAutoscalingBranchOption | null,
  pick?: string | null,
): string {
  const selected = pick?.trim() ?? "";
  if (!branch || !selected) {
    return "";
  }

  const canonical = pickEndpointsForAppsDatabasePicker(branch).find(
    (endpoint) => pickWireDatabaseResourceId(endpoint) === selected,
  );
  if (canonical) {
    return getLogicalPostgresDatabaseNameFromEndpoint(canonical);
  }

  const fallback = (branch.endpoints ?? []).find(
    (endpoint) => pickWireDatabaseResourceId(endpoint) === selected,
  );
  return getLogicalPostgresDatabaseNameFromEndpoint(fallback);
}

export function getWireDatabaseIdForLogicalName(
  branch: LakebaseAutoscalingBranchOption,
  databaseName?: string | null,
): string {
  const logical = databaseName?.trim() ?? "";
  if (!logical) {
    return "";
  }

  const canonical = pickEndpointsForAppsDatabasePicker(branch).find(
    (endpoint) => getLogicalPostgresDatabaseNameFromEndpoint(endpoint) === logical,
  );
  if (canonical) {
    return pickWireDatabaseResourceId(canonical);
  }

  const fallback = (branch.endpoints ?? []).find(
    (endpoint) => getLogicalPostgresDatabaseNameFromEndpoint(endpoint) === logical,
  );
  return pickWireDatabaseResourceId(fallback);
}

export function buildAutoscalingResourceDatabaseOptions(
  branch?: LakebaseAutoscalingBranchOption | null,
): AutoscalingDatabaseOption[] {
  const rows = pickEndpointsForAppsDatabasePicker(branch);
  const seen = new Set<string>();
  const options: AutoscalingDatabaseOption[] = [];

  for (const endpoint of rows) {
    const value = pickWireDatabaseResourceId(endpoint);
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    options.push({
      value,
      label: endpointLabel(endpoint),
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveAutoscalingDatabasePickerValue(
  branch: LakebaseAutoscalingBranchOption,
  database?: string | null,
  endpointId?: string | null,
): string | undefined {
  const options = buildAutoscalingResourceDatabaseOptions(branch);
  const savedDatabase = database?.trim() ?? "";
  const savedEndpointId = endpointId?.trim() ?? "";

  if (savedDatabase) {
    const directHit = options.find((option) => option.value === savedDatabase);
    if (directHit) {
      return directHit.value;
    }

    const logicalHit = options.find((option) => {
      const logicalName = getPostgresDatabaseNameForWirePick(branch, option.value);
      return option.label === savedDatabase || logicalName === savedDatabase;
    });
    if (logicalHit) {
      return logicalHit.value;
    }
  }

  if (savedEndpointId) {
    const endpointHit = options.find((option) => option.value === savedEndpointId);
    if (endpointHit) {
      return endpointHit.value;
    }
  }

  return undefined;
}
