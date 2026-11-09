import { Link, useParams } from "react-router-dom";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import { useProjectDeployments } from "../hooks/useProjectDeployments";
import { useWorkspaceAppDeploymentTarget } from "../hooks/useWorkspaceAppDeploymentTarget";
import { AppResourceKindSlug } from "../types/appResourceKinds";

interface IGenieChatPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

function GenieChatPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onChange,
}: Readonly<IGenieChatPropertiesEditorProps>) {
  const { appId } = useParams();
  const deploymentsQuery = useProjectDeployments(appId);
  const targetQuery = useWorkspaceAppDeploymentTarget(
    deploymentsQuery.data?.childApp?.appName,
  );
  const selectedResourceName = readText(properties.genieSpaceAppResourceName);
  const titleId = `genie-chat-title-${componentKey}`;
  const resourceId = `genie-chat-resource-${componentKey}`;
  const heightId = `genie-chat-height-${componentKey}`;
  const borderId = `genie-chat-border-${componentKey}`;
  const genieResources = (targetQuery.data?.appResources ?? []).filter(
    (resource) => AppResourceKindSlug.GenieSpace in resource,
  );
  const selectedIsVisible = genieResources.some(
    (resource) => resource.name === selectedResourceName,
  );

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Genie chat properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={resourceId}>Genie space app resource</Label>
        <select
          id={resourceId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedResourceName}
          onChange={(event) =>
            onChange({
              ...properties,
              genieSpaceAppResourceName: event.target.value,
            })
          }
        >
          <option value="">Select a Genie space resource</option>
          {selectedResourceName !== "" && !selectedIsVisible ? (
            <option value={selectedResourceName}>
              Missing: {selectedResourceName}
            </option>
          ) : null}
          {genieResources.map((resource) => (
            <option key={resource.name} value={resource.name}>
              {resource.name}
              {"genie_space" in resource && resource.genie_space.name
                ? ` · ${resource.genie_space.name}`
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
        genieResources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Genie space resources are configured.{" "}
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
            to add one, then select it here.
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={titleId}>Chat title</Label>
        <Input
          id={titleId}
          name="genieChatTitle"
          required
          maxLength={500}
          value={readText(properties.title, "Genie Chat")}
          onChange={(event) =>
            onChange({ ...properties, title: event.target.value })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={heightId}>Chat height (px)</Label>
        <Input
          id={heightId}
          name="genieChatHeight"
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

export default GenieChatPropertiesEditor;
