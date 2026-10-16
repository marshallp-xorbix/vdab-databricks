/**
 * Sizes a canvas for device pixel ratio and returns CSS pixel dimensions.
 */
export function prepareStoryCanvas(
  canvas: HTMLCanvasElement,
  previewHeightPx: number,
): { width: number; height: number; ctx: CanvasRenderingContext2D } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const parent = canvas.parentElement;
  const width = parent?.clientWidth || 480;
  const height = previewHeightPx;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, ctx };
}
