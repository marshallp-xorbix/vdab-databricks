import type { ReactNode } from "react";
import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import { useWorkspaceGenieSpaces } from "../hooks/useWorkspaceGenieSpaces";
import { useWorkspaceJobs } from "../hooks/useWorkspaceJobs";
import { useWorkspaceServingEndpoints } from "../hooks/useWorkspaceServingEndpoints";
import { useWorkspaceSqlWarehouses } from "../hooks/useWorkspaceSqlWarehouses";
import {
  AutoscalingPostgresTargetFields,
  ProvisionedDatabaseTargetFields,
} from "./ProjectAppResourceLakebaseTargetFields";
import ProjectAppResourceUcTargetFields from "./ProjectAppResourceUcTargetFields";
import InstalledWorkspaceResourceSelect from "./InstalledWorkspaceResourceSelect";
import { Input } from "./ui/input";

interface IProjectAppResourceTargetFieldsProps {
  resource: IWorkspaceAppResource;
  onChange: (resource: IWorkspaceAppResource) => void;
}

/** Edits the workspace target for one App resource row. */
function ProjectAppResourceTargetFields({
  resource,
  onChange,
}: Readonly<IProjectAppResourceTargetFieldsProps>) {
  if ("secret" in resource) {
    return <SecretFields resource={resource} onChange={onChange} />;
  }
  if ("sql_warehouse" in resource) {
    return <WarehouseFields resource={resource} onChange={onChange} />;
  }
  if ("job" in resource) {
    return <JobFields resource={resource} onChange={onChange} />;
  }
  if ("database" in resource) {
    return (
      <ProvisionedDatabaseTargetFields resource={resource} onChange={onChange} />
    );
  }
  if ("postgres" in resource) {
    return (
      <AutoscalingPostgresTargetFields resource={resource} onChange={onChange} />
    );
  }
  if ("experiment" in resource) {
    return <ExperimentFields resource={resource} onChange={onChange} />;
  }
  if ("genie_space" in resource) {
    return <GenieFields resource={resource} onChange={onChange} />;
  }
  if ("serving_endpoint" in resource) {
    return <EndpointFields resource={resource} onChange={onChange} />;
  }
  if ("uc_securable" in resource) {
    return (
      <ProjectAppResourceUcTargetFields resource={resource} onChange={onChange} />
    );
  }
  return null;
}

function SecretFields({
  resource,
  onChange,
}: {
  resource: Extract<IWorkspaceAppResource, { secret: unknown }>;
  onChange: (resource: IWorkspaceAppResource) => void;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <Field label={`Secret scope for ${resource.name}`}>
        <Input
          value={resource.secret.scope}
          maxLength={128}
          onChange={(event) =>
            onChange({
              ...resource,
              secret: { ...resource.secret, scope: event.target.value },
            })
          }
        />
      </Field>
      <Field label={`Secret key for ${resource.name}`}>
        <Input
          value={resource.secret.key}
          maxLength={128}
          onChange={(event) =>
            onChange({
              ...resource,
              secret: { ...resource.secret, key: event.target.value },
            })
          }
        />
      </Field>
    </div>
  );
}

function WarehouseFields({
  resource,
  onChange,
}: {
  resource: Extract<IWorkspaceAppResource, { sql_warehouse: unknown }>;
  onChange: (resource: IWorkspaceAppResource) => void;
}) {
  const warehouses = useWorkspaceSqlWarehouses(true);
  return (
    <InstalledWorkspaceResourceSelect
      label={`SQL warehouse for ${resource.name}`}
      value={resource.sql_warehouse.id}
      emptyLabel="No SQL warehouses found"
      placeholder="Select a warehouse…"
      options={(warehouses.data?.items ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      }))}
      loading={warehouses.isLoading}
      error={warehouses.error}
      onChange={(id) =>
        onChange({
          ...resource,
          sql_warehouse: { ...resource.sql_warehouse, id },
        })
      }
    />
  );
}

function JobFields({
  resource,
  onChange,
}: {
  resource: Extract<IWorkspaceAppResource, { job: unknown }>;
  onChange: (resource: IWorkspaceAppResource) => void;
}) {
  const jobs = useWorkspaceJobs(true);
  return (
    <InstalledWorkspaceResourceSelect
      label={`Job for ${resource.name}`}
      value={resource.job.id}
      emptyLabel="No jobs found"
      placeholder="Select a job…"
      options={(jobs.data?.items ?? []).map((item) => ({
        value: item.jobId,
        label: item.name,
      }))}
      loading={jobs.isLoading}
      error={jobs.error}
      onChange={(id) =>
        onChange({ ...resource, job: { ...resource.job, id } })
      }
    />
  );
}

function ExperimentFields({
  resource,
  onChange,
}: {
  resource: Extract<IWorkspaceAppResource, { experiment: unknown }>;
  onChange: (resource: IWorkspaceAppResource) => void;
}) {
  return (
    <Field label={`Experiment for ${resource.name}`}>
      <Input
        value={resource.experiment.experiment_id}
        maxLength={255}
        onChange={(event) =>
          onChange({
            ...resource,
            experiment: {
              ...resource.experiment,
              experiment_id: event.target.value,
            },
          })
        }
      />
    </Field>
  );
}

function GenieFields({
  resource,
  onChange,
}: {
  resource: Extract<IWorkspaceAppResource, { genie_space: unknown }>;
  onChange: (resource: IWorkspaceAppResource) => void;
}) {
  const spaces = useWorkspaceGenieSpaces(true);
  return (
    <InstalledWorkspaceResourceSelect
      label={`Genie space for ${resource.name}`}
      value={resource.genie_space.space_id}
      emptyLabel="No Genie spaces found"
      placeholder="Select a Genie space…"
      options={(spaces.data?.items ?? []).map((item) => ({
        value: item.spaceId,
        label: item.title,
      }))}
      loading={spaces.isPending}
      error={spaces.error}
      onChange={(spaceId) => {
        const space = spaces.data?.items.find((item) => item.spaceId === spaceId);
        onChange({
          ...resource,
          genie_space: {
            ...resource.genie_space,
            space_id: spaceId,
            name: space?.title ?? resource.genie_space.name,
          },
        });
      }}
    />
  );
}

function EndpointFields({
  resource,
  onChange,
}: {
  resource: Extract<IWorkspaceAppResource, { serving_endpoint: unknown }>;
  onChange: (resource: IWorkspaceAppResource) => void;
}) {
  const endpoints = useWorkspaceServingEndpoints(true);
  return (
    <InstalledWorkspaceResourceSelect
      label={`Serving endpoint for ${resource.name}`}
      value={resource.serving_endpoint.name}
      emptyLabel="No serving endpoints found"
      placeholder="Select an endpoint…"
      options={(endpoints.data?.items ?? []).map((item) => ({
        value: item.name,
        label: item.name,
      }))}
      loading={endpoints.isPending}
      error={endpoints.error}
      onChange={(name) =>
        onChange({
          ...resource,
          serving_endpoint: { ...resource.serving_endpoint, name },
        })
      }
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default ProjectAppResourceTargetFields;
