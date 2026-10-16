import React, { useState, useEffect, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";

/**
 * Toggle Component Renderer
 * Renders a toggle switch component from VDAB component data
 */
const ToggleRenderer: FC<VdabCanvasRendererProps> = ({ component, theme = {} }) => {
  const props = component.props || { label: "", defaultValue: false, help: "", disabled: false };
  const label = props.label as any;
  const defaultValue = props.defaultValue;
  const disabled = props.disabled as any;
  const help = props.help as any;
  const primaryColor = theme.primaryColor;
  const textColor = theme.textColor;
  const secondaryBackgroundColor = theme.secondaryBackgroundColor;
  const toggleStyle = {
    "--toggle-on-bg": primaryColor,
    "--toggle-off-bg": secondaryBackgroundColor,
    "--toggle-thumb-bg": textColor,
  } as React.CSSProperties;
  // setup switch when click
  const [value, setValue] = useState(defaultValue) as any;
  // setup switch when default value changes
  useEffect(() => {
      setValue(defaultValue);
    }, [defaultValue]);


  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        style={toggleStyle}
        aria-checked={value}
        className={`relative inline-flex h-4 w-9 items-center rounded-full transition-colors
					focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
					${value ? "bg-[var(--toggle-on-bg)]" : "bg-[var(--toggle-off-bg)]"}
					${disabled ? "opacity-50 cursor-not-allowed" : ""}
				`}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setValue(!value);
          }
        }} 
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <label className="text-sm font-small text-foreground">{label}</label>
      { help && (
      <div className="relative group">
        <span 
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground cursor-help bg-transparent"
            >
              ?
        </span> 
        <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-2/3 rounded-lg px-3 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap shadow-md"
        style={{ backgroundColor: secondaryBackgroundColor }}
        >
          {help}
        </div>
      </div>
    )}
    </div>
  );
};

export default ToggleRenderer;
