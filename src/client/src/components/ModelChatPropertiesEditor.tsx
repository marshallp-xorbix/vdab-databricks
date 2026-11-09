import { Link, useParams } from "react-router-dom";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import { useProjectDeployments } from "../hooks/useProjectDeployments";
import { useWorkspaceAppDeploymentTarget } from "../hooks/useWorkspaceAppDeploymentTarget";
import { AppResourceKindSlug } from "../types/appResourceKinds";

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
  const { appId } = useParams();
  const deploymentsQuery = useProjectDeployments(appId);
  const targetQuery = useWorkspaceAppDeploymentTarget(
    deploymentsQuery.data?.childApp?.appName,
  );
  const selectedResourceName = readText(
    properties.servingEndpointAppResourceName,
  );
  const titleId = `model-chat-title-${componentKey}`;
  const resourceId = `model-chat-resource-${componentKey}`;
  const heightId = `model-chat-height-${componentKey}`;
  const borderId = `model-chat-border-${componentKey}`;
  const servingResources = (targetQuery.data?.appResources ?? []).filter(
    (resource) => AppResourceKindSlug.ServingEndpoint in resource,
  );
  const selectedResource = servingResources.find(
    (resource) => resource.name === selectedResourceName,
  );
  const selectedIsVisible = selectedResource !== undefined;

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Model chat properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={resourceId}>Serving endpoint app resource</Label>
        <select
          id={resourceId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedResourceName}
          onChange={(event) =>
            onChange({
              ...properties,
              servingEndpointAppResourceName: event.target.value,
            })
          }
        >
          <option value="">Select a serving endpoint resource</option>
          {selectedResourceName !== "" && !selectedIsVisible ? (
            <option value={selectedResourceName}>
              Missing: {selectedResourceName}
            </option>
          ) : null}
          {servingResources.map((resource) => (
            <option key={resource.name} value={resource.name}>
              {resource.name}
              {"serving_endpoint" in resource
                ? ` · ${resource.serving_endpoint.name} · ${resource.serving_endpoint.permission}`
                : ""}
            </option>
          ))}
        </select>
        {targetQuery.isPending || deploymentsQuery.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading App resources…
          </p>
        ) : null}
        {targetQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {targetQuery.error.message}
          </p>
        ) : null}
        {!targetQuery.isPending &&
        !deploymentsQuery.isPending &&
        !targetQuery.isError &&
        servingResources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No serving endpoint resources are configured.{" "}
            {appId ? (
              <Link
                className="underline"
                to={`/apps/${appId}?section=settings&settings=resources`}
              >
                Open App Settings → Resources
              </Link>
            ) : (
              "Open App Settings → Resources"
            )}{" "}
            to add one with CAN_QUERY, then select it here.
          </p>
        ) : null}
        {selectedResource &&
        "serving_endpoint" in selectedResource &&
        selectedResource.serving_endpoint.permission === "CAN_VIEW" ? (
          <p role="status" className="text-sm text-warning-foreground">
            This resource has CAN_VIEW. Change it to CAN_QUERY or CAN_MANAGE
            before deploying.
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
          onChange={(event) =>
            onChange({ ...properties, title: event.target.value })
          }
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
          onChange={(event) =>
            onChange({
              ...properties,
              chatTotalHeightPixels: Number(event.target.value),
            })
          }
        />
        <p className="text-sm text-muted-foreground">
          Choose a whole number from 300 to 2,000 pixels.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={borderId}
          checked={properties.showBorder === true}
          onCheckedChange={(showBorder) =>
            onChange({ ...properties, showBorder })
          }
        />
        <Label htmlFor={borderId}>Show chat border</Label>
      </div>
    </fieldset>
  );
}

function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : fallback;
}

export default ModelChatPropertiesEditor;
