import type { CSSProperties, FC, ReactNode } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { normalizeHeightPixelsValue } from "../../../utils/componentProps/heightPixelsUtils";

/** Reserved band for chat input in deployed Streamlit (matches server template estimate). */
const INPUT_RESERVE_PX = 105;
const DEFAULT_PRIMARY_COLOR = "#7c3aed";
const DEFAULT_BACKGROUND_COLOR = "#f8fafc";
const DEFAULT_TEXT_COLOR = "#0f172a";
const BORDERED_CONTAINER_CLASS =
  "rounded-md px-3 py-3 text-center text-sm shadow-sm flex flex-col overflow-x-hidden max-w-full";
const DEFAULT_CONTAINER_CLASS =
  "rounded-md border border-dashed border-violet-300 bg-violet-50/80 px-3 py-3 text-center text-sm text-violet-950 flex flex-col overflow-x-hidden max-w-full";
const BORDERED_MESSAGES_CLASS =
  "flex-1 overflow-y-auto overflow-x-hidden rounded-sm px-2 py-4 my-2 text-left min-h-0 max-w-full";
const DEFAULT_MESSAGES_CLASS =
  "flex-1 overflow-y-auto overflow-x-hidden rounded-sm bg-card/50 px-2 py-4 my-2 text-left border border-border min-h-0 max-w-full";

interface GenieChatPropsShape {
  genieSpaceAppResourceName?: string;
  title?: string;
  showBorder?: boolean;
  chatTotalHeightPixels?: number;
}

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getDisplayTitle(value: unknown): string {
  const trimmed = getTrimmedString(value);
  return trimmed.length > 0 ? trimmed : "Genie Chat";
}

function buildContainerStyle(
  showBorder: boolean,
  totalHeightPx: number,
  primary: string,
  secondaryBg: string,
  backgroundColor: string,
  textColor: string,
): CSSProperties {
  if (!showBorder) {
    return { minHeight: totalHeightPx };
  }

  return {
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: primary,
    backgroundColor: secondaryBg || backgroundColor || DEFAULT_BACKGROUND_COLOR,
    color: textColor || DEFAULT_TEXT_COLOR,
    minHeight: totalHeightPx,
  };
}

function renderBindingMessage(
  resourceName: string,
  showBorder: boolean,
): ReactNode {
  const className = showBorder
    ? "mt-2 text-xs font-mono opacity-80"
    : "mt-2 text-xs font-mono text-violet-800";

  if (resourceName.length > 0) {
    return <p className={className}>Resource: {resourceName}</p>;
  }

  return (
    <p className={showBorder ? "mt-2 text-xs opacity-80" : "mt-2 text-xs text-violet-800"}>
      Bind a <strong>Genie space</strong> app resource in properties (add it
      under App Settings first).
    </p>
  );
}

const GenieChatRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const props = component.props as GenieChatPropsShape;
  const resourceName = getTrimmedString(props.genieSpaceAppResourceName);
  const title = getDisplayTitle(props.title);
  const showBorder = props.showBorder === true;
  const totalHeightPx = normalizeHeightPixelsValue(props.chatTotalHeightPixels);
  const messagesRegionPx = Math.max(180, totalHeightPx - INPUT_RESERVE_PX);
  const primary = getTrimmedString(theme.primaryColor) || DEFAULT_PRIMARY_COLOR;
  const secondaryBg = getTrimmedString(theme.secondaryBackgroundColor);
  const backgroundColor = getTrimmedString(theme.backgroundColor);
  const textColor = getTrimmedString(theme.textColor);
  const containerClassName = showBorder
    ? BORDERED_CONTAINER_CLASS
    : DEFAULT_CONTAINER_CLASS;
  const messagesClassName = showBorder
    ? BORDERED_MESSAGES_CLASS
    : DEFAULT_MESSAGES_CLASS;
  const detailClassName = showBorder
    ? "mt-1 text-xs opacity-90"
    : "mt-1 text-xs text-violet-900/90";
  const containerStyle = buildContainerStyle(
    showBorder,
    totalHeightPx,
    primary,
    secondaryBg,
    backgroundColor,
    textColor,
  );

  return (
    <div className={containerClassName} style={containerStyle}>
      <p className="font-medium shrink-0">{title}</p>
      <div
        className={messagesClassName}
        style={{
          maxHeight: messagesRegionPx,
          minHeight: Math.min(120, messagesRegionPx),
        }}
      >
        <p className="text-xs opacity-70 text-center">
          Message thread preview (~{messagesRegionPx}px scroll region)
        </p>
      </div>
      <p className={detailClassName}>
        Designer preview only. Deployed apps run Genie conversationally via the
        Databricks SDK. Total footprint ≈{totalHeightPx}px (input band reserved).
      </p>
      {renderBindingMessage(resourceName, showBorder)}
    </div>
  );
};

export default GenieChatRenderer;
