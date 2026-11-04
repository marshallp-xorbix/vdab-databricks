export interface IProjectCustomModulesDocument {
  projectId: string;
  version: number;
  source: string;
}

export class ProjectCustomModulesDocument implements IProjectCustomModulesDocument {
  projectId: string;
  version: number;
  source: string;

  constructor(source: Partial<IProjectCustomModulesDocument> = {}) {
    this.projectId = source.projectId ?? "";
    this.version = source.version ?? 1;
    this.source = source.source ?? "";
  }
}
