import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { downloadTextFile } from "../../utils/fileDownload";

interface IExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The JSON text to display and export. */
  json: string;
  /** Suggested download file name (including extension). */
  fileName: string;
}

/**
 * Read-only dialog that displays exported JSON in a code block with copy-to-clipboard
 * and save-as-file actions.
 */
export default function ExportDialog({
  open,
  onOpenChange,
  title,
  description,
  json,
  fileName,
}: Readonly<IExportDialogProps>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    downloadTextFile(fileName, json);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card p-6 rounded-xl shadow-xl sm:max-w-4xl w-full border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <pre className="max-h-[55vh] min-w-0 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-muted p-4 text-xs leading-relaxed text-foreground">
          <code>{json}</code>
        </pre>

        <DialogFooter className="flex justify-end gap-3 mt-2">
          <Button variant="outline" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </>
            )}
          </Button>
          <Button
            onClick={handleDownload}
            className="rounded-lg shadow-md hover:opacity-90"
          >
            <Download className="mr-2 h-4 w-4" /> Save as file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
