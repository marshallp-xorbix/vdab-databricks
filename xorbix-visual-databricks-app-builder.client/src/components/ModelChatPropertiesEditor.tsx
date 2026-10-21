import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import { useWorkspaceServingEndpoints } from "../hooks/useWorkspaceServingEndpoints";

interface IModelChatPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

function ModelChatPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onChange,
}: Readonly<IModelChatPropertiesEditorProps>) {
  const servingEndpoints = useWorkspaceServingEndpoints();
  const endpointName = readText(properties.servingEndpointName);
  const endpoints = servingEndpoints.data?.items ?? [];
  const selectedEndpoint = endpoints.find((endpoint) => endpoint.name === endpointName);
  const isSelectedEndpointVisible = selectedEndpoint !== undefined;
  const titleId = `model-chat-title-${componentKey}`;
  const endpointId = `model-chat-endpoint-${componentKey}`;
  const heightId = `model-chat-height-${componentKey}`;
  const borderId = `model-chat-border-${componentKey}`;

  function changeEndpoint(nextName: string): void {
    onChange({ ...properties, servingEndpointName: nextName });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Model chat properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={endpointId}>Serving endpoint in this workspace</Label>
        <select
          id={endpointId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={endpointName}
          onChange={(event) => changeEndpoint(event.target.value)}
        >
          <option value="">Select a serving endpoint</option>
          {endpointName !== "" && !isSelectedEndpointVisible ? (
            <option value={endpointName}>Unavailable: {endpointName}</option>
          ) : null}
          {endpoints.map((endpoint) => (
            <option key={endpoint.name} value={endpoint.name}>
              {endpoint.name} · {readinessLabel(endpoint.readiness)}
            </option>
          ))}
        </select>
        {servingEndpoints.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading serving endpoints from this workspace…
          </p>
        ) : null}
        {servingEndpoints.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {servingEndpoints.error.message}
          </p>
        ) : null}
        {!servingEndpoints.isPending && !servingEndpoints.isError && endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No serving endpoints are visible. Ask a workspace admin to enable the model-serving user scope and confirm you can access an endpoint.
          </p>
        ) : null}
        {selectedEndpoint?.readiness === "not-ready" ? (
          <p role="status" className="text-sm text-warning-foreground">
            This endpoint is not ready. Select an endpoint in READY state before using the chat.
          </p>
        ) : null}
        {selectedEndpoint?.permissionLevel === "CAN_VIEW" ? (
          <p role="status" className="text-sm text-warning-foreground">
            Your current access is CAN VIEW. You need CAN QUERY to use this endpoint; each viewer is checked with their own Databricks permissions.
          </p>
        ) : null}
        {servingEndpoints.data?.authenticationMode === "local-test" ? (
          <p className="text-sm text-muted-foreground">
            Local test resource only; this does not verify a Databricks serving endpoint.
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={titleId}>Chat title</Label>
        <Input
          id={titleId}
          name="modelChatTitle"
          required
          maxLength={500}
          value={readText(properties.title, "Model Chat")}
          onChange={(event) => onChange({ ...properties, title: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={heightId}>Chat height (px)</Label>
        <Input
          id={heightId}
          name="modelChatHeight"
          type="number"
          min={300}
          max={2000}
          step={1}
          value={readNumber(properties.chatTotalHeightPixels, 600)}
          onChange={(event) => onChange({ ...properties, chatTotalHeightPixels: Number(event.target.value) })}
        />
        <p className="text-sm text-muted-foreground">Choose a whole number from 300 to 2,000 pixels.</p>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={borderId}
          checked={properties.showBorder === true}
          onCheckedChange={(showBorder) => onChange({ ...properties, showBorder })}
        />
        <Label htmlFor={borderId}>Show chat border</Label>
      </div>
      <aside className="grid gap-2 rounded-md bg-muted p-3 text-sm" aria-label="Model chat authorization guidance">
        <p>A workspace admin must enable the model-serving user authorization scope for this App. Every viewer needs CAN QUERY access to the selected endpoint.</p>
        <p>Inference uses the current viewer’s Databricks permissions in the workspace hosting this App. The endpoint must be READY and support chat messages.</p>
      </aside>
    </fieldset>
  );
}

function readinessLabel(readiness: "ready" | "not-ready" | "unknown"): string {
  if (readiness === "ready") {
    return "READY";
  }
  return readiness === "not-ready" ? "not ready" : "status unavailable";
}

function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;
}

export default ModelChatPropertiesEditor;
