export type ProjectRole = "owner" | "editor" | "viewer" | "installationAdmin";

export interface IProject {
  id: string;
  name: string;
  description: string | null;
  theme?: Record<string, unknown> | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  callerRole: ProjectRole;
}

export class Project implements IProject {
  id: string;
  name: string;
  description: string | null;
  theme?: Record<string, unknown> | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  callerRole: ProjectRole;

  constructor(source: Partial<IProject> = {}) {
    this.id = source.id ?? "";
    this.name = source.name ?? "";
    this.description = source.description ?? null;
    this.theme = source.theme ?? null;
    this.version = source.version ?? 1;
    this.createdBy = source.createdBy ?? "";
    this.createdAt = source.createdAt ?? "";
    this.updatedAt = source.updatedAt ?? "";
    this.callerRole = source.callerRole ?? "viewer";
  }
}

export interface IProjectList {
  items: IProject[];
}

export class ProjectList implements IProjectList {
  items: Project[];

  constructor(source: Partial<IProjectList> = {}) {
    this.items = (source.items ?? []).map((item) => new Project(item));
  }
}
