import type { IProject } from "./Project";

/** Install-local workspace resource identity omitted from the portable file. */
export interface IPortableResourceReference {
  key: string;
  kind: string;
  label: string;
  componentKeys?: string[];
  workflowNodeIds?: string[];
}

/** Versioned standalone project archive downloaded from the Node backend. */
export interface IStandaloneProjectExport {
  format: "vdab-project";
  schemaVersion: 1;
  exportedAt: string;
  project: Record<string, unknown>;
}

/** Result of importing a project into the workspace hosting this VDAB. */
export interface IProjectImportResult {
  project: IProject;
  unresolvedResources: IPortableResourceReference[];
  requiresChildAppSelection: true;
}

/** Parsed cross-install export used by the import API. */
export class StandaloneProjectExport implements IStandaloneProjectExport {
  format = "vdab-project" as const;
  schemaVersion = 1 as const;
  exportedAt = "";
  project: Record<string, unknown> = {};

  constructor(value: IStandaloneProjectExport) {
    this.format = value.format;
    this.schemaVersion = value.schemaVersion;
    this.exportedAt = value.exportedAt;
    this.project = value.project;
  }
}
