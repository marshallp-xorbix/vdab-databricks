import { createHash } from "node:crypto";
import type { WorkspaceLakebaseAppResource } from "./contracts.ts";

export interface LakebaseAutoscalingResourceTarget {
  projectId: string;
  branchId: string;
  endpointId: string;
  databaseId: string;
}

export interface LakebaseProvisionedResourceTarget {
  instanceName: string;
  databaseName: string;
}

export interface LakebaseAppResourceBinding {
  resource: WorkspaceLakebaseAppResource;
  environmentVariable: string;
}

/** Creates a stable custom App key and runtime variable for one Autoscaling database. */
export function createAutoscalingAppResourceBinding(
  target: LakebaseAutoscalingResourceTarget,
): LakebaseAppResourceBinding {
  const identity = ["autoscaling", target.projectId, target.branchId, target.endpointId, target.databaseId].join("\u0000");
  const suffix = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  const resourceName = `vdab-pg-${suffix}`;
  return {
    resource: {
      name: resourceName,
      description: "VDAB Lakebase Autoscaling",
      postgres: {
        database: `projects/${target.projectId}/branches/${target.branchId}/databases/${target.databaseId}`,
        permission: "CAN_CONNECT_AND_CREATE",
      },
    },
    environmentVariable: `VDAB_LAKEBASE_ENDPOINT_${suffix.toUpperCase()}`,
  };
}

/** Creates a stable custom App key and runtime variable for one existing Provisioned database. */
export function createProvisionedAppResourceBinding(
  target: LakebaseProvisionedResourceTarget,
): LakebaseAppResourceBinding {
  const identity = ["provisioned", target.instanceName, target.databaseName].join("\u0000");
  const suffix = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  const resourceName = `vdab-db-${suffix}`;
  return {
    resource: {
      name: resourceName,
      description: "VDAB Lakebase Provisioned",
      database: {
        instance_name: target.instanceName,
        database_name: target.databaseName,
        permission: "CAN_CONNECT_AND_CREATE",
      },
    },
    environmentVariable: `VDAB_LAKEBASE_HOST_${suffix.toUpperCase()}`,
  };
}

/** Returns the generated connection variable associated with a persisted App resource. */
export function lakebaseResourceEnvironmentVariable(
  resource: WorkspaceLakebaseAppResource,
): string {
  const autoscalingSuffix = resource.name.match(/^vdab-pg-([a-f0-9]{16})$/)?.[1];
  if (autoscalingSuffix) return `VDAB_LAKEBASE_ENDPOINT_${autoscalingSuffix.toUpperCase()}`;
  const provisionedSuffix = resource.name.match(/^vdab-db-([a-f0-9]{16})$/)?.[1];
  if (provisionedSuffix) return `VDAB_LAKEBASE_HOST_${provisionedSuffix.toUpperCase()}`;
  throw new Error("Lakebase App resource key does not match the VDAB runtime contract.");
}
