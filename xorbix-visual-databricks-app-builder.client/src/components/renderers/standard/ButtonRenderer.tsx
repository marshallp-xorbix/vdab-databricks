import type { FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";


const ButtonRenderer: FC<VdabCanvasRendererProps> = ({ component, theme = {}}) => {
  const props = component.props || { label: "", variant: "primary", help: "", disabled: false };
  const primaryColor = theme.primaryColor;
  const textColor = theme.textColor;
  const secondaryBackgroundColor = theme.secondaryBackgroundColor;
  const variant = props.variant;
  const buttonText = props.label as any;
  const disabled = props.disabled as any;
  const help = props.help as any;

  let buttonStyle: React.CSSProperties = {};
  const baseClasses = "px-4 py-2 rounded font-medium transition-colors";

  if (variant === "primary") {
    buttonStyle = {
      backgroundColor: primaryColor,
      color: "#ffffff",
    };
  } else if (variant === "secondary") {
    buttonStyle = {
      backgroundColor: "white",
      color: textColor,
      border: `2px solid ${primaryColor}`,
    };
  }

 
return (
  <div className="relative inline-flex group">
    <button
      disabled={disabled}
      className={`${baseClasses} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      style={buttonStyle}
    >
      {buttonText}
    </button> 
    {help && (
      <div
        className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-lg px-3 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap shadow-md"
        style={{ backgroundColor: secondaryBackgroundColor }}
      >
        {help}
      </div>
    )}
  </div>
  );
};

export default ButtonRenderer;
