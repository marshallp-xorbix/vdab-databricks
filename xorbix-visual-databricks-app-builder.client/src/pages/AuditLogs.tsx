import { useCallback } from "react";
import { Download } from "lucide-react";
import AuditLogsGrid from "../components/audit/AuditLogsGrid";
import { ManagementPageHeader } from "../components/ManagementPageHeader";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { toast } from "../components/ui/use-toast";
import { auditApi } from "../api/AuditApi";
import { useLogger } from "../logger/useLogger";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AuditLogs() {
  const logger = useLogger("AuditLogs");

  const handleExport = useCallback(
    async (fileType: "csv" | "json") => {
      try {
        const blob = await auditApi.exportAuditLogs(fileType);
        triggerBlobDownload(blob, `audit-logs.${fileType}`);
      } catch (err) {
        logger.UI.error("Failed to export audit logs", err);
        toast({
          title: "Failed to export audit logs",
          description:
            err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      }
    },
    [logger],
  );

  return (
    <section className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <ManagementPageHeader
          title="Audit Logs"
          description="View, filter, and export audit logs across the platform."
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full text-xs"
                >
                  Export
                  <Download className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[180px]">
                <DropdownMenuLabel className="text-xs">Export</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  onSelect={() => void handleExport("csv")}
                >
                  CSV
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  onSelect={() => void handleExport("json")}
                >
                  JSON
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <AuditLogsGrid scope={{ kind: "all" }} />
      </div>
    </section>
  );
}

export default AuditLogs;
