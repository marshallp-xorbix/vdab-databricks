/** Display hints used by the Lakebase Autoscaling resource picker. */
export interface LakebaseAutoscalingSelectorDisplay {
  primaryLabel?: string;
  secondaryLabel?: string;
  searchText?: string;
}

export interface LakebaseAutoscalingEndpointOption {
  /** Postgres logical database name, not the compute endpoint ID. */
  postgresDatabaseName?: string;
  /** Databricks Apps database resource ID used for generated app bindings. */
  appsDatabaseResourceId?: string;
  endpointName: string;
  endpointId: string;
  endpointType: string;
  autoscalingLimitMinCu?: number | null;
  autoscalingLimitMaxCu?: number | null;
  suspendTimeoutDuration?: string | null;
  effectiveStatus?: string | null;
  selectorDisplay?: LakebaseAutoscalingSelectorDisplay;
  /** Read-write endpoint ID used for caller-scoped metadata reads. */
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
