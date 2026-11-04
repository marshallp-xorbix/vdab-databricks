import type {
  ProjectComponentType,
  ProjectJsonObject,
} from "../db/project-components-contract.ts";

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

/** One stateless editor definition copied from the accepted legacy registry. */
export interface ComponentDefinition {
  id: string;
  codeName: string;
  type: ProjectComponentType;
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

/** Schema and defaults for one current-workspace resource selector. */
export interface BindingSchema {
  type: ComponentBindingType;
  label: string;
  editorType: string;
  defaultConfig: ProjectJsonObject;
}

/** Full versioned definition response used to build and edit the canvas. */
export interface ComponentRegistryResponse {
  components: ComponentDefinition[];
  bindingSchemas: BindingSchema[];
  version: 1;
}
