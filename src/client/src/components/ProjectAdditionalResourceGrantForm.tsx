import { useState } from "react";
import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import { useWorkspaceJobs } from "../hooks/useWorkspaceJobs";
import { useWorkspaceGenieSpaces } from "../hooks/useWorkspaceGenieSpaces";
import { useWorkspaceServingEndpoints } from "../hooks/useWorkspaceServingEndpoints";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Kind = "job" | "database" | "postgres" | "experiment" | "genie_space" | "serving_endpoint" | "uc_securable";

const KINDS: ReadonlyArray<{ value: Kind; label: string }> = [
  { value: "job", label: "Job" },
  { value: "database", label: "Provisioned Lakebase" },
  { value: "postgres", label: "Autoscaling Lakebase" },
  { value: "experiment", label: "Experiment" },
  { value: "genie_space", label: "Genie space" },
  { value: "serving_endpoint", label: "Serving endpoint" },
  { value: "uc_securable", label: "Unity Catalog securable" },
];

const PERMISSIONS: Record<Kind, readonly string[]> = {
  job: ["CAN_VIEW", "CAN_MANAGE_RUN", "CAN_MANAGE", "IS_OWNER"],
  database: ["CAN_CONNECT_AND_CREATE"],
  postgres: ["CAN_CONNECT_AND_CREATE"],
  experiment: ["CAN_READ", "CAN_EDIT", "CAN_MANAGE"],
  genie_space: ["CAN_VIEW", "CAN_RUN", "CAN_EDIT", "CAN_MANAGE"],
  serving_endpoint: ["CAN_VIEW", "CAN_QUERY", "CAN_MANAGE"],
  uc_securable: ["SELECT", "MODIFY", "READ_VOLUME", "WRITE_VOLUME", "EXECUTE", "USE_CONNECTION"],
};

interface Props {
  existingNames: readonly string[];
  disabled: boolean;
  onAdd: (resource: IWorkspaceAppResource) => void;
}

/** Adds the Databricks resource types beyond secrets and SQL warehouses. */
export default function ProjectAdditionalResourceGrantForm({ existingNames, disabled, onAdd }: Readonly<Props>) {
  const [kind, setKind] = useState<Kind>("job");
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [securableType, setSecurableType] = useState<"TABLE" | "VOLUME" | "FUNCTION" | "CONNECTION" | "MODEL_SERVICE">("TABLE");
  const [permission, setPermission] = useState("CAN_VIEW");
  const jobs = useWorkspaceJobs(!disabled && kind === "job");
  const genieSpaces = useWorkspaceGenieSpaces(!disabled && kind === "genie_space");
  const servingEndpoints = useWorkspaceServingEndpoints(!disabled && kind === "serving_endpoint");
  const requiresSecondary = kind === "database" || kind === "genie_space";
  const valid = /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(name.trim()) &&
    !existingNames.includes(name.trim()) && primary.trim().length > 0 &&
    (!requiresSecondary || secondary.trim().length > 0);

  function chooseKind(next: Kind) {
    setKind(next);
    setPrimary("");
    setSecondary("");
    setPermission(PERMISSIONS[next][0] ?? "");
  }

  function chooseGenieSpace(spaceId: string) {
    const space = genieSpaces.data?.items.find((item) => item.spaceId === spaceId);
    setPrimary(space?.title ?? "");
    setSecondary(spaceId);
  }

  function add() {
    if (!valid) return;
    const resource = buildResource(kind, name.trim(), primary.trim(), secondary.trim(), securableType, permission);
    if (!resource) return;
    onAdd(resource);
    setName("");
    setPrimary("");
    setSecondary("");
  }

  return (
    <fieldset disabled={disabled} className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium">Add another App resource grant</legend>
      <label className="space-y-1 text-sm"><span>Resource type</span>
        <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={kind} onChange={(event) => chooseKind(event.target.value as Kind)}>
          {KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm"><span>App resource key</span><Input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} /></label>
      <label className="space-y-1 text-sm"><span>{primaryLabel(kind)}</span>
        {kind === "job" && jobs.data?.items.length ? (
          <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={primary} onChange={(event) => setPrimary(event.target.value)}><option value="">Select a Job…</option>{jobs.data.items.map((item) => <option key={item.jobId} value={item.jobId}>{item.name}</option>)}</select>
        ) : kind === "genie_space" && genieSpaces.data?.items.length ? (
          <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={secondary} onChange={(event) => chooseGenieSpace(event.target.value)}><option value="">Select a Genie space…</option>{genieSpaces.data.items.map((item) => <option key={item.spaceId} value={item.spaceId}>{item.title}</option>)}</select>
        ) : kind === "serving_endpoint" && servingEndpoints.data?.items.length ? (
          <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={primary} onChange={(event) => setPrimary(event.target.value)}><option value="">Select an endpoint…</option>{servingEndpoints.data.items.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
        ) : <Input value={primary} maxLength={255} onChange={(event) => setPrimary(event.target.value)} />}
      </label>
      {requiresSecondary && kind !== "genie_space" && <label className="space-y-1 text-sm"><span>Database name</span><Input value={secondary} maxLength={128} onChange={(event) => setSecondary(event.target.value)} /></label>}
      {([jobs, genieSpaces, servingEndpoints].some((query) => query.isError)) && <p role="alert" className="text-sm text-destructive sm:col-span-2">A workspace resource list could not be loaded. You can enter its identifier manually.</p>}
      {kind === "uc_securable" && <label className="space-y-1 text-sm"><span>Securable type</span>
        <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={securableType} onChange={(event) => setSecurableType(event.target.value as typeof securableType)}>
          {["TABLE", "VOLUME", "FUNCTION", "CONNECTION", "MODEL_SERVICE"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>}
      <label className="space-y-1 text-sm"><span>Permission</span>
        <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={permission} onChange={(event) => setPermission(event.target.value)}>
          {PERMISSIONS[kind].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ").toLowerCase()}</option>)}
        </select>
      </label>
      <div className="flex items-end"><Button type="button" variant="outline" disabled={!valid} onClick={add}>Add resource</Button></div>
    </fieldset>
  );
}

function primaryLabel(kind: Kind): string {
  switch (kind) {
    case "job": return "Job ID";
    case "database": return "Provisioned instance name";
    case "postgres": return "Autoscaling database resource path";
    case "experiment": return "Experiment ID";
    case "genie_space": return "Genie space name";
    case "serving_endpoint": return "Serving endpoint name";
    case "uc_securable": return "Securable full name";
  }
}

function buildResource(kind: Kind, name: string, primary: string, secondary: string, securableType: "TABLE" | "VOLUME" | "FUNCTION" | "CONNECTION" | "MODEL_SERVICE", permission: string): IWorkspaceAppResource | null {
  const base = { name, description: "VDAB App resource grant" };
  switch (kind) {
    case "job": return { ...base, job: { id: primary, permission: permission as "CAN_VIEW" } };
    case "database": return { ...base, database: { instance_name: primary, database_name: secondary, permission: "CAN_CONNECT_AND_CREATE" } };
    case "postgres": return { ...base, postgres: { branch: primary.slice(0, primary.indexOf("/databases/")), database: primary, permission: "CAN_CONNECT_AND_CREATE" } };
    case "experiment": return { ...base, experiment: { experiment_id: primary, permission: permission as "CAN_READ" } };
    case "genie_space": return { ...base, genie_space: { name: primary, space_id: secondary, permission: permission as "CAN_VIEW" } };
    case "serving_endpoint": return { ...base, serving_endpoint: { name: primary, permission: permission as "CAN_VIEW" } };
    case "uc_securable": return { ...base, uc_securable: { securable_full_name: primary, securable_type: securableType, permission: permission as "SELECT" } };
  }
}
