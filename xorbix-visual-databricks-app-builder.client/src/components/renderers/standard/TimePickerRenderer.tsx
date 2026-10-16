import { useEffect, useState, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";

const TimePickerRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme = {},
}) => {
  const props = component.props || {
    label: "Select Time",
    defaultValue: "",
    step: "",
    help: "",
    disabled: false,
  };
  const labelText = props.label as string;
  const defaultValue = props.defaultValue as string;
  const step = props.step as string;
  const help = props.help as string;
  const disabled = props.disabled as boolean;
  const textColor = theme.textColor;
  const secondaryBackgroundColor = theme.secondaryBackgroundColor;
  const primaryColor = theme.primaryColor;
  const backgroundColor = theme.backgroundColor;

  const [open, setOpen] = useState(false);

  const getNowTime = () => {
    const now = new Date();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const h = String(hours).padStart(2, "0");
    const m = String(minutes).padStart(2, "0");
    return `${h}:${m}`;
  };

  const initialValue =
    defaultValue === "now" ? getNowTime() : defaultValue || "";
  const [selected, setSelected] = useState(initialValue);

  useEffect(() => {
    if (defaultValue === "now") {
      setSelected(getNowTime());
    } else {
      setSelected(defaultValue || "");
    }
  }, [defaultValue]);

  const generateTimes = () => {
    const times: string[] = [];

    const stepSeconds = Math.min(Math.max(Number(step) || 900, 60), 82800);

    for (let total = 0; total < 86400; total += stepSeconds) {
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);

      const h = String(hours).padStart(2, "0");
      const m = String(minutes).padStart(2, "0");

      times.push(`${h}:${m}`);
    }

    return times;
  };

  const times = generateTimes();

  return (
    <div className="w-full relative">
      {/* Label + Help */}
      <div className="flex justify-between items-center mb-1">
        {labelText && (
          <label className="text-sm font-medium text-foreground">
            {labelText}
          </label>
        )}

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

      {/* Input (styled like date picker) */}
      <button
        onClick={() => !disabled && setOpen(!open)}
        className={`
          w-full cursor-pointer rounded-md border border-input px-3 py-2 text-sm
          flex justify-between items-center
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          
        `}
        style={{
          backgroundColor: secondaryBackgroundColor,
          borderColor: open ? primaryColor : "",
        }}
      >
        <span style={{ color: selected ? textColor : "#94a3b8" }}>
          {selected || "HH:mm"}
        </span>

        <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24">
          <path d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-10 mt-2 w-full rounded-md border shadow-lg max-h-60 overflow-y-auto"
          style={{ backgroundColor: secondaryBackgroundColor }}
        >
          {times.map((time) => {
            const isSelected = selected === time;

            return (
              <div
                key={time}
                onClick={() => {
                  setSelected(time);
                  setOpen(false);
                }}
                className="px-3 py-2 text-sm cursor-pointer"
                style={{
                  backgroundColor: isSelected ? primaryColor : "transparent",
                  color: isSelected ? "white" : textColor,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.border = `1px solid ${primaryColor}`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.border = "none";
                  }
                }}
              >
                {time}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimePickerRenderer;
