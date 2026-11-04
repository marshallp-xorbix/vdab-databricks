import type { FC } from "react";
import { useRef, useState } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";

const SliderRenderer: FC<VdabCanvasRendererProps> = ({ component, theme = {} }) => {
  const props = component.props || {
    label: "", 
    minValue: 0, 
    maxValue: 100, 
    defaultValue: 50,
    upperValue: 60,
    step: 1, 
    disabled: false, 
    help: "", 
    format: "", 
    ranged: false 
  };

  const primaryColor = theme.primaryColor;
  const secondaryBackgroundColor = theme.secondaryBackgroundColor;
  const textColor = theme.textColor;

  const labelText = props.label as any;
  const minValue = props.minValue as any;
  const maxValue = props.maxValue as any;
  const defaultValue = props.defaultValue as any;
  const upperValue = props.upperValue as any;
  const step = props.step as any;
  const disabled = props.disabled as any;
  const help = props.help as any;
  const format = props.format as any;
  const ranged = props.ranged as any;
  const percent = (v: number): number => {
    if (maxValue === minValue) return 0;
    return ((v - minValue) / (maxValue - minValue)) * 100;
  };
  const onChange = component.props?.onChange as any;
  const [value, setValue] = useState(defaultValue);
  const [upper, setUpper] = useState(upperValue);
  const [activeThumb, setActiveThumb] = useState<"lower" | "upper" | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const stepClamp = (v: number) => Math.min(maxValue, Math.max(minValue, Math.round(v/step) * step));
  const valueFromPointer = (clientX: number) => {
    const rect = sliderRef.current!.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    return stepClamp(minValue + pct * (maxValue - minValue));
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeThumb) return;
    const v = valueFromPointer(e.clientX);

    if (!ranged) {
      setValue(v);
      onChange?.(v);
      return;
    }

    if (activeThumb === "lower") {
      const next = Math.min(v, upper - step);
      setValue(next);
      onChange?.([next, upper]);
    } else {
      const next = Math.max(v, value + step);
      setUpper(next);
      onChange?.([value, next]);
    }
  };
  const stop = () => setActiveThumb(null);

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" style={{ color: textColor }}>
          {labelText}
        </label>
        { help && (
          <div className="relative group">
            <span 
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground cursor-help bg-transparent"
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
      {/* Slider */}
      <div
        className="relative pt-4 group"
        onPointerMove={disabled ? undefined : onPointerMove}
        onPointerUp={disabled ? undefined : stop}
        onPointerLeave={disabled ? undefined : disabled ? undefined : stop}
        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      >
        {/* Value bubbles */}
        <ValueBubble
          left={percent(value)}
          color={primaryColor}
          value={formatValue(value, format)}
        />

        {ranged && (
          <ValueBubble
            left={percent(upper)}
            color={primaryColor}
            value={formatValue(upper, format)}
          />
        )}

        {/* Track */}
        <div
          ref={sliderRef}
          className="relative h-1 rounded-full"
          style={{ 
            backgroundColor: secondaryBackgroundColor,
            opacity: disabled ? 0.5 : 1,
           }}
        >
          {/* Active range */}
          <div
            className="absolute h-1 rounded-full"
            style={{
              left: `${percent(ranged ? value : minValue)}%`,
              width: ranged
                ? `${percent(upper) - percent(value)}%`
                : `${percent(value)}%`,
              backgroundColor: disabled ? secondaryBackgroundColor : primaryColor,
              opacity: disabled ? 0.5 : 1,
            }}
          />

          {/* Thumbs */}
          <Thumb
            left={percent(value)}
            color={primaryColor}
            onPointerDown={() => setActiveThumb("lower")}
            disabled={disabled}
          />

          {ranged && (
            <Thumb
              left={percent(upper)}
              color={primaryColor}
              onPointerDown={() => setActiveThumb("upper")}
              disabled={disabled}
            />
          )}
        </div>

        {/* Min / Max hover */}
        <div
          className="flex justify-between text-xs mt-1 opacity-0 transition-opacity duration-150 group-hover:opacity-60"
          style={{ color: textColor }}
        >
          <span>{formatValue(minValue, format)}</span>
          <span>{formatValue(maxValue, format)}</span>
        </div>
      </div>
    </div>
  );
};

function Thumb({
  left,
  color,
  onPointerDown,
  disabled,
}: {
  left: number;
  color: string;
  onPointerDown: () => void;
  disabled: boolean;
}) {
  return (
    <div
      onPointerDown={disabled ? undefined : onPointerDown}
      className="absolute top-1/2 h-4 w-4 rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition"
      style={{
        left: `${left}%`,
        backgroundColor: disabled ? "darkgray" : color,
        opacity: disabled ? 0.5 : 1,
      }}
    />
  );
}

function ValueBubble({
  left,
  color,
  value,
}: {
  left: number;
  color: string;
  value: number | string;
}) {
  return (
    <div
      className="absolute -top-1 text-xs font-medium"
      style={{
        left: `${left}%`,
        transform: "translateX(-50%)",
        color,
      }}
    >
      {value}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)}${sizes[i]}`;
}

function formatValue(value: number, format?: string) {
  if (format == null || format === "plain") {
    return value.toString();
  }

  // --- Predefined Streamlit formats ---
  switch (format) {
    case "localized":
      return new Intl.NumberFormat().format(value);

    case "percent":
      return new Intl.NumberFormat(undefined, {
        style: "percent",
      }).format(value);

    case "dollar":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);

    case "euro":
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(value);

    case "yen":
      return new Intl.NumberFormat("ja-JP", {
        style: "currency",
        currency: "JPY",
        maximumFractionDigits: 0,
      }).format(value);

    case "compact":
      return new Intl.NumberFormat(undefined, {
        notation: "compact",
      }).format(value);

    case "scientific":
      return value.toExponential();

    case "engineering": {
      if (value === 0) return "0";
      const exponent = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
      const mantissa = value / Math.pow(10, exponent);
      return `${mantissa.toFixed(3)}E${exponent}`;
    }

    case "accounting":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        currencySign: "accounting",
      }).format(value);

    case "bytes":
      return formatBytes(value);

    default:
      break;
  }

  // --- Printf-style fallback ---
  const match = format.match(/%\.?(\d*)f|%d|%\.?(\d*)%/);
  if (!match) return value.toString();

  if (format.includes("f")) {
    const decimals = match[1] ? parseInt(match[1]) : 0;
    return value.toFixed(decimals);
  }

  if (format.includes("d")) {
    return Math.round(value).toString();
  }

  if (format.includes("%")) {
    const decimals = match[2] ? parseInt(match[2]) : 0;
    return (value * 100).toFixed(decimals) + "%";
  }

  return value.toString();
}


export default SliderRenderer;
