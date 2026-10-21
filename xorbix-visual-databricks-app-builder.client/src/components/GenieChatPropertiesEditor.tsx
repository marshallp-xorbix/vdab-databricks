import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import { useWorkspaceGenieSpaces } from "../hooks/useWorkspaceGenieSpaces";

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
  const genieSpaces = useWorkspaceGenieSpaces();
  const selectedSpaceId = readText(properties.genieSpaceId);
  const selectedSpaceTitle = readText(properties.genieSpaceTitle);
  const titleId = `genie-chat-title-${componentKey}`;
  const spaceId = `genie-chat-space-${componentKey}`;
  const heightId = `genie-chat-height-${componentKey}`;
  const borderId = `genie-chat-border-${componentKey}`;
  const spaces = genieSpaces.data?.items ?? [];
  const selectedSpaceIsVisible = spaces.some((space) => space.spaceId === selectedSpaceId);

  function changeSpace(spaceId: string): void {
    const selectedSpace = spaces.find((space) => space.spaceId === spaceId);
    onChange({
      ...properties,
      genieSpaceId: selectedSpace?.spaceId ?? "",
      genieSpaceTitle: selectedSpace?.title ?? "",
    });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Genie chat properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={spaceId}>Genie space in this workspace</Label>
        <select
          id={spaceId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedSpaceId}
          onChange={(event) => changeSpace(event.target.value)}
        >
          <option value="">Select a Genie space</option>
          {selectedSpaceId !== "" && !selectedSpaceIsVisible ? (
            <option value={selectedSpaceId}>
              Unavailable: {selectedSpaceTitle || selectedSpaceId}
            </option>
          ) : null}
          {spaces.map((space) => (
            <option key={space.spaceId} value={space.spaceId}>{space.title}</option>
          ))}
        </select>
        {genieSpaces.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">Loading Genie spaces from this workspace…</p>
        ) : null}
        {genieSpaces.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {genieSpaces.error.message}
          </p>
        ) : null}
        {!genieSpaces.isPending && !genieSpaces.isError && spaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Genie spaces are visible. Ask a workspace admin to grant the Genie user scope, then confirm you can access a Genie space.
          </p>
        ) : null}
        {genieSpaces.data?.authenticationMode === "local-test" ? (
          <p className="text-sm text-muted-foreground">Local test resource only; this does not verify a Databricks Genie space.</p>
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
          onChange={(event) => onChange({ ...properties, title: event.target.value })}
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
      <aside className="grid gap-2 rounded-md bg-muted p-3 text-sm" aria-label="Genie authorization guidance">
        <p>A workspace admin must enable the Genie user authorization scope for this App. Each viewer must grant consent and have access to the selected Genie space and its data.</p>
        <p>Conversation requests use the current viewer’s Databricks permissions in the workspace hosting this App.</p>
      </aside>
    </fieldset>
  );
}

function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;
}

export default GenieChatPropertiesEditor;
