import type { AuthenticationMode } from "./WorkspaceResource";

export type WorkspaceServingEndpointReadiness = "ready" | "not-ready" | "unknown";
export type WorkspaceServingEndpointPermission = "CAN_VIEW" | "CAN_QUERY" | "CAN_MANAGE";

export interface IWorkspaceServingEndpoint {
  name: string;
  readiness: WorkspaceServingEndpointReadiness;
  permissionLevel: WorkspaceServingEndpointPermission | null;
}

export interface IWorkspaceServingEndpointsPage {
  items: IWorkspaceServingEndpoint[];
  authenticationMode: AuthenticationMode;
}

export class WorkspaceServingEndpoint implements IWorkspaceServingEndpoint {
  name: string;
  readiness: WorkspaceServingEndpointReadiness;
  permissionLevel: WorkspaceServingEndpointPermission | null;

  constructor(source: Partial<IWorkspaceServingEndpoint> = {}) {
    this.name = source.name ?? "";
    this.readiness = source.readiness ?? "unknown";
    this.permissionLevel = source.permissionLevel ?? null;
  }
}

export class WorkspaceServingEndpointsPage implements IWorkspaceServingEndpointsPage {
  items: WorkspaceServingEndpoint[];
  authenticationMode: AuthenticationMode;

  constructor(source: Partial<IWorkspaceServingEndpointsPage> = {}) {
    this.items = (source.items ?? []).map((endpoint) => new WorkspaceServingEndpoint(endpoint));
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}
