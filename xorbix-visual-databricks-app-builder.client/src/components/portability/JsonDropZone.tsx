import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FileUp } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { cn } from "../../lib/utils";

interface IJsonDropZoneProps {
  /** Current JSON text value. */
  value: string;
  /** Called whenever the text changes (via paste, typing, or file drop). */
  onChange: (value: string) => void;
  /** Optional placeholder for the textarea. */
  placeholder?: string;
  /** Optional callback invoked when a dropped file is rejected. */
  onReject?: (message: string) => void;
}

/**
 * A combined file drop zone and paste area for importing JSON. Dropping or
 * selecting a `.json` file loads its contents into the textarea, which the user
 * can also paste into or edit directly.
 */
export default function JsonDropZone({
  value,
  onChange,
  placeholder,
  onReject,
}: Readonly<IJsonDropZoneProps>) {
  const onDropAccepted = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (file) {
        onChange(await file.text());
      }
    },
    [onChange],
  );

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      const message =
        rejections[0]?.errors[0]?.message ?? "That file could not be read.";
      onReject?.(message);
    },
    [onReject],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/json": [".json"] },
    multiple: false,
    onDropAccepted,
    onDropRejected,
  });

  return (
    <div className="min-w-0 space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors",
          isDragActive
            ? "border-primary bg-primary/5 text-primary"
            : "border-border text-muted-foreground hover:border-primary/50",
        )}
      >
        <input {...getInputProps()} />
        <FileUp className="h-6 w-6" />
        <span>
          Drop a <span className="font-medium">.json</span> file here, or click
          to browse
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "…or paste exported JSON here"}
        className="field-sizing-fixed h-32 min-w-0 w-full resize-y overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs"
      />
    </div>
  );
}
