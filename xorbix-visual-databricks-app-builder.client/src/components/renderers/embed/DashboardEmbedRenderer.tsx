import type { FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { normalizeHeightPixelsValue } from "../../../utils/componentProps/heightPixelsUtils";
import { validateDatabricksDashboardEmbedUrl } from "../../../utils/validateDatabricksDashboardEmbedUrl";

interface DashboardEmbedProps {
  src?: string;
  height?: number;
  scrolling?: boolean;
}

const DashboardEmbedRenderer: FC<Readonly<VdabCanvasRendererProps>> = ({
  component,
  workspaceUrl = null,
  isBuilderCanvas = false,
}) => {
  const props = component.props as DashboardEmbedProps;
  const src = typeof props.src === "string" ? props.src.trim() : "";
  const height = normalizeHeightPixelsValue(props.height);
  const scrolling = props.scrolling !== false;

  if (!src) {
    return (
      <div className="rounded-md border border-dashed border-input bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Databricks dashboard embed</p>
        <p className="mt-1 text-xs">
          Set the embed URL from the dashboard (
          <strong>Share</strong> → <strong>Embed iframe</strong>). URLs must
          match this app&apos;s workspace.
        </p>
      </div>
    );
  }

  const validation = validateDatabricksDashboardEmbedUrl(src, workspaceUrl);
  if (!validation.ok) {
    return (
      <div className="rounded-md border border-dashed border-warning/40 bg-warning-subtle px-3 py-6 text-center text-sm text-warning-foreground">
        <p className="font-medium">Invalid embed URL</p>
        <p className="mt-1 text-xs">{validation.message}</p>
      </div>
    );
  }

  return (
    <iframe
      title="Databricks dashboard"
      src={src}
      height={height}
      className={`w-full max-w-full rounded-md border border-border bg-card${
        isBuilderCanvas ? " pointer-events-none" : ""
      }`}
      style={{
        height,
        overflow: scrolling ? "auto" : "hidden",
      }}
      scrolling={scrolling ? "yes" : "no"}
    />
  );
};

export default DashboardEmbedRenderer;
