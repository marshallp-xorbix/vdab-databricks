import type {
  LakebaseAutoscalingBranchOption,
  LakebaseAutoscalingEndpointOption,
  LakebaseAutoscalingProjectOption,
  LakebaseAutoscalingSelectorResponse,
} from "../../providers/DatabricksDataConnectorApi";
import { extractResourceIdSegment, isUuidLike } from "./autoscalingLabels";

function normalizeDisplay(
  raw: LakebaseAutoscalingEndpointOption["selectorDisplay"],
  endpointId: string,
  endpointName: string,
  projectId: string,
  branchId: string,
): NonNullable<LakebaseAutoscalingEndpointOption["selectorDisplay"]> {
  const short =
    (endpointName?.trim() || endpointId?.trim() || "").trim() || endpointId;
  const primary =
    raw?.primaryLabel?.trim() ||
    short ||
    `${projectId} / ${branchId} / ${endpointId}`;
  const secondary = raw?.secondaryLabel?.trim() || "";
  const search =
    raw?.searchText?.trim() ||
    [projectId, branchId, endpointId, primary, secondary]
      .filter(Boolean)
      .join(" ");

  return {
    primaryLabel: primary,
    secondaryLabel: secondary,
    searchText: search,
  };
}

function normalizeEndpoint(
  endpoint: LakebaseAutoscalingEndpointOption | undefined | null,
  projectId: string,
  branchId: string,
): LakebaseAutoscalingEndpointOption | null {
  if (!endpoint) {
    return null;
  }

  const endpointId = (endpoint.endpointId ?? "").trim();
  const endpointName = (endpoint.endpointName ?? "").trim();
  if (!endpointId && !endpointName) {
    return null;
  }

  return {
    ...endpoint,
    postgresDatabaseName: (endpoint.postgresDatabaseName ?? "").trim(),
    endpointId: endpointId || endpointName,
    endpointName: endpointName || endpoint.endpointName || "",
    endpointType: (endpoint.endpointType ?? "").trim(),
    selectorDisplay: normalizeDisplay(
      endpoint.selectorDisplay,
      endpointId || endpointName,
      endpointName,
      projectId,
      branchId,
    ),
  };
}

function normalizeBranch(
  branch: LakebaseAutoscalingBranchOption | undefined | null,
  projectId: string,
): LakebaseAutoscalingBranchOption | null {
  if (!branch) {
    return null;
  }

  let branchId = (branch.branchId ?? "").trim();
  let branchName = (branch.branchName ?? "").trim();

  if (branchId.includes("/")) {
    branchId = extractResourceIdSegment(branchId);
  }

  if (branchName.includes("/")) {
    const fromPath = extractResourceIdSegment(branchName);
    if (!branchId) {
      branchId = fromPath;
    }
    branchName = "";
  }

  if (!branchId && branchName) {
    branchId = extractResourceIdSegment(branchName);
  }

  if (!branchId && !branchName) {
    return null;
  }

  const endpointsRaw = Array.isArray(branch.endpoints) ? branch.endpoints : [];
  const endpoints: LakebaseAutoscalingEndpointOption[] = [];
  const branchKey = branchId || branchName;
  for (const endpoint of endpointsRaw) {
    const normalized = normalizeEndpoint(endpoint, projectId, branchKey);
    if (normalized) {
      endpoints.push(normalized);
    }
  }

  return {
    ...branch,
    branchId: branchId || branchName,
    branchName,
    isDefault: Boolean(branch.isDefault),
    endpoints,
  };
}

export function normalizeLakebaseAutoscalingSelector(
  raw: LakebaseAutoscalingSelectorResponse | null | undefined,
): LakebaseAutoscalingSelectorResponse {
  const projectsRaw = raw?.projects;
  if (!Array.isArray(projectsRaw)) {
    return { projects: [] };
  }

  const projects: LakebaseAutoscalingProjectOption[] = [];
  for (const project of projectsRaw) {
    if (!project) {
      continue;
    }

    const projectId = (project.projectId ?? "").trim();
    const projectName = (project.projectName ?? "").trim();
    if (!projectId && !projectName) {
      continue;
    }

    const branchesRaw = Array.isArray(project.branches) ? project.branches : [];
    const branches: LakebaseAutoscalingBranchOption[] = [];
    for (const branch of branchesRaw) {
      const normalizedBranch = normalizeBranch(branch, projectId || projectName);
      if (normalizedBranch) {
        branches.push(normalizedBranch);
      }
    }

    const rawDisplay = (project.displayName ?? "").trim();
    const slugFromPath = projectName ? extractResourceIdSegment(projectName) : "";
    const displayName =
      rawDisplay && !isUuidLike(rawDisplay)
        ? rawDisplay
        : slugFromPath && !isUuidLike(slugFromPath)
          ? slugFromPath
          : rawDisplay || slugFromPath || projectId || projectName;

    projects.push({
      ...project,
      projectId: projectId || projectName,
      projectName: projectName || project.projectName || "",
      displayName,
      branches,
    });
  }

  return { projects };
}
