import { useEffect, useRef, useState, type FC } from "react";
import { Label } from "../ui/label";
import {
  PROPERTY_HINT_CLASS,
  PROPERTY_INLINE_LABEL_CLASS,
} from "./propertyEditorStyles";

interface SeriesColorPropertyEditorProps {
  value: string | undefined;
  onChange: (next: string) => void;
  label?: string;
  hint?: string;
}

const DEFAULT_COLOR = "#1f77b4";
const COMMIT_DELAY_MS = 120;

export const SeriesColorPropertyEditor: FC<SeriesColorPropertyEditorProps> = ({
  value,
  onChange,
  label = "Series color",
  hint,
}) => {
  const normalizedValue = value || DEFAULT_COLOR;
  const [draftColor, setDraftColor] = useState<string>(normalizedValue);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftColor(normalizedValue);
  }, [normalizedValue]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) {
        clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  const commitColor = (nextColor: string) => {
    if (nextColor !== normalizedValue) {
      onChange(nextColor);
    }
  };

  const scheduleCommit = (nextColor: string) => {
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = setTimeout(() => {
      commitColor(nextColor);
      commitTimerRef.current = null;
    }, COMMIT_DELAY_MS);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <Label className={PROPERTY_INLINE_LABEL_CLASS}>{label}</Label>
        <input
          type="color"
          value={draftColor}
          aria-label={label}
          onChange={(e) => {
            const nextColor = e.target.value;
            setDraftColor(nextColor);
            scheduleCommit(nextColor);
          }}
          onBlur={() => commitColor(draftColor)}
          className="h-8 w-8 cursor-pointer rounded border border-border p-0"
        />
      </div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
};
