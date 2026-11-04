import type { FC } from "react";

interface CalendarRendererProps {
  open: boolean;
  currentMonth: Date;
  selectedDate: Date | null;
  setCurrentMonth: (date: Date) => void;
  handleSelect: (day: number) => void;
  // logic helpers
  startDayOfWeek: (date: Date) => number;
  daysInMonth: (date: Date) => number;
  isDateDisabled: (date: Date) => boolean;
  isMonthDisabled: (monthIndex: number) => boolean;
  // navigation
  prevMonth: Date;
  nextMonth: Date;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
  // ranges
  minYear: number;
  maxYear: number;
  // theme
  primaryColor?: string;
  textColor?: string;
  secondaryBackgroundColor?: string;
}

const CalendarRenderer: FC<CalendarRendererProps> = ({
  open,
  currentMonth,
  selectedDate,
  setCurrentMonth,
  handleSelect,
  startDayOfWeek,
  daysInMonth,
  isDateDisabled,
  isMonthDisabled,
  prevMonth,
  nextMonth,
  isPrevDisabled,
  isNextDisabled,
  minYear,
  maxYear,
  primaryColor,
  textColor,
  secondaryBackgroundColor,
}) => {
  if (!open) return null;

  return (
    <div className="absolute z-10 mt-2 w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
      <div style={{ backgroundColor: secondaryBackgroundColor }}>
        <div className="flex items-center justify-between px-4 py-3 text-lg font-medium">
          <button
            disabled={isPrevDisabled}
            onClick={() => !isPrevDisabled && setCurrentMonth(prevMonth)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted"
            style={{
              opacity: isPrevDisabled ? 0.5 : 1,
              cursor: isPrevDisabled ? "not-allowed" : "pointer",
            }}
          >
            ‹
          </button>

          <div className="flex gap-2">
            <select
              className="text-sm bg-transparent outline-none"
              value={currentMonth.getMonth()}
              onChange={(e) =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    Number(e.target.value),
                    1,
                  ),
                )
              }
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i} disabled={isMonthDisabled(i)}>
                  {new Date(0, i).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>

            <select
              className="text-sm bg-transparent outline-none"
              value={currentMonth.getFullYear()}
              onChange={(e) =>
                setCurrentMonth(
                  new Date(Number(e.target.value), currentMonth.getMonth(), 1),
                )
              }
            >
              {Array.from({ length: maxYear - minYear + 1 }).map((_, i) => {
                const year = minYear + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            disabled={isNextDisabled}
            onClick={() => !isNextDisabled && setCurrentMonth(nextMonth)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted"
            style={{
              opacity: isNextDisabled ? 0.5 : 1,
              cursor: isNextDisabled ? "not-allowed" : "pointer",
            }}
          >
            ›
          </button>
        </div>

        <div
          className="grid grid-cols-7 text-xs text-muted-foreground px-3 pb-2"
          style={{ color: textColor }}
        >
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center">
              {d}
            </div>
          ))}
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 gap-2 text-sm">
          {Array.from({ length: startDayOfWeek(currentMonth) }).map((_, i) => (
            <div key={i}></div>
          ))}

          {Array.from({ length: daysInMonth(currentMonth) }).map((_, i) => {
            const day = i + 1;
            const date = new Date(
              currentMonth.getFullYear(),
              currentMonth.getMonth(),
              day,
              0,
              0,
              0,
              0,
            );

            const isDisabled = isDateDisabled(date);
            const isSelected =
              selectedDate &&
              selectedDate.getDate() === day &&
              selectedDate.getMonth() === currentMonth.getMonth() &&
              selectedDate.getFullYear() === currentMonth.getFullYear();

            return (
              <button
                key={day}
                onClick={() => handleSelect(day)}
                disabled={isDisabled}
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm transition"
                style={{
                  backgroundColor: isSelected ? primaryColor : "transparent",
                  color: isDisabled
                    ? "#94a3b8"
                    : isSelected
                      ? "white"
                      : textColor || "#111",
                  border: isSelected ? "none" : "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled && !isSelected) {
                    e.currentTarget.style.border = `1px solid ${primaryColor}`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled && !isSelected) {
                    e.currentTarget.style.border = "1px solid transparent";
                  }
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarRenderer;
