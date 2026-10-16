import type { FC } from "react";
import { useState } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import { Eye, EyeOff } from "lucide-react";

const TextInputRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const props = component.props || {
    label: "Label",
    placeholder: "",
    defaultValue: "",
    help: "",
    disabled: false,
    type: "default",
    multiline: false,
    height: "None",
  };
  const labelText = props.label as string;
  const placeholder = props.placeholder as string;
  const defaultValue = props.defaultValue as string;
  const help = props.help as string;
  const disabled = props.disabled as boolean;
  const type = props.type as string;
  const isMultiline = props.multiline as boolean;
  const height = props.height as string;

  const primaryColor = theme.primaryColor;
  const secondaryBackgroundColor = theme.secondaryBackgroundColor;
  const textColor = theme.textColor;
  const backgroundColor = theme.backgroundColor;

  const baseStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "10px 12px",
    fontSize: 16,
    backgroundColor: secondaryBackgroundColor,
    color: textColor,
    outline: "none",
    transition: "all 0.2s ease",
    ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
  };

  const handleFocus = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    e.currentTarget.style.border = `1px solid ${primaryColor}`;
    e.currentTarget.style.boxShadow = `0 0 0 2px ${primaryColor}33`;
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    e.currentTarget.style.border = "1px solid #d1d5db";
    e.currentTarget.style.boxShadow = "none";
  };

  const [showPassword, setShowPassword] = useState(false);

  let multilineHeight: React.CSSProperties["height"];
  if (typeof height === "string" && !Number.isNaN(Number(height))) {
    multilineHeight = Number(height);
  } else if (height === "stretch") {
    multilineHeight = undefined;
  } else {
    multilineHeight = "auto";
  }

  let renderedInput: React.ReactNode;

  if (isMultiline) {
    renderedInput = (
      <textarea
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={disabled}
        rows={height === "stretch" ? 4 : undefined}
        style={{
          ...baseStyle,
          height: multilineHeight,
          overflowY: height === "content" ? "hidden" : "auto",
          resize: height === "content" ? "none" : "vertical",
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
          if (height === "content") {
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = e.currentTarget.scrollHeight + "px";
          }
        }}
      />
    );
  } else if (type === "password") {
    renderedInput = (
      <div style={{ position: "relative" }}>
        <input
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          defaultValue={defaultValue}
          disabled={disabled}
          style={{ ...baseStyle, paddingRight: 40 }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          disabled={disabled}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            padding: 4,
            cursor: disabled ? "not-allowed" : "pointer",
            color: textColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  } else {
    renderedInput = (
      <input
        type="text"
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={disabled}
        style={baseStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }

  return (
    <div className="w-full">
      {/* Label + Help */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" style={{ color: textColor }}>
          {labelText}
        </label>
        {help && (
          <div className="relative group">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground cursor-help bg-transparent">
              ?
            </span>
            <div
              className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-2/3 rounded-lg px-3 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap shadow-md"
              style={{ backgroundColor: backgroundColor, color: textColor }}
            >
              {help}
            </div>
          </div>
        )}
      </div>
      {/* Input */}

      {renderedInput}
    </div>
  );
};

export default TextInputRenderer;
