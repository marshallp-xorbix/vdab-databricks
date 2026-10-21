import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import { normalizeDashboardEmbedReference } from "../utils/dashboardEmbedConfiguration";

interface IDashboardEmbedPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
}

function DashboardEmbedPropertiesEditor({
  componentKey,
  properties,
  disabled,
  onChange,
}: Readonly<IDashboardEmbedPropertiesEditorProps>) {
  const savedReference = typeof properties.src === "string" ? properties.src : "";
  const savedHeight = typeof properties.height === "number" ? properties.height : 600;
  const [referenceDraft, setReferenceDraft] = useState(savedReference);
  const [heightDraft, setHeightDraft] = useState(String(savedHeight));
  const [heightError, setHeightError] = useState<string | null>(null);
  const referenceResult = normalizeDashboardEmbedReference(referenceDraft);
  const urlId = `dashboard-embed-url-${componentKey}`;
  const heightId = `dashboard-embed-height-${componentKey}`;
  const scrollingId = `dashboard-embed-scrolling-${componentKey}`;

  useEffect(() => {
    setReferenceDraft(savedReference);
  }, [componentKey, savedReference]);

  useEffect(() => {
    setHeightDraft(String(savedHeight));
    setHeightError(null);
  }, [componentKey, savedHeight]);

  function saveReference(): void {
    if (referenceResult.ok) {
      onChange({ ...properties, src: referenceResult.reference });
    }
  }

  function saveHeight(): void {
    const height = Number(heightDraft);
    if (!Number.isSafeInteger(height) || height < 300 || height > 2000) {
      setHeightError("Enter a whole number from 300 to 2,000 pixels.");
      return;
    }
    setHeightError(null);
    onChange({ ...properties, height });
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Dashboard embed properties</legend>
      <div className="grid gap-2">
        <Label htmlFor={urlId}>Published dashboard embed URL</Label>
        <Textarea
          id={urlId}
          name="dashboardEmbedUrl"
          value={referenceDraft}
          placeholder="Paste the URL from Share → Embed dashboard"
          aria-invalid={!referenceResult.ok}
          onChange={(event) => setReferenceDraft(event.target.value)}
          onBlur={saveReference}
        />
        {!referenceResult.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {referenceResult.message}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            The pasted host and workspace ID are removed. The generated app uses the workspace where it is installed.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={heightId}>Height (px)</Label>
        <Input
          id={heightId}
          name="dashboardEmbedHeight"
          type="number"
          min={300}
          max={2000}
          step={1}
          value={heightDraft}
          aria-invalid={heightError !== null}
          onChange={(event) => setHeightDraft(event.target.value)}
          onBlur={saveHeight}
        />
        {heightError ? (
          <p role="alert" className="text-sm text-destructive">{heightError}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={scrollingId}
          checked={properties.scrolling !== false}
          onCheckedChange={(scrolling) => onChange({ ...properties, scrolling })}
        />
        <Label htmlFor={scrollingId}>Allow dashboard scrolling</Label>
      </div>
      <aside className="grid gap-2 rounded-md bg-muted p-3 text-sm" aria-label="Dashboard access guidance">
        <p>Only published dashboards can be embedded. Every viewer needs access to the dashboard.</p>
        <p>To query data with each viewer&apos;s permissions, publish with individual data permissions. Shared data permissions use the publisher&apos;s credentials.</p>
        <p>A workspace admin must allow this Databricks App domain in dashboard embedding settings.</p>
      </aside>
    </fieldset>
  );
}

export default DashboardEmbedPropertiesEditor;
