export interface BindingSchema {
  type: string;
  label: string;
  editorType: string;
  defaultConfig?: Record<string, unknown>;
}

export interface Binding {
  bindingType: string;
  source: BindingSource;
}

export interface BindingSource {
  kind: "resource" | "workflowOutput" | "componentValue" | "triggerPayload" | "appState";
  path?: string;
  valueType?: string;
  resource?: ResourceBindingSource;
}

export interface ResourceBindingSource {
  type: string;
  catalog?: string;
  schema?: string;
  table?: string;
  database?: string;
  instanceName?: string;
  /** Lakebase Autoscaling (project / branch / endpoint) */
  projectId?: string;
  branchId?: string;
  endpointId?: string;
  volume?: string;
  filePath?: string;
  columns?: unknown[];
  primaryKeyColumn?: string;
}

export interface UnityCatalogColumn {
  name?: string;
  type?: string;
  nullable?: boolean;
  comment?: string;
}

export interface UnityCatalogTableConfig {
  type: 'single' | 'join';
  catalog?: string;
  schema?: string;
  table?: string;
  columns?: UnityCatalogColumn[];
}
