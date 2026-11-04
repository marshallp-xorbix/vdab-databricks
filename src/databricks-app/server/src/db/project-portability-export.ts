import type { ProjectComponent } from "./project-components-contract.ts";
import type {
  PortableResourceKind,
  PortableResourceReference,
  StandaloneProjectExport,
} from "./project-portability-contract.ts";
import {
  addUsage,
  isPortableResourceKind,
  isRecord,
  isText,
  uniqueValues,
} from "./project-portability-shared.ts";

/** Creates the externally visible export envelope after repository ACL checks. */
export function createStandaloneProjectExport(
  project: Omit<StandaloneProjectExport["project"], "childAppLink"> & {
    childAppDisplayName: string | null;
  },
): StandaloneProjectExport {
  const resourceReferences: PortableResourceReference[] = [];
  const referenceByIdentity = new Map<string, PortableResourceReference>();
  let nextReference = 1;
  for (const existing of project.resourceReferences) {
    const copy = structuredClone(existing);
    resourceReferences.push(copy);
    referenceByIdentity.set(`${existing.kind}:${existing.label}`, copy);
    const sequence = Number(existing.key.match(/^resource_([1-9][0-9]*)$/)?.[1] ?? 0);
    nextReference = Math.max(nextReference, sequence + 1);
  }

  const addReference = (
    kind: PortableResourceKind,
    label: string,
    usage: { componentKey?: string; workflowNodeId?: string } = {},
  ): PortableResourceReference => {
    const identity = `${kind}:${label}`;
    const existing = referenceByIdentity.get(identity);
    if (existing) {
      addUsage(existing, usage);
      return existing;
    }
    let key = `resource_${nextReference++}`;
    while (resourceReferences.some((reference) => reference.key === key)) {
      key = `resource_${nextReference++}`;
    }
    const reference = { key, kind, label };
    addUsage(reference, usage);
    resourceReferences.push(reference);
    referenceByIdentity.set(identity, reference);
    return reference;
  };

  const components = project.components.map((component) => {
    const resource = findComponentResource(component.bindings);
    const portableComponent = structuredClone(component) as ProjectComponent & { resourceReferenceKeys?: string[] };
    if (resource) {
      const reference = addReference(resource.kind, resource.label, { componentKey: component.key });
      portableComponent.bindings = { portableResourceKey: reference.key };
    }
    if (component.type === "ModelChat" && typeof component.properties.servingEndpointName === "string" && component.properties.servingEndpointName) {
      const reference = addReference("servingEndpoint", component.properties.servingEndpointName, { componentKey: component.key });
      portableComponent.properties.servingEndpointName = "";
      portableComponent.resourceReferenceKeys = [...new Set([...(portableComponent.resourceReferenceKeys ?? []), reference.key])];
    }
    if (component.type === "GenieChat" && typeof component.properties.genieSpaceId === "string" && component.properties.genieSpaceId) {
      const reference = addReference("genieSpace", readLabel(component.properties.genieSpaceTitle, "Genie space"), { componentKey: component.key });
      portableComponent.properties.genieSpaceId = "";
      portableComponent.properties.genieSpaceTitle = "";
      portableComponent.resourceReferenceKeys = [...new Set([...(portableComponent.resourceReferenceKeys ?? []), reference.key])];
    }
    if (component.type === "DashboardEmbed" && typeof component.properties.src === "string" && component.properties.src) {
      const reference = addReference("dashboard", dashboardLabel(component.properties.src), { componentKey: component.key });
      portableComponent.properties.src = "";
      portableComponent.resourceReferenceKeys = [...new Set([...(portableComponent.resourceReferenceKeys ?? []), reference.key])];
    }
    const existingResourceKeys = resourceReferences
      .filter((reference) => reference.componentKeys?.includes(component.key))
      .map((reference) => reference.key);
    if (existingResourceKeys.length > 0) {
      portableComponent.resourceReferenceKeys = uniqueValues([...(portableComponent.resourceReferenceKeys ?? []), ...existingResourceKeys]);
    }
    return portableComponent;
  });

  const workflows = structuredClone(project.workflow);
  for (const workflow of workflows.workflows) {
    for (const node of workflow.nodes) {
      const params = node.params;
      if (node.actionType === "startDatabricksJob" && isRecord(params.job)) {
        const job = params.job;
        const referenceKey = typeof job.resourceKey === "string" && job.resourceKey.startsWith("unresolved_")
          ? job.resourceKey.slice("unresolved_".length)
          : null;
        const existingReference = referenceKey === null
          ? undefined
          : resourceReferences.find((reference) => reference.key === referenceKey);
        const reference = existingReference ?? addReference("databricksJob", readLabel(job.jobName, "Databricks Job"), { workflowNodeId: node.id });
        addUsage(reference, { workflowNodeId: node.id });
        job.resourceKey = `unresolved_${reference.key}`;
        params.portableResourceKey = reference.key;
      }
      if (node.actionType === "buildSql" && params.sqlSourceKind === "lakebaseAutoscaling") {
        const databaseName = typeof params.lakebaseDatabaseName === "string" &&
          !params.lakebaseDatabaseName.startsWith("unresolved_")
          ? params.lakebaseDatabaseName
          : "";
        const resourceName = typeof params.lakebaseAppResourceName === "string" &&
          !params.lakebaseAppResourceName.startsWith("unresolved_")
          ? params.lakebaseAppResourceName
          : "";
        const label = databaseName || resourceName || "Lakebase Autoscaling database";
        const referenceKey = typeof params.lakebaseDatabaseName === "string" &&
          params.lakebaseDatabaseName.startsWith("unresolved_")
          ? params.lakebaseDatabaseName.slice("unresolved_".length)
          : null;
        const existingReference = referenceKey === null
          ? findExistingWorkflowReference(resourceReferences, node.id, "lakebaseDatabase")
          : resourceReferences.find((reference) => reference.key === referenceKey);
        const reference = existingReference ?? addReference("lakebaseDatabase", label, { workflowNodeId: node.id });
        addUsage(reference, { workflowNodeId: node.id });
        const unresolvedResource = `unresolved_${reference.key}`;
        params.portableResourceKey = reference.key;
        params.lakebaseAppResourceName = unresolvedResource;
        params.lakebaseDatabaseName = unresolvedResource;
        if (typeof params.lakebaseDatabaseId === "string") {
          params.lakebaseDatabaseId = unresolvedResource;
        }
        params.lakebaseProjectId = unresolvedResource;
        params.lakebaseBranchId = unresolvedResource;
        params.lakebaseEndpointId = unresolvedResource;
      } else if (node.actionType === "buildSql" && typeof params.sqlWarehouseId === "string") {
        const name = typeof params.sqlWarehouseName === "string" ? params.sqlWarehouseName : "SQL warehouse";
        const reference = addReference("sqlWarehouse", name, { workflowNodeId: node.id });
        params.portableResourceKey = reference.key;
        delete params.sqlWarehouseId;
        delete params.sqlWarehouseName;
      } else if (node.actionType === "buildSql") {
        const reference = findExistingWorkflowReference(resourceReferences, node.id, "sqlWarehouse");
        if (reference) params.portableResourceKey = reference.key;
      }
      if (node.actionType === "saveToTable" && isRecord(params.targetTable)) {
        const target = params.targetTable;
        const kind = target.tableType === "unityCatalogTable" ? "unityCatalogTable" : "lakebaseDatabase";
        const label = [target.catalog, target.schema, target.table]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(".") || "Table";
        const referenceKey = typeof target.resourceKey === "string" && target.resourceKey.startsWith("unresolved_")
          ? target.resourceKey.slice("unresolved_".length)
          : null;
        const existingReference = referenceKey === null
          ? undefined
          : resourceReferences.find((reference) => reference.key === referenceKey);
        const reference = existingReference ?? addReference(kind, label, { workflowNodeId: node.id });
        addUsage(reference, { workflowNodeId: node.id });
        target.resourceKey = `unresolved_${reference.key}`;
        params.portableResourceKey = reference.key;
        target.catalog = "";
        target.schema = "";
        target.table = "";
        if (target.tableType === "lakebaseAutoscaling") {
          const unresolvedTarget = `unresolved_${reference.key}`;
          for (const field of ["database", "databaseId", "projectId", "branchId", "endpointId"]) {
            if (field === "databaseId" && !(field in target)) continue;
            target[field] = unresolvedTarget;
          }
        } else {
          for (const field of ["instanceName", "database", "projectId", "branchId", "endpointId"]) {
            if (field in target) target[field] = "";
          }
        }
      }
    }
  }

  const standaloneProject = {
    name: project.name,
    description: project.description,
    theme: project.theme,
    customModulesSource: project.customModulesSource,
    components,
    workflow: workflows,
    resourceReferences,
    childAppLink: {
      requiresSelection: true as const,
      sourceDisplayName: project.childAppDisplayName,
    },
  };

  return {
    format: "vdab-project",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project: standaloneProject,
  };
}

function findComponentResource(bindings: Record<string, unknown> | null): {
  kind: PortableResourceKind;
  label: string;
} | null {
  if (!bindings) return null;
  for (const [bindingName, value] of Object.entries(bindings)) {
    if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.source.resource)) continue;
    const resource = value.source.resource;
    const resourceType = resource.type;
    if (
      !isPortableResourceKind(resourceType) &&
      resourceType !== "databricksVolume" &&
      resourceType !== "lakebaseAutoscaling" &&
      resourceType !== "lakebaseProvisionedDatabase"
    ) continue;
    const label = resourceType === "unityCatalogTable"
      ? [resource.catalog, resource.schema, resource.table].filter(isText).join(".")
      : resourceType === "unityCatalogVolume" || resourceType === "databricksVolume"
        ? [resource.catalog, resource.schema, resource.volume].filter(isText).join(".")
      : resourceType === "lakebaseAutoscaling"
          ? [resource.database, resource.schema, resource.table].filter(isText).join(".")
          : [resource.database, resource.schema, resource.table].filter(isText).join(".");
    const kind: PortableResourceKind =
      resourceType === "databricksVolume"
        ? "unityCatalogVolume"
        : resourceType === "lakebaseAutoscaling" || resourceType === "lakebaseProvisionedDatabase"
          ? "lakebaseDatabase"
          : resourceType;
    return { kind, label: label || bindingName };
  }
  return null;
}

function readLabel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function dashboardLabel(reference: string): string {
  const match = reference.match(/\/embed\/dashboardsv3\/([A-Za-z0-9_-]{1,128})/);
  return match?.[1] ?? "Published dashboard";
}

function findExistingWorkflowReference(
  references: PortableResourceReference[],
  nodeId: string,
  kind: PortableResourceKind,
): PortableResourceReference | undefined {
  return references.find((reference) =>
    reference.kind === kind && reference.workflowNodeIds?.includes(nodeId),
  );
}

