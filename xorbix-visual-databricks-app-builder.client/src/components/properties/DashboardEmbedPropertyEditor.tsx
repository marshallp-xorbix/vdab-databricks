import { useMemo, useState, type FC } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { VdabComponent } from "../../types/components";
import { Textarea } from "../ui/textarea";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import { HeightPixelsPropertyEditor } from "./HeightPixelsPropertyEditor";
import { validateDatabricksDashboardEmbedUrl } from "../../utils/validateDatabricksDashboardEmbedUrl";
import {
  HEIGHT_PIXELS_DEFAULT,
  HEIGHT_PIXELS_MAX,
  HEIGHT_PIXELS_MIN,
} from "../../utils/componentProps/heightPixelsUtils";

interface DashboardEmbedPropsShape {
  src?: string;
  height?: number;
  scrolling?: boolean;
}

interface DashboardEmbedPropertyEditorProps {
  component: VdabComponent;
  onPropertyChange: (key: string, value: unknown) => void;
  workspaceUrl: string | null;
}

export const DashboardEmbedPropertyEditor: FC<
  DashboardEmbedPropertyEditorProps
> = ({ component, onPropertyChange, workspaceUrl }) => {
  const props = component.props as DashboardEmbedPropsShape;
  const src = typeof props.src === "string" ? props.src : "";
  const height = props.height;
  const scrolling = props.scrolling !== false;
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);

  const srcValidation = useMemo(
    () => validateDatabricksDashboardEmbedUrl(src, workspaceUrl),
    [src, workspaceUrl],
  );

  const srcError =
    src.trim().length > 0 && !srcValidation.ok ? srcValidation.message : null;

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`dashboard-embed-src-${component.id}`}
          className="block text-xs font-medium text-muted-foreground mb-0.5"
        >
          Embed URL
        </label>
        <Textarea
          id={`dashboard-embed-src-${component.id}`}
          value={src}
          placeholder="Paste the Lakeview iframe URL from Share → Embed iframe"
          onChange={(e) => onPropertyChange("src", e.target.value)}
          className={`min-h-[88px] text-sm ${
            srcError ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
        />
        <p className="text-xs text-muted-foreground mt-1">
          HTTPS URL for this workspace only, with path{" "}
          <span className="font-mono text-[11px]">/embed/dashboardsv3/…</span>.
        </p>
        {srcError ? (
          <p className="text-xs text-destructive mt-1">{srcError}</p>
        ) : null}

        <button
          type="button"
          className="mt-2 flex w-full items-center gap-1 text-left text-xs font-medium text-primary hover:underline"
          onClick={() => setLearnMoreOpen((open) => !open)}
          aria-expanded={learnMoreOpen}
        >
          {learnMoreOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          Learn more
        </button>
        {learnMoreOpen ? (
          <div className="mt-2 space-y-2 rounded-md bg-muted p-3 text-xs text-foreground">
            <p className="font-medium text-foreground">How to get the URL</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Open your Lakeview dashboard in this workspace.</li>
              <li>
                Choose <strong>Share</strong>, then <strong>Embed iframe</strong>.
              </li>
              <li>Copy the iframe URL and paste it into the field above.</li>
            </ol>
            <p className="font-medium text-foreground pt-1">Permissions</p>
            <p>
              Anyone who uses your app needs at least viewer access to the
              dashboard (or equivalent) in Databricks, or the embed will not load
              for them.
            </p>
            <p className="font-medium text-foreground pt-1">
              Workspace embedding settings
            </p>
            <p>
              Workspace security settings must allow embedding in the environment
              where the app runs (for example Databricks Apps on{" "}
              <span className="font-mono text-[11px]">databricksapps.com</span>).
              If embedding is restricted, admins may need to allow your app
              domain.
            </p>
          </div>
        ) : null}
      </div>

      <HeightPixelsPropertyEditor
        label="Height (px)"
        value={height}
        onChange={(next) => onPropertyChange("height", next)}
      />
      <p className="text-xs text-muted-foreground -mt-2">
        Saves between {HEIGHT_PIXELS_MIN}px and {HEIGHT_PIXELS_MAX}px; blank
        defaults to {HEIGHT_PIXELS_DEFAULT}px.
      </p>

      <BooleanPropertyEditor
        label="Scrolling"
        value={scrolling}
        onChange={(next) => onPropertyChange("scrolling", next)}
      />
    </div>
  );
};
