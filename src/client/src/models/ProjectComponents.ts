export type ProjectJsonValue =
  | null
  | boolean
  | number
  | string
  | ProjectJsonValue[]
  | ProjectJsonObject;

export interface ProjectJsonObject {
  [propertyName: string]: ProjectJsonValue;
}

export interface IProjectComponent {
  key: string;
  type: string;
  schemaVersion: number;
  componentVersion: number;
  codeName: string | null;
  description: string | null;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  children: string[];
  layout: ProjectJsonObject | null;
}

export class ProjectComponent implements IProjectComponent {
  key: string;
  type: string;
  schemaVersion: number;
  componentVersion: number;
  codeName: string | null;
  description: string | null;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  children: string[];
  layout: ProjectJsonObject | null;

  constructor(source: Partial<IProjectComponent> = {}) {
    this.key = source.key ?? "";
    this.type = source.type ?? "";
    this.schemaVersion = source.schemaVersion ?? 1;
    this.componentVersion = source.componentVersion ?? 1;
    this.codeName = source.codeName ?? null;
    this.description = source.description ?? null;
    this.properties = source.properties ?? {};
    this.bindings = source.bindings ?? null;
    this.children = source.children ?? [];
    this.layout = source.layout ?? null;
  }
}

export interface IProjectComponentsDocument {
  projectId: string;
  version: number;
  components: IProjectComponent[];
}

export class ProjectComponentsDocument implements IProjectComponentsDocument {
  projectId: string;
  version: number;
  components: ProjectComponent[];

  constructor(source: Partial<IProjectComponentsDocument> = {}) {
    this.projectId = source.projectId ?? "";
    this.version = source.version ?? 1;
    this.components = (source.components ?? []).map(
      (component) => new ProjectComponent(component),
    );
  }
}

export interface TextInputProperties extends ProjectJsonObject {
  label: string;
  placeholder: string;
  defaultValue: string;
  help: string;
  disabled: boolean;
  type: "default" | "password";
  multiline: boolean;
  height: string;
}

export interface IPreviewFile {
  path: string;
  content: string;
}

export class PreviewFile implements IPreviewFile {
  path: string;
  content: string;

  constructor(source: Partial<IPreviewFile> = {}) {
    this.path = source.path ?? "";
    this.content = source.content ?? "";
  }
}

export interface IProjectPreview {
  projectId: string;
  version: number;
  previewOnly: true;
  files: IPreviewFile[];
}

export class ProjectPreview implements IProjectPreview {
  projectId: string;
  version: number;
  previewOnly: true;
  files: PreviewFile[];

  constructor(source: Partial<IProjectPreview> = {}) {
    this.projectId = source.projectId ?? "";
    this.version = source.version ?? 1;
    this.previewOnly = true;
    this.files = (source.files ?? []).map((file) => new PreviewFile(file));
  }
}
