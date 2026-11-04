import { useState, type FC, useEffect } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import CalendarRenderer from "./CalendarRenderer";

const DatePickerRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme = {},
}) => {
  const props = component.props || {
    label: "Select Date",
    defaultValue: "today",
    minDate: "",
    maxDate: "",
    format: "",
    help: "",
    disabled: false,
  };
  const primaryColor = theme.primaryColor;
  const secondaryBackgroundColor = theme.secondaryBackgroundColor;
  const backgroundColor = theme.backgroundColor;
  const textColor = theme.textColor;
  const label = props.label as string;
  const defaultValue = props.defaultValue as string;
  const minDate = props.minDate as string;
  const maxDate = props.maxDate as string;
  const format = props.format as string;
  const help = props.help as string;
  const disabled = props.disabled as boolean;

  const [open, setOpen] = useState(false);
  const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const isValidDate = (date: Date) => {
    return date instanceof Date && !isNaN(date.getTime());
  };

  const formatDate = (date: Date | null) => {
    if (!date || !isValidDate(date)) return "";

    const fmt = format || "YYYY/MM/DD";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const separator = fmt.includes("/")
      ? "/"
      : fmt.includes(".")
        ? "."
        : fmt.includes("-")
          ? "-"
          : "/";

    const map: Record<string, string> = {
      YYYY: String(year),
      MM: month,
      DD: day,
    };

    return fmt
      .split(separator)
      .map((part: string) => map[part] || part)
      .join(separator);
  };

  const parseDate = (value: any) => {
    if (value === "today") return getToday();
    if (!value) return null;

    if (typeof value === "string" && value.includes("-")) {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(value);
  };

  const initialDate = parseDate(defaultValue) || new Date();
  const min = parseDate(minDate);
  const maxRaw = parseDate(maxDate);
  const max = maxRaw
    ? new Date(
        maxRaw.getFullYear(),
        maxRaw.getMonth(),
        maxRaw.getDate(),
        0,
        0,
        0,
        0,
      )
    : null;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [currentMonth, setCurrentMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );

  useEffect(() => {
    const newDate = parseDate(defaultValue) || new Date();
    setSelectedDate(newDate);
    setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
  }, [defaultValue]);

  const daysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const startDayOfWeek = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateDisabled = (date: Date) => {
    const d = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0,
    );

    if (min && d < min) return true;
    if (max && d > max) return true;

    return false;
  };

  const prevMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 1,
    1,
  );

  const nextMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    1,
  );

  const isPrevDisabled =
    (min && prevMonth < new Date(min.getFullYear(), min.getMonth(), 1)) ||
    undefined;

  const isNextDisabled =
    (max && nextMonth > new Date(max.getFullYear(), max.getMonth(), 1)) ||
    undefined;

  const minYear = min ? min.getFullYear() : initialDate.getFullYear() - 10;

  const maxYear = max ? max.getFullYear() : initialDate.getFullYear() + 10;

  const isMonthDisabled = (monthIndex: number) => {
    const test = new Date(currentMonth.getFullYear(), monthIndex, 1);

    if (min && test < new Date(min.getFullYear(), min.getMonth(), 1))
      return true;

    if (max && test > new Date(max.getFullYear(), max.getMonth(), 1))
      return true;

    return false;
  };

  const handleSelect = (day: number) => {
    const newDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    if (isDateDisabled(newDate)) return;
    setSelectedDate(newDate);
    setCurrentMonth(newDate);
    setOpen(false);
  };

  return (
    <div className="w-full relative">
      {/* Label + Help */}
      <div className="flex justify-between items-center mb-1">
        {label && (
          <label className="text-sm font-medium text-foreground">{label}</label>
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
      {/* Input bar */}
      <button
        onClick={() => !disabled && setOpen(!open)}
        className={`
          w-full cursor-pointer rounded-md border border-input px-3 py-2 text-sm
          flex justify-between items-center
          hover:border-ring
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        style={{
          backgroundColor: secondaryBackgroundColor,
          borderColor: open ? primaryColor : "",
        }}
      >
        <span className="text-muted-foreground">
          {selectedDate ? formatDate(selectedDate) : "YYYY/MM/DD"}
        </span>

        {/* Dropdown icon */}
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
      {/* Calendar Popup */}
      {open && (
        <CalendarRenderer
          open={open}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          setCurrentMonth={setCurrentMonth}
          handleSelect={handleSelect}
          startDayOfWeek={startDayOfWeek}
          daysInMonth={daysInMonth}
          isDateDisabled={isDateDisabled}
          isMonthDisabled={isMonthDisabled}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          isPrevDisabled={isPrevDisabled}
          isNextDisabled={isNextDisabled}
          minYear={minYear}
          maxYear={maxYear}
          primaryColor={primaryColor}
          textColor={textColor}
          secondaryBackgroundColor={secondaryBackgroundColor}
        />
      )}
    </div>
  );
};

export default DatePickerRenderer;
