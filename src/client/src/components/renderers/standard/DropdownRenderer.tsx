import { type FC, useState } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";

interface DropdownOptionDto {
  value: string;
}

const DropdownRenderer: FC<VdabCanvasRendererProps> = ({ component, theme = {} }) => {
  const props = component.props || { label: "", options: [], defaultValue: "", help: "", disabled: false, multiselect: false };
  const textColor = theme.textColor;
  const borderColor = theme.primaryColor;
  const backgroundColor = theme.secondaryBackgroundColor;
  const focusColor = theme.primaryBackgroundColor;
  const rawOptions = props.options as DropdownOptionDto[];
  const options: string[] = rawOptions.map((o) => o.value);
  const defaultValue = props.defaultValue as any;
  const label = props.label as any;
  const placeholder = props.placeholder as any;
  const disabled = props.disabled as any;
  const help = props.help as any;
  const multiselect = props.multiselect;
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

	return (
    <div>
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <label
            className="block text-sm font-medium"
            style={{ color: textColor }}
          >
            {label}
          </label>
          { help && (
          <div className="relative group">
            <span 
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground cursor-help bg-transparent"
                >
                  ?
            </span> 
            <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-2/3 rounded-lg px-3 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap shadow-md"
            style={{ backgroundColor: backgroundColor }}
            >
              {help}
            </div>
          </div>
          )}
        </div>
      </div>
    {multiselect ? (
      <div
          className="relative w-full rounded-md px-3 py-3 pr-3 pl-2 text-sm flex flex-wrap gap-1"
          style={{
            border: `1px solid ${borderColor}`,
            backgroundColor,
            ...(disabled && { opacity: 0.5, cursor: "not-allowed" }),
          }}
        >
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1">
            {selectedIndices.length > 0 && !disabled && (
              <button
                type="button"     
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-card text-muted-foreground hover:bg-muted z-20"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSelectedIndices([])}
                style={{color : "grey"}}
              >
                ×
              </button>
            )}
            <span
              className="pointer-events-none flex items-center pl-2"
              style={{ color: textColor }}
            >
              ▼
            </span>
          </div>
          {!disabled && (
            <select
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              value=""
              onChange={(e) => {
                const value = e.target.value;

                if (value === "__all__") {
                  setSelectedIndices(options.map((_,i) => i));
                } else {
                  const idx = Number(e.target.value);
                  if (!selectedIndices.includes(idx)) {
                    setSelectedIndices((prev) => [...prev, idx]);
                  }
                }
                e.target.value = "";
              }}
            >
              <option value="__all__">Select All</option>
              <option value="" />
              {options.map((option, idx) => (
                <option
                  key={idx}
                  value={idx}
                  disabled={selectedIndices.includes(idx)}
                >
                  {option}
                </option>
              ))}
            </select>
          )}
          {/* Button Chips */}
          {selectedIndices.map((idx) => (
            <span
              key={idx}
              className="relative z-10 flex items-center gap-1 rounded px-2 text-sm"
              style={{ backgroundColor: borderColor, color: "#fff" }}
            >
              {options[idx]}
              {!disabled && (
                <button
                  type="button"
                  className="w-4 h-4 flex items-center justify-center font-bold leading-none"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndices((prev) =>
                      prev.filter((i) => i !== idx)
                    );
                  }}
                >
                ×
                </button>
              )}
            </span>
          ))}
          {selectedIndices.length === 0 && (
            <span className="text-xs text-muted-foreground">
              {placeholder}
            </span>
          )}
        </div>
      ) : (
        <select
          { ...defaultValue && <option value={defaultValue} selected> {defaultValue} </option> }
          disabled={disabled}
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none"
          style={{
            color: textColor,
            backgroundColor,
            border: `1px solid ${borderColor}`,
            ...(disabled && { opacity: 0.5, cursor: "not-allowed" }),
            boxShadow: `0 0 0 1px transparent`,
          }}
          onFocus={(e) => {
            if (!disabled) {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${focusColor}`;
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}

          {options.map((option, idx) => (
            <option key={idx} value={idx}>
              {option}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default DropdownRenderer;
