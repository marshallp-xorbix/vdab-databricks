import type { ReactNode } from "react";
import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import { useWorkspaceGenieSpaces } from "../hooks/useWorkspaceGenieSpaces";
import { useWorkspaceJobs } from "../hooks/useWorkspaceJobs";
import { useWorkspaceServingEndpoints } from "../hooks/useWorkspaceServingEndpoints";
import { useWorkspaceSqlWarehouses } from "../hooks/useWorkspaceSqlWarehouses";
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
  if ("secret" in resource) return <SecretFields resource={resource} onChange={onChange} />;
  if ("sql_warehouse" in resource) return <WarehouseFields resource={resource} onChange={onChange} />;
  if ("job" in resource) return <JobFields resource={resource} onChange={onChange} />;
  if ("database" in resource) return <DatabaseFields resource={resource} onChange={onChange} />;
  if ("postgres" in resource) return <PostgresFields resource={resource} onChange={onChange} />;
  if ("experiment" in resource) return <ExperimentFields resource={resource} onChange={onChange} />;
  if ("genie_space" in resource) return <GenieFields resource={resource} onChange={onChange} />;
  if ("serving_endpoint" in resource) return <EndpointFields resource={resource} onChange={onChange} />;
  if ("uc_securable" in resource) return <SecurableFields resource={resource} onChange={onChange} />;
  return null;
}

function SecretFields({ resource, onChange }: { resource: Extract<IWorkspaceAppResource, { secret: unknown }>; onChange: (resource: IWorkspaceAppResource) => void }) {
  return (
    <div className="grid gap-2">
      <Field label={`Secret scope for ${resource.name}`}>
        <Input value={resource.secret.scope} maxLength={128} onChange={(event) => onChange({ ...resource, secret: { ...resource.secret, scope: event.target.value } })} />
      </Field>
      <Field label={`Secret key for ${resource.name}`}>
        <Input value={resource.secret.key} maxLength={128} onChange={(event) => onChange({ ...resource, secret: { ...resource.secret, key: event.target.value } })} />
      </Field>
    </div>
  );
}

function WarehouseFields({ resource, onChange }: { resource: Extract<IWorkspaceAppResource, { sql_warehouse: unknown }>; onChange: (resource: IWorkspaceAppResource) => void }) {
  const warehouses = useWorkspaceSqlWarehouses(true);
  return (
    <SelectOrInput
      label={`SQL warehouse for ${resource.name}`}
      value={resource.sql_warehouse.id}
      emptyLabel="Select a warehouse…"
      options={(warehouses.data?.items ?? []).map((item) => ({ value: item.id, label: item.name }))}
      onChange={(id) => onChange({ ...resource, sql_warehouse: { ...resource.sql_warehouse, id } })}
    />
  );
}

function JobFields({ resource, onChange }: { resource: Extract<IWorkspaceAppResource, { job: unknown }>; onChange: (resource: IWorkspaceAppResource) => void }) {
  const jobs = useWorkspaceJobs(true);
  return (
    <SelectOrInput
      label={`Job for ${resource.name}`}
      value={resource.job.id}
      emptyLabel="Select a job…"
      options={(jobs.data?.items ?? []).map((item) => ({ value: item.jobId, label: item.name }))}
      onChange={(id) => onChange({ ...resource, job: { ...resource.job, id } })}
    />
  );
}

function DatabaseFields({ resource, onChange }: { resource: Extract<IWorkspaceAppResource, { database: unknown }>; onChange: (resource: IWorkspaceAppResource) => void }) {
  return (
    <div className="grid gap-2">
      <Field label={`Lakebase instance for ${resource.name}`}>
        <Input value={resource.database.instance_name} maxLength={255} onChange={(event) => onChange({ ...resource, database: { ...resource.database, instance_name: event.target.value } })} />
      </Field>
      <Field label={`Database for ${resource.name}`}>
        <Input value={resource.database.database_name} maxLength={128} onChange={(event) => onChange({ ...resource, database: { ...resource.database, database_name: event.target.value } })} />
      </Field>
    </div>
  );
}

function PostgresFields({ resource, onChange }: { resource: Extract<IWorkspaceAppResource, { postgres: unknown }>; onChange: (resource: IWorkspaceAppResource) => void }) {
  return (
    <Field label={`Autoscaling database for ${resource.name}`}>
      <Input value={resource.postgres.database} maxLength={255} onChange={(event) => onChange({ ...resource, postgres: { ...resource.postgres, database: event.target.value } })} />
    </Field>
  );
}

function ExperimentFields({ resource, onChange }: { resource: Extract<IWorkspaceAppResource, { experiment: unknown }>; onChange: (resource: IWorkspaceAppResource) => void }) {
  return (
    <Field label={`Experiment for ${resource.name}`}>
      <Input value={resource.experiment.experiment_id} maxLength={255} onChange={(event) => onChange({ ...resource, experiment: { ...resource.experiment, experiment_id: event.target.value } })} />
    </Field>
  );
}

function GenieFields({ resource, onChange }: { resource: Extract<IWorkspaceAppResource, { genie_space: unknown }>; onChange: (resource: IWorkspaceAppResource) => void }) {
  const spaces = useWorkspaceGenieSpaces(true);
  const options = (spaces.data?.items ?? []).map((item) => ({ value: item.spaceId, label: item.title }));
  if (options.length === 0) {
    return (
      <div className="grid gap-2">
        <Field label={`Genie space name for ${resource.name}`}><Input value={resource.genie_space.name} maxLength={255} onChange={(event) => onChange({ ...resource, genie_space: { ...resource.genie_space, name: event.target.value } })} /></Field>
        <Field label={`Genie space id for ${resource.name}`}><Input value={resource.genie_space.space_id} maxLength={255} onChange={(event) => onChange({ ...resource, genie_space: { ...resource.genie_space, space_id: event.target.value } })} /></Field>
      </div>
    );
  }
  return (
    <SelectOrInput
      label={`Genie space for ${resource.name}`}
      value={resource.genie_space.space_id}
      emptyLabel="Select a Genie space…"
      options={options}
      onChange={(spaceId) => {
        const space = spaces.data?.items.find((item) => item.spaceId === spaceId);
        onChange({ ...resource, genie_space: { ...resource.genie_space, space_id: spaceId, name: space?.title ?? resource.genie_space.name } });
      }}
    />
  );
}

function EndpointFields({ resource, onChange }: { resource: Extract<IWorkspaceAppResource, { serving_endpoint: unknown }>; onChange: (resource: IWorkspaceAppResource) => void }) {
  const endpoints = useWorkspaceServingEndpoints(true);
  return (
    <SelectOrInput
      label={`Serving endpoint for ${resource.name}`}
      value={resource.serving_endpoint.name}
      emptyLabel="Select an endpoint…"
      options={(endpoints.data?.items ?? []).map((item) => ({ value: item.name, label: item.name }))}
      onChange={(name) => onChange({ ...resource, serving_endpoint: { ...resource.serving_endpoint, name } })}
    />
  );
}

function SecurableFields({ resource, onChange }: { resource: Extract<IWorkspaceAppResource, { uc_securable: unknown }>; onChange: (resource: IWorkspaceAppResource) => void }) {
  return (
    <div className="grid gap-2">
      <Field label={`Securable type for ${resource.name}`}>
        <select className="h-9 w-full rounded-md border border-input bg-background px-2" value={resource.uc_securable.securable_type} onChange={(event) => onChange({ ...resource, uc_securable: { ...resource.uc_securable, securable_type: event.target.value as typeof resource.uc_securable.securable_type } })}>
          {["TABLE", "VOLUME", "FUNCTION", "CONNECTION", "MODEL_SERVICE"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </Field>
      <Field label={`Catalog schema and name for ${resource.name}`}>
        <Input value={resource.uc_securable.securable_full_name} maxLength={255} placeholder="catalog.schema.table" onChange={(event) => onChange({ ...resource, uc_securable: { ...resource.uc_securable, securable_full_name: event.target.value } })} />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-xs text-muted-foreground"><span>{label}</span>{children}</label>;
}

function SelectOrInput({ label, value, emptyLabel, options, onChange }: { label: string; value: string; emptyLabel: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  if (options.length === 0) {
    return <Field label={label}><Input value={value} maxLength={255} onChange={(event) => onChange(event.target.value)} /></Field>;
  }
  return (
    <Field label={label}>
      <select className="h-9 w-full rounded-md border border-input bg-background px-2" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  );
}

export default ProjectAppResourceTargetFields;
