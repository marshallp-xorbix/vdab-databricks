import type { ComponentProps, ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "../../../context/ThemeContext";
import { cn } from "../../../lib/utils";
import { getStreamlitThemeDefaults } from "../AppSettingsTab/themeDefaults";

type ReactFlowProps = ComponentProps<typeof ReactFlow>;

export type ReactFlowGridPreset = "mainFlow" | "workflow";

interface IThemedReactFlowProps extends Omit<
  ReactFlowProps,
  "colorMode" | "style" | "children"
> {
  /**
   * Dot grid settings. mainFlow matches develop App Flow; workflow matches
   * develop Workflow Builder (sparser, larger black dots in light).
   */
  gridPreset?: ReactFlowGridPreset;
  /** Show zoom/fit controls (default true). */
  showControls?: boolean;
  /** Controls interactive lock button (default true when controls shown). */
  showInteractiveControls?: boolean;
  /** Show minimap (default false). */
  showMiniMap?: boolean;
  className?: string;
  children?: ReactNode;
}

const DOT_COLOR_DARK = "rgba(255,255,255,0.18)";

interface IGridSettings {
  gap: number;
  size: number;
  /** Omit in light mainFlow to use React Flow default (develop parity). */
  color?: string;
}

function resolveGridSettings(
  preset: ReactFlowGridPreset,
  isLight: boolean,
): IGridSettings {
  if (preset === "workflow") {
    return {
      gap: 24,
      size: 1.5,
      color: isLight ? "#000000" : DOT_COLOR_DARK,
    };
  }

  // mainFlow — develop: gap 12, size 1, default color in light
  return {
    gap: 12,
    size: 1,
    color: isLight ? undefined : DOT_COLOR_DARK,
  };
}

const MINIMAP_MASK_DARK = "rgb(0 0 0 / 0.55)";
const MINIMAP_MASK_LIGHT = "rgb(0 0 0 / 0.12)";

/**
 * React Flow shell for App Flow and Workflow canvases.
 * Ground color follows the product light/dark theme (dotted canvas), not the
 * app Streamlit theme — that applies only to the page/modal editor canvas.
 */
export default function ThemedReactFlow({
  gridPreset = "mainFlow",
  showControls = true,
  showInteractiveControls = true,
  showMiniMap = false,
  className,
  children,
  ...reactFlowProps
}: Readonly<IThemedReactFlowProps>) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const colorMode = isLight ? "light" : "dark";
  // Product theme defaults only — never the app's Streamlit backgroundColor.
  const canvasBackground = getStreamlitThemeDefaults(theme).backgroundColor;
  const grid = resolveGridSettings(gridPreset, isLight);
  const minimapMask = isLight ? MINIMAP_MASK_LIGHT : MINIMAP_MASK_DARK;

  return (
    <div
      className={cn("h-full min-h-0 overflow-hidden overscroll-none", className)}
      style={{
        backgroundColor: canvasBackground,
        overscrollBehaviorY: "none",
      }}
    >
      <ReactFlow
        {...reactFlowProps}
        colorMode={colorMode}
        style={{ backgroundColor: canvasBackground }}
      >
        {showControls ? (
          <Controls showInteractive={showInteractiveControls} />
        ) : null}
        {showMiniMap ? (
          <MiniMap
            maskColor={minimapMask}
            style={{ backgroundColor: canvasBackground }}
          />
        ) : null}
        <Background
          variant={BackgroundVariant.Dots}
          gap={grid.gap}
          size={grid.size}
          {...(grid.color ? { color: grid.color } : {})}
          bgColor={canvasBackground}
        />
        {children}
      </ReactFlow>
    </div>
  );
}
