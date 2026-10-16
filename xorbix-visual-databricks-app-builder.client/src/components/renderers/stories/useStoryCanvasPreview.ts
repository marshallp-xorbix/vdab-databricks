import { useEffect, useMemo, useRef, type RefObject } from "react";
import { prepareStoryCanvas } from "./prepareStoryCanvas";

interface IUseStoryCanvasPreviewOptions<TConfig, TPayload> {
  configured: boolean;
  previewHeightPx: number;
  visualConfig: TConfig;
  previewSeedKey: string;
  generatePayload: (seedKey: string, visualConfig: TConfig) => TPayload;
  draw: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    payload: TPayload,
  ) => void;
}

/**
 * Shared canvas preview lifecycle for story visualizations.
 */
export function useStoryCanvasPreview<TConfig, TPayload>({
  configured,
  previewHeightPx,
  visualConfig,
  previewSeedKey,
  generatePayload,
  draw,
}: IUseStoryCanvasPreviewOptions<TConfig, TPayload>): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const payload = useMemo(
    () => generatePayload(previewSeedKey, visualConfig),
    [generatePayload, previewSeedKey, visualConfig],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!configured || !canvas) {
      return;
    }
    const render = () => {
      const prepared = prepareStoryCanvas(canvas, previewHeightPx);
      if (prepared) {
        draw(prepared.ctx, prepared.width, prepared.height, payload);
      }
    };
    render();
    const parent = canvas.parentElement;
    if (!parent) {
      return;
    }
    const observer = new ResizeObserver(render);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [configured, draw, payload, previewHeightPx]);

  return canvasRef;
}
