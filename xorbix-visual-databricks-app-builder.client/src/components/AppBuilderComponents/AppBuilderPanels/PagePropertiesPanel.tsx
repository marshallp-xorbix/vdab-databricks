import {
  useEffect,
  useState,
  type ChangeEvent,
  type FC,
  type KeyboardEvent,
} from "react";
import {
  PAGE_WIDTH_DEFAULT,
  PAGE_WIDTH_MAX,
  PAGE_WIDTH_MIN,
  clampPageWidth,
} from "../../../utils/pageWidthDefaults";

interface IPagePropertiesPanelProps {
  pageWidth: number;
  onPageWidthChange: (pageWidth: number) => void;
}

const PagePropertiesPanel: FC<Readonly<IPagePropertiesPanelProps>> = ({
  pageWidth,
  onPageWidthChange,
}) => {
  const [draftValue, setDraftValue] = useState(() => String(pageWidth));

  useEffect(() => {
    setDraftValue(String(pageWidth));
  }, [pageWidth]);

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextWidth = clampPageWidth(Number(event.target.value));
    setDraftValue(String(nextWidth));
    onPageWidthChange(nextWidth);
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Track keystrokes locally; clamp + commit on blur so the pageWidth -> useEffect
    // -> draftValue sync cannot overwrite an in-progress edit.
    setDraftValue(event.target.value);
  };

  const handleNumberBlur = () => {
    const parsedValue = Number(draftValue);
    const nextWidth = Number.isFinite(parsedValue)
      ? clampPageWidth(parsedValue)
      : PAGE_WIDTH_DEFAULT;
    setDraftValue(String(nextWidth));
    if (nextWidth !== pageWidth) {
      onPageWidthChange(nextWidth);
    }
  };

  const handleNumberKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleNumberBlur();
    }
  };

  return (
    <div className="mx-2 mb-2 space-y-2">
      <div className="rounded-lg border border-[var(--builder-chrome-border)] bg-[var(--builder-panel-bg)] px-1 py-2 text-[var(--builder-panel-foreground)] shadow-sm">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Layout
          </span>
          <div className="h-px flex-1 bg-muted" />
        </div>

        <div className="space-y-2 px-3 pb-3" data-property-nested-fields>
          <div>
            <label
              htmlFor="page-width-slider"
              className="mb-0.5 block text-xs font-medium text-muted-foreground"
            >
              Page Width
            </label>
            <div className="flex items-center gap-2">
              <input
                id="page-width-slider"
                type="range"
                min={PAGE_WIDTH_MIN}
                max={PAGE_WIDTH_MAX}
                step={10}
                value={pageWidth}
                onChange={handleSliderChange}
                className="h-2 w-full cursor-pointer accent-primary"
                aria-valuemin={PAGE_WIDTH_MIN}
                aria-valuemax={PAGE_WIDTH_MAX}
                aria-valuenow={pageWidth}
                aria-label="Page width in pixels"
              />
              <input
                id="page-width-input"
                type="number"
                min={PAGE_WIDTH_MIN}
                max={PAGE_WIDTH_MAX}
                step={10}
                value={draftValue}
                onChange={handleNumberChange}
                onBlur={handleNumberBlur}
                onKeyDown={handleNumberKeyDown}
                className="w-20 shrink-0 rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Page width value"
              />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Content width for the canvas and deployed Streamlit page (
              {PAGE_WIDTH_MIN}–{PAGE_WIDTH_MAX} px).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagePropertiesPanel;
