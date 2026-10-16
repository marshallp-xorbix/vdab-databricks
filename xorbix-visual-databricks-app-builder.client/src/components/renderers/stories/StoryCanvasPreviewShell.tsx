import type { FC, RefObject } from "react";

interface IStoryCanvasPreviewShellProps {
  title: string;
  titleColor: string;
  configured: boolean;
  unconfiguredMessage: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  previewHeightPx?: number;
  shellMinHeightPx?: number;
}

const DEFAULT_PREVIEW_HEIGHT_PX = 250;
const DEFAULT_SHELL_MIN_HEIGHT_PX = 300;

/**
 * Shared chrome for story visualization canvas previews (title, disclaimer, canvas frame).
 */
const StoryCanvasPreviewShell: FC<Readonly<IStoryCanvasPreviewShellProps>> = ({
  title,
  titleColor,
  configured,
  unconfiguredMessage,
  canvasRef,
  previewHeightPx = DEFAULT_PREVIEW_HEIGHT_PX,
  shellMinHeightPx = DEFAULT_SHELL_MIN_HEIGHT_PX,
}) => {
  return (
    <div
      className="w-full h-full flex flex-col p-2 bg-transparent rounded border border-border"
      style={{ minHeight: `${shellMinHeightPx}px` }}
    >
      <h3 className="mb-2 text-sm font-medium" style={{ color: titleColor }}>
        {title}
      </h3>
      {configured && (
        <div className="text-xs text-muted-foreground mb-2 italic">
          Preview only (sample data) — deployed app uses mapped fields from the
          bound table.
        </div>
      )}
      <div
        className="w-full rounded overflow-hidden border border-input"
        style={{ height: `${previewHeightPx}px` }}
      >
        {configured ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            role="img"
            aria-label={`${title} preview using sample data`}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            {unconfiguredMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryCanvasPreviewShell;
