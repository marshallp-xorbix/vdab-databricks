import type { FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";

interface LabelProps {
  text?: string;
  fontSize?: "small" | "medium" | "large";
  bold?: boolean;
}

const LabelRenderer: FC<VdabCanvasRendererProps> = ({ component }) => {
  const props = component.props as LabelProps;
  const text = props.text || "Label Text";
  const fontSize = props.fontSize || "medium";
  const bold = props.bold || false;

  const fontSizeMap = {
    small: "text-base",
    medium: "text-lg",
    large: "text-2xl",
  };

  const sizeClass = fontSizeMap[fontSize] || fontSizeMap.medium;
  const weightClassMap = {
    true: "font-bold",
    false: "font-normal",
  };
  const weightClass = weightClassMap[String(bold) as "true" | "false"];

  return (
    <p className={[sizeClass, weightClass, "text-foreground", "m-0"].join(" ")}>
      {text}
    </p>
  );
};

export default LabelRenderer;
