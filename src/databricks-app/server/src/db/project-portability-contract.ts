import type { ProjectSummary } from "../contracts.ts";
import type { ProjectComponent } from "./project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "./project-workflow-contract.ts";

/** Resource types whose references belong to the hosting workspace. */
export const PORTABLE_RESOURCE_KINDS = [
  "unityCatalogTable",
  "unityCatalogVolume",
  "sqlWarehouse",
  "databricksJob",
  "dashboard",
  "servingEndpoint",
  "genieSpace",
  "lakebaseDatabase",
  "secretScope",
] as const;

export type PortableResourceKind = (typeof PORTABLE_RESOURCE_KINDS)[number];

/** A display-only reference that must be selected again after import. */
export interface PortableResourceReference {
  key: string;
  kind: PortableResourceKind;
  label: string;
  componentKeys?: string[];
  workflowNodeIds?: string[];
}

/** Versioned file format exchanged between independent VDAB installations. */
export interface StandaloneProjectExport {
  format: "vdab-project";
  schemaVersion: 1;
  exportedAt: string;
  project: {
    name: string;
    description: string | null;
    theme: Record<string, unknown> | null;
    customModulesSource: string | null;
    components: ProjectComponent[];
    workflow: ProjectWorkflowDefinition;
    resourceReferences: PortableResourceReference[];
    childAppLink: { requiresSelection: true; sourceDisplayName: string | null };
  };
}

/** Full aggregate read under a single repository snapshot. */
export interface ProjectAggregateSnapshot {
  project: ProjectSummary;
  theme: Record<string, unknown> | null;
  components: ProjectComponent[];
  workflow: ProjectWorkflowDefinition;
  customModulesSource: string;
  resourceReferences: PortableResourceReference[];
  childAppDisplayName: string | null;
}

/** Validated aggregate committed in one transaction by the repository. */
export interface ImportedProjectAggregate {
  name: string;
  description: string | null;
  theme: Record<string, unknown> | null;
  components: ProjectComponent[];
  workflow: ProjectWorkflowDefinition;
  customModulesSource: string;
  resourceReferences: PortableResourceReference[];
}

/** Result returned after an importing caller becomes the new project owner. */
export interface ProjectImportResult {
  project: ProjectSummary;
  unresolvedResources: PortableResourceReference[];
  requiresChildAppSelection: true;
}
