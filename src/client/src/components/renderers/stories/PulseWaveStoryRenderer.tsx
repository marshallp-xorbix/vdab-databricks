import { useEffect, useMemo, useRef, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { parseChartAxis } from "../../../types/chartAxisConfig";
import {
  DEFAULT_PULSE_WAVE_VIEW,
  drawPulseWaveFrame,
  panPulseWaveView,
  pulseWaveCanvasXToSeriesFraction,
  zoomPulseWaveView,
  type IPulseWaveViewWindow,
  type IPulseWaveVisualConfig,
} from "./pulseWaveCanvasDraw";
import { generatePulseWavePreviewData } from "./generatePulseWavePreviewData";
import { hasRequiredAxisFields } from "./hasRequiredAxisFields";
import { prepareStoryCanvas } from "./prepareStoryCanvas";
import StoryCanvasPreviewShell from "./StoryCanvasPreviewShell";
import { useStoryCanvasPreview } from "./useStoryCanvasPreview";

interface IPulseWaveStoryRendererPropsRaw {
  title?: string;
  metricName?: string;
  timeField?: unknown;
  metricValue?: unknown;
  baselineValue?: unknown;
  aggregationMethod?: string;
  showBaseline?: boolean;
  showEvents?: boolean;
  showAnomalyMarkers?: boolean;
  fillUnderWave?: boolean;
}

const PREVIEW_HEIGHT_PX = 280;

function resolveYAxisLabel(raw: IPulseWaveStoryRendererPropsRaw): string {
  const metricAxis = parseChartAxis(raw.metricValue);
  if (metricAxis.field.trim()) {
    return metricAxis.field.trim();
  }
  if (typeof raw.metricName === "string" && raw.metricName.trim()) {
    return raw.metricName.trim();
  }
  return "Metric";
}

function buildVisualConfig(
  raw: IPulseWaveStoryRendererPropsRaw,
): IPulseWaveVisualConfig {
  const yAxisLabel = resolveYAxisLabel(raw);
  return {
    metric_name:
      typeof raw.metricName === "string" && raw.metricName.trim()
        ? raw.metricName.trim()
        : yAxisLabel,
    y_axis_label: yAxisLabel,
    aggregation_method: raw.aggregationMethod || "sum",
    show_baseline:
      typeof raw.showBaseline === "boolean" ? raw.showBaseline : true,
    show_events: typeof raw.showEvents === "boolean" ? raw.showEvents : true,
    show_anomaly_markers:
      typeof raw.showAnomalyMarkers === "boolean"
        ? raw.showAnomalyMarkers
        : true,
    fill_under_wave:
      typeof raw.fillUnderWave === "boolean" ? raw.fillUnderWave : true,
  };
}

const PulseWaveStoryRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const raw = component.props as IPulseWaveStoryRendererPropsRaw;
  const configured = hasRequiredAxisFields(
    raw.timeField,
    raw.metricValue,
    raw.baselineValue,
  );

  const visualConfig = useMemo(
    () => buildVisualConfig(raw),
    [
      raw.metricName,
      raw.metricValue,
      raw.aggregationMethod,
      raw.showBaseline,
      raw.showEvents,
      raw.showAnomalyMarkers,
      raw.fillUnderWave,
    ],
  );

  const previewSeedKey = `${component.id}|pulsewave|${visualConfig.y_axis_label}|${visualConfig.show_baseline}|${visualConfig.show_events}|${visualConfig.show_anomaly_markers}|${visualConfig.fill_under_wave}`;
  const viewRef = useRef<IPulseWaveViewWindow>({ ...DEFAULT_PULSE_WAVE_VIEW });
  const payload = useMemo(
    () => generatePulseWavePreviewData(previewSeedKey, visualConfig),
    [previewSeedKey, visualConfig],
  );

  useEffect(() => {
    viewRef.current = { ...DEFAULT_PULSE_WAVE_VIEW };
  }, [previewSeedKey]);

  const canvasRef = useStoryCanvasPreview({
    configured,
    previewHeightPx: PREVIEW_HEIGHT_PX,
    visualConfig,
    previewSeedKey,
    generatePayload: generatePulseWavePreviewData,
    draw: (ctx, width, height, drawPayload) => {
      drawPulseWaveFrame(ctx, width, height, drawPayload, viewRef.current);
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!configured || !canvas) {
      return;
    }

    const redraw = () => {
      const prepared = prepareStoryCanvas(canvas, PREVIEW_HEIGHT_PX);
      if (prepared) {
        drawPulseWaveFrame(
          prepared.ctx,
          prepared.width,
          prepared.height,
          payload,
          viewRef.current,
        );
      }
    };

    let dragging = false;
    let dragStartX = 0;
    let dragView: IPulseWaveViewWindow = { ...DEFAULT_PULSE_WAVE_VIEW };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const prepared = prepareStoryCanvas(canvas, PREVIEW_HEIGHT_PX);
      if (!prepared) {
        return;
      }
      const canvasX = event.clientX - rect.left;
      const anchor = pulseWaveCanvasXToSeriesFraction(
        canvasX,
        prepared.width,
        viewRef.current,
      );
      const zoomFactor = event.deltaY < 0 ? 0.85 : 1.18;
      viewRef.current = zoomPulseWaveView(viewRef.current, anchor, zoomFactor);
      redraw();
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      dragStartX = event.clientX;
      dragView = { ...viewRef.current };
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      const prepared = prepareStoryCanvas(canvas, PREVIEW_HEIGHT_PX);
      if (!prepared) {
        return;
      }
      const plotWidth = Math.max(1, prepared.width - 62 - 18);
      const deltaPx = event.clientX - dragStartX;
      const deltaFrac = -deltaPx / plotWidth;
      viewRef.current = panPulseWaveView(dragView, deltaFrac);
      redraw();
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const onDblClick = () => {
      viewRef.current = { ...DEFAULT_PULSE_WAVE_VIEW };
      redraw();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("dblclick", onDblClick);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("dblclick", onDblClick);
    };
  }, [canvasRef, configured, payload]);

  const title = raw.title || "Pulse Wave Story";

  return (
    <StoryCanvasPreviewShell
      title={title}
      titleColor={theme.textColor}
      configured={configured}
      unconfiguredMessage="Map time, metric, and baseline fields to preview this story."
      canvasRef={canvasRef}
      previewHeightPx={PREVIEW_HEIGHT_PX}
    />
  );
};

export default PulseWaveStoryRenderer;
