/**
 * Portable export/import contracts for apps and Databricks connections.
 * These mirror the backend DTOs in `Models/DTOs/Portability` and intentionally
 * exclude identity, ownership, and secrets.
 */

/** The kinds of records an {@link IExportBundle} may contain. */
export const ExportBundleType = {
  Apps: "apps",
  Connections: "connections",
} as const;

export type ExportBundleType =
  (typeof ExportBundleType)[keyof typeof ExportBundleType];

/** Portable representation of a single app component. */
export interface IAppComponentExport {
  codeName?: string;
  description?: string;
  componentType: string;
  componentVersion: number;
  properties: string;
  bindings?: string;
  children?: string;
  layout?: string;
}

/** Portable representation of an app, including its components. */
export interface IAppExport {
  appName: string;
  databricksAppName?: string;
  description?: string;
  workspacePath?: string;
  version: number;
  theme?: string;
  workflowDefinition: string;
  customModulesCode?: string;
  /** Reference-only workspace URL used to pre-select a connection at import time. */
  workspaceUrl?: string;
  components: IAppComponentExport[];
}

/** Portable representation of a Databricks connection (never includes the secret). */
export interface IDatabricksConnectionExport {
  workspaceUrl: string;
  workspaceDisplayName: string;
  clientId?: string;
  accessTokenTtlMinutes?: number;
  refreshTokenLifespanMinutes?: number;
}

/** Versioned envelope wrapping exported apps or connections. */
export interface IExportBundle {
  schemaVersion: number;
  exportedAt: string;
  type: ExportBundleType;
  apps?: IAppExport[];
  connections?: IDatabricksConnectionExport[];
}

/** A single resolved app-import element. */
export interface IImportAppRequest {
  app: IAppExport;
  workspaceConnectionId: number;
  ownerId: string;
}

/** A single resolved connection-import element. */
export interface IImportConnectionRequest {
  connection: IDatabricksConnectionExport;
  ownerId: string;
  clientSecret?: string;
}

/** Outcome of importing a single element. */
export interface IImportElementResult {
  name: string;
  newId?: number;
  renamed: boolean;
}

/** Minimal connection shape needed to bind imported apps. */
export interface IImportConnectionOption {
  pkId: number;
  workspaceUrl: string;
  workspaceDisplayName: string;
}

/** Minimal user shape needed to assign imported owners. */
export interface IImportOwnerOption {
  userId: string;
  label: string;
}
