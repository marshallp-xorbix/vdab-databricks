import type { AuthenticationMode } from "./WorkspaceApp";

export interface IWorkspaceSession {
  userId: string;
  preferredUsername: string | null;
  email: string | null;
  workspace: {
    id: string | null;
    host: string | null;
  };
  authenticationMode: AuthenticationMode;
  installationAdmin: boolean;
}

/** Public, token-free identity and workspace context returned by the Node app. */
export class WorkspaceSession implements IWorkspaceSession {
  userId: string;
  preferredUsername: string | null;
  email: string | null;
  workspace: { id: string | null; host: string | null };
  authenticationMode: AuthenticationMode;
  installationAdmin: boolean;

  constructor(source: Partial<IWorkspaceSession> = {}) {
    this.userId = source.userId ?? "";
    this.preferredUsername = source.preferredUsername ?? null;
    this.email = source.email ?? null;
    this.workspace = {
      id: source.workspace?.id ?? null,
      host: source.workspace?.host ?? null,
    };
    this.authenticationMode = source.authenticationMode ?? "databricks";
    this.installationAdmin = source.installationAdmin ?? false;
  }
}
