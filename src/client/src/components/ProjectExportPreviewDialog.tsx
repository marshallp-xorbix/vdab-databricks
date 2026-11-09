import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface IProjectExportPreviewDialogProps {
  open: boolean;
  title: string;
  filename: string;
  payload: unknown;
  onClose: () => void;
  onDownload: () => void;
}

/** Lets the user preview and copy export JSON before downloading. */
function ProjectExportPreviewDialog({
  open,
  title,
  filename,
  payload,
  onClose,
  onDownload,
}: Readonly<IProjectExportPreviewDialogProps>) {
  const [copied, setCopied] = useState(false);
  const preview = JSON.stringify(payload, null, 2);

  async function copyPreview(): Promise<void> {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Review the export JSON for {filename}. Workspace resources must be
            selected again after import.
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-[50vh] overflow-auto rounded-md border border-border bg-muted p-3 text-xs">
          {preview}
        </pre>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => void copyPreview()}>
            {copied ? "Copied" : "Copy JSON"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onDownload}>
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectExportPreviewDialog;
