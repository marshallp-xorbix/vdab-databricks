import type { ProjectJsonObject } from "./ProjectComponents";

export type ComponentCategory =
  | "Controls"
  | "Layout"
  | "Data"
  | "Page"
  | "Visualization";

export type ComponentBindingType =
  | "unityCatalogTable"
  | "databricksVolume"
  | "lakebaseProvisionedDatabase"
  | "lakebaseAutoscaling";

export interface IComponentDefinition {
  id: string;
  codeName: string;
  type: string;
  category: ComponentCategory;
  icon: string;
  layout: null;
  schemaVersion: 1;
  bindings: null;
  supportedBindings: ComponentBindingType[] | null;
  supportedEvents: string[] | null;
  children: string[] | null;
  props: ProjectJsonObject;
}

export class ComponentDefinition implements IComponentDefinition {
  id: string;
  codeName: string;
  type: string;
  category: ComponentCategory;
  icon: string;
  layout: null;
  schemaVersion: 1;
  bindings: null;
  supportedBindings: ComponentBindingType[] | null;
  supportedEvents: string[] | null;
  children: string[] | null;
  props: ProjectJsonObject;

  constructor(source: IComponentDefinition) {
    this.id = source.id;
    this.codeName = source.codeName;
    this.type = source.type;
    this.category = source.category;
    this.icon = source.icon;
    this.layout = null;
    this.schemaVersion = 1;
    this.bindings = null;
    this.supportedBindings = source.supportedBindings;
    this.supportedEvents = source.supportedEvents;
    this.children = source.children;
    this.props = source.props;
  }
}

export interface IComponentRegistry {
  version: 1;
  components: IComponentDefinition[];
}

export class ComponentRegistry implements IComponentRegistry {
  version: 1;
  components: ComponentDefinition[];

  constructor(source: IComponentRegistry) {
    this.version = 1;
    this.components = source.components.map(
      (definition) => new ComponentDefinition(definition),
    );
  }
}
