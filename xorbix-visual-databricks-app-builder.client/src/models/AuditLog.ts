import { parseApiDate } from "../lib/utils";

/**
 * Wire shape for a single audit log entry as returned by `GET /api/Audit/logs`.
 * Includes joined user + tenant display fields so callers don't need follow-up requests.
 */
export interface IAuditLogDto {
  auditLogId: number;
  tenantId?: string | null;
  tenantDisplayName?: string | null;
  userId?: string | null;
  userFullName?: string | null;
  userEmail?: string | null;
  isArchived: boolean;
  actionType: string;
  entityType?: string | null;
  entityId?: string | null;
  description: string;
  metadata?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity: string;
  timestamp: string | Date;
}

/**
 * Class wrapper that parses `timestamp` into a Date object on construction.
 * Use this when displaying audit log rows; the raw interface is the wire contract.
 */
export class AuditLogDto implements IAuditLogDto {
  auditLogId: number = 0;
  tenantId?: string | null;
  tenantDisplayName?: string | null;
  userId?: string | null;
  userFullName?: string | null;
  userEmail?: string | null;
  isArchived: boolean = false;
  actionType: string = "";
  entityType?: string | null;
  entityId?: string | null;
  description: string = "";
  metadata?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity: string = "Info";
  timestamp: Date = new Date();

  constructor(init?: Partial<IAuditLogDto>) {
    if (init) {
      Object.assign(this, init);
      if (init.timestamp) {
        this.timestamp = parseApiDate(init.timestamp);
      }
    }
  }
}

/**
 * Cursor-paginated response envelope.
 * `nextCursor` is an opaque, URL-safe token; pass it back as-is to advance.
 */
export interface IPaginatedAuditLogsResponse {
  items: IAuditLogDto[];
  nextCursor: string | null;
  take: number;
}
