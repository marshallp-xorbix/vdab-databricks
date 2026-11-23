import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import { useWorkspaceExperiments } from "../hooks/useWorkspaceExperiments";
import { useWorkspaceGenieSpaces } from "../hooks/useWorkspaceGenieSpaces";
import { useWorkspaceJobs } from "../hooks/useWorkspaceJobs";
import { useWorkspaceSecretKeys } from "../hooks/useWorkspaceSecretKeys";
import { useWorkspaceSecretScopes } from "../hooks/useWorkspaceSecretScopes";
import { useWorkspaceServingEndpoints } from "../hooks/useWorkspaceServingEndpoints";
import { useWorkspaceSqlWarehouses } from "../hooks/useWorkspaceSqlWarehouses";
import {
  AutoscalingPostgresTargetFields,
  ProvisionedDatabaseTargetFields,
} from "./ProjectAppResourceLakebaseTargetFields";
import ProjectAppResourceUcTargetFields from "./ProjectAppResourceUcTargetFields";
import InstalledWorkspaceResourceSelect from "./InstalledWorkspaceResourceSelect";

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
  const scopes = useWorkspaceSecretScopes(true);
  const keys = useWorkspaceSecretKeys(resource.secret.scope || null);
  return (
    <div className="grid min-w-0 gap-2">
      <InstalledWorkspaceResourceSelect
        label={`Secret scope for ${resource.name}`}
        value={resource.secret.scope}
        emptyLabel="No secret scopes found"
        placeholder="Select a secret scope…"
        options={(scopes.data?.items ?? []).map((item) => ({
          value: item.name,
          label: item.name,
        }))}
        loading={scopes.isPending}
        error={scopes.error}
        onChange={(scope) =>
          onChange({
            ...resource,
            secret: { ...resource.secret, scope, key: "" },
          })
        }
      />
      <InstalledWorkspaceResourceSelect
        label={`Secret key for ${resource.name}`}
        value={resource.secret.key}
        emptyLabel="No secret keys found"
        placeholder={
          resource.secret.scope ? "Select a secret key…" : "Select a scope first"
        }
        options={(keys.data?.items ?? []).map((item) => ({
          value: item.name,
          label: item.name,
        }))}
        loading={Boolean(resource.secret.scope) && keys.isPending}
        error={keys.error}
        disabled={!resource.secret.scope}
        onChange={(key) =>
          onChange({
            ...resource,
            secret: { ...resource.secret, key },
          })
        }
      />
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
  const experiments = useWorkspaceExperiments(true);
  return (
    <InstalledWorkspaceResourceSelect
      label={`Experiment for ${resource.name}`}
      value={resource.experiment.experiment_id}
      emptyLabel="No experiments found"
      placeholder="Select an MLflow experiment…"
      options={(experiments.data?.items ?? []).map((item) => ({
        value: item.experimentId,
        label: item.name,
      }))}
      loading={experiments.isPending}
      error={experiments.error}
      onChange={(experimentId) =>
        onChange({
          ...resource,
          experiment: {
            ...resource.experiment,
            experiment_id: experimentId,
          },
        })
      }
    />
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

export default ProjectAppResourceTargetFields;
