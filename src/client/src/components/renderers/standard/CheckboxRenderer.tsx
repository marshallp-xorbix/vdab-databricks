import type { FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";

const CheckboxRenderer: FC<VdabCanvasRendererProps> = ({ component, theme = {} }) => {
  const props = component.props || { label: "", defaultChecked: false, help: "", disabled: false };
  const labelText = props.label as any;
  const helpText = props.help as any;
  const disabled = props.disabled as any;
  const defaultChecked = props.defaultChecked as any;
  const textColor = theme.textColor;
  const secondaryBackgroundColor = theme.secondaryBackgroundColor;
  const primaryColor = theme.primaryColor;
  // inline styles are needed for dynamic colors since Tailwind can't handle dynamic classes
  let checkboxStyle = {
    "--chk-border": textColor,
    "--chk-hover": primaryColor,
    "--chk-active": primaryColor,
    "--chk-background": secondaryBackgroundColor,
  } as React.CSSProperties;
  if (defaultChecked) {
    checkboxStyle = {
      "--chk-border": textColor,
      "--chk-hover": secondaryBackgroundColor,
      "--chk-active": secondaryBackgroundColor,
      "--chk-background": primaryColor,
    } as React.CSSProperties;
  }

  return (
    <div className={"flex items-center gap-3"} style={checkboxStyle}>
      <style>
        {`
					.themed-checkbox {
						width: 1rem;
						height: 1rem;
						appearance: none;
						background-color: var(--chk-background);
						border: 2px solid var(--chk-border);
						border-radius: 0.25rem;
						cursor: pointer;
						transition: background-color 0.15s, border-color 0.15s;
						position: relative;
					}

					.themed-checkbox:hover {
						background-color: var(--chk-hover);
					}

					.themed-checkbox:checked {
						background-color: var(--chk-active);
						border-color: var(--chk-border);
					}

          .themed-checkbox:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

        `}
      </style>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className={"themed-checkbox"}
        disabled={disabled}
      />
      <label className="text-sm font-medium text-foreground">{labelText}</label>
      { helpText && (
      <div className="relative group">
        <span 
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground cursor-help bg-transparent"
            >
              ?
        </span> 
        <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-2/3 rounded-lg px-3 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap shadow-md"
        style={{ backgroundColor: secondaryBackgroundColor }}
        >
          {helpText}
        </div>
      </div>
    )}
    </div>
  );
};

export default CheckboxRenderer;
