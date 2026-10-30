import type { AuthenticationMode } from "./WorkspaceResource";
export const WORKSPACE_CHAT_ENDPOINT_TASK = "llm/v1/chat";

export type WorkspaceServingEndpointReadiness = "ready" | "not-ready" | "unknown";
export type WorkspaceServingEndpointPermission = "CAN_VIEW" | "CAN_QUERY" | "CAN_MANAGE";

export interface IWorkspaceServingEndpoint {
  task?: string;
  name: string;
  readiness: WorkspaceServingEndpointReadiness;
  permissionLevel: WorkspaceServingEndpointPermission | null;
}

export interface IWorkspaceServingEndpointsPage {
  items: IWorkspaceServingEndpoint[];
  authenticationMode: AuthenticationMode;
}

export class WorkspaceServingEndpoint implements IWorkspaceServingEndpoint {
  task?: string;
  name: string;
  readiness: WorkspaceServingEndpointReadiness;
  permissionLevel: WorkspaceServingEndpointPermission | null;

  constructor(source: Partial<IWorkspaceServingEndpoint> = {}) {
    this.name = source.name ?? "";
    this.task = source.task;
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
