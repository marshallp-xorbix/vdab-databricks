export interface LakebaseAutoscalingSelectorDisplay {
  primaryLabel?: string;
  secondaryLabel?: string;
  searchText?: string;
}

export interface LakebaseAutoscalingEndpointOption {
  postgresDatabaseName?: string;
  appsDatabaseResourceId?: string;
  endpointName: string;
  endpointId: string;
  endpointType: string;
  autoscalingLimitMinCu?: number | null;
  autoscalingLimitMaxCu?: number | null;
  suspendTimeoutDuration?: string | null;
  effectiveStatus?: string | null;
  selectorDisplay?: LakebaseAutoscalingSelectorDisplay;
  metadataEndpointId?: string;
}

export interface LakebaseAutoscalingBranchOption {
  branchName: string;
  branchId: string;
  isDefault: boolean;
  endpoints: LakebaseAutoscalingEndpointOption[];
}

export interface LakebaseAutoscalingProjectOption {
  projectName: string;
  projectId: string;
  displayName: string;
  branches: LakebaseAutoscalingBranchOption[];
}

export interface LakebaseAutoscalingSelectorResponse {
  projects: LakebaseAutoscalingProjectOption[];
}
