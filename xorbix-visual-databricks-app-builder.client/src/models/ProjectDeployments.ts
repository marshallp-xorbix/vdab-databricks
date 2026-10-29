export type ProjectChildAppMode = "createNew" | "linkExisting";
export type ProjectDeploymentStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface IProjectChildAppLink {
  appId: string | null;
  appName: string;
  mode: ProjectChildAppMode;
  sourceCodePath: string | null;
}

export class ProjectChildAppLink implements IProjectChildAppLink {
  appId: string | null;
  appName: string;
  mode: ProjectChildAppMode;
  sourceCodePath: string | null;

  constructor(source: Partial<IProjectChildAppLink> = {}) {
    this.appId = source.appId ?? null;
    this.appName = source.appName ?? "";
    this.mode = source.mode ?? "createNew";
    this.sourceCodePath = source.sourceCodePath ?? null;
  }
}

export interface IProjectDeploymentSummary {
  id: string;
  projectId: string;
  appName: string;
  mode: ProjectChildAppMode;
  sourceVersion: number;
  status: ProjectDeploymentStatus;
  deploymentId: string | null;
  sourceCodePath: string | null;
  failureCode: string | null;
  attemptOf: string | null;
  createdAt: string;
  completedAt: string | null;
}

export class ProjectDeploymentSummary implements IProjectDeploymentSummary {
  id: string;
  projectId: string;
  appName: string;
  mode: ProjectChildAppMode;
  sourceVersion: number;
  status: ProjectDeploymentStatus;
  deploymentId: string | null;
  sourceCodePath: string | null;
  failureCode: string | null;
  attemptOf: string | null;
  createdAt: string;
  completedAt: string | null;

  constructor(source: Partial<IProjectDeploymentSummary> = {}) {
    this.id = source.id ?? "";
    this.projectId = source.projectId ?? "";
    this.appName = source.appName ?? "";
    this.mode = source.mode ?? "createNew";
    this.sourceVersion = source.sourceVersion ?? 1;
    this.status = source.status ?? "pending";
    this.deploymentId = source.deploymentId ?? null;
    this.sourceCodePath = source.sourceCodePath ?? null;
    this.failureCode = source.failureCode ?? null;
    this.attemptOf = source.attemptOf ?? null;
    this.createdAt = source.createdAt ?? "";
    this.completedAt = source.completedAt ?? null;
  }
}

export interface IProjectDeploymentHistory {
  childApp: IProjectChildAppLink | null;
  items: IProjectDeploymentSummary[];
}

export class ProjectDeploymentHistory implements IProjectDeploymentHistory {
  childApp: ProjectChildAppLink | null;
  items: ProjectDeploymentSummary[];

  constructor(source: Partial<IProjectDeploymentHistory> = {}) {
    this.childApp = source.childApp ? new ProjectChildAppLink(source.childApp) : null;
    this.items = (source.items ?? []).map((item) => new ProjectDeploymentSummary(item));
  }
}

export interface IProjectDeploymentReadiness {
  userApiScopes: string[];
  appResources: IWorkspaceAppResource[];
  blockers: Array<{ code: string; detail: string }>;
}

export type IWorkspaceLakebaseAppResource =
  | {
      name: string;
      description: string;
      postgres: { database: string; permission: "CAN_CONNECT_AND_CREATE" };
    }
  | {
      name: string;
      description: string;
      database: {
        instance_name: string;
        database_name: string;
        permission: "CAN_CONNECT_AND_CREATE";
      };
    };

export interface IWorkspaceSqlWarehouseAppResource {
  name: string;
  description: string;
  sql_warehouse: {
    id: string;
    permission: "CAN_USE" | "CAN_MANAGE" | "IS_OWNER";
  };
}

export interface IWorkspaceSecretAppResource {
  name: string;
  description: string;
  secret: {
    scope: string;
    key: string;
    permission: "READ" | "WRITE" | "MANAGE";
  };
}

export interface IWorkspaceSecretResourceSelection {
  name: string;
  scope: string;
  key: string;
}

export type IWorkspaceAppResource =
  | IWorkspaceLakebaseAppResource
  | IWorkspaceSqlWarehouseAppResource
  | IWorkspaceSecretAppResource;

export class ProjectDeploymentReadiness implements IProjectDeploymentReadiness {
  userApiScopes: string[];
  appResources: IWorkspaceAppResource[];
  blockers: Array<{ code: string; detail: string }>;

  constructor(source: Partial<IProjectDeploymentReadiness> = {}) {
    this.userApiScopes = source.userApiScopes ?? [];
    this.appResources = source.appResources ?? [];
    this.blockers = source.blockers ?? [];
  }
}

export interface IWorkspaceAppDeploymentTarget {
  appId: string | null;
  name: string;
  description: string | null;
  spaceName: string | null;
  effectiveUserApiScopes: string[] | null;
  appState: string | null;
  computeState: string | null;
  appUrl: string | null;
  activeDeploymentId: string | null;
  sourceCodePath: string | null;
  usesGitSource: boolean;
  userApiScopes: string[];
  appResources: IWorkspaceAppResource[];
  secretResources: IWorkspaceSecretAppResource[];
  unsupportedResourceCount: number;
}

export class WorkspaceAppDeploymentTarget implements IWorkspaceAppDeploymentTarget {
  appId: string | null;
  name: string;
  description: string | null;
  spaceName: string | null;
  effectiveUserApiScopes: string[] | null;
  appState: string | null;
  computeState: string | null;
  appUrl: string | null;
  activeDeploymentId: string | null;
  sourceCodePath: string | null;
  usesGitSource: boolean;
  userApiScopes: string[];
  appResources: IWorkspaceAppResource[];
  secretResources: IWorkspaceSecretAppResource[];
  unsupportedResourceCount: number;

  constructor(source: Partial<IWorkspaceAppDeploymentTarget> = {}) {
    this.appId = source.appId ?? null;
    this.name = source.name ?? "";
    this.description = source.description ?? null;
    this.spaceName = source.spaceName ?? null;
    this.effectiveUserApiScopes = source.effectiveUserApiScopes ?? null;
    this.appState = source.appState ?? null;
    this.computeState = source.computeState ?? null;
    this.appUrl = source.appUrl ?? null;
    this.activeDeploymentId = source.activeDeploymentId ?? null;
    this.sourceCodePath = source.sourceCodePath ?? null;
    this.usesGitSource = source.usesGitSource ?? false;
    this.userApiScopes = source.userApiScopes ?? [];
    this.appResources = source.appResources ?? [];
    this.secretResources = source.secretResources ?? [];
    this.unsupportedResourceCount = source.unsupportedResourceCount ?? 0;
  }
}
