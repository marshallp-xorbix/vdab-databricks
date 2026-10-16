import { BaseApi } from "../providers/BaseApi";
import type { IPaginatedAuditLogsResponse } from "../models/AuditLog";
import type {
  AuditActionType,
  AuditScope,
  AuditSeverity,
} from "../types/auditLog";

/**
 * Parameters for `auditApi.queryAuditLogs`. Combine the page's scope, optional
 * filters, the opaque cursor from the previous page, and the page size.
 */
export interface IAuditLogsQueryParams {
  scope: AuditScope;
  /**
   * Narrow to a specific user. Honored only when `scope.kind === "all"`. When
   * `scope.kind === "user"`, the scope's `userId` always wins.
   */
  userId?: string;
  /**
   * Narrow to a specific tenant. Honored only when `scope.kind === "all"`. When
   * `scope.kind === "tenant"`, the scope's `tenantId` always wins.
   */
  tenantId?: string;
  actionTypes?: AuditActionType[];
  severities?: AuditSeverity[];
  startDate?: Date;
  endDate?: Date;
  includeArchived?: boolean;
  /** Opaque next-page cursor from a previous response. Omit for the first page. */
  cursor?: string | null;
  /** Page size. Server clamps to 1..200; defaults to 25 when omitted. */
  take?: number;
}

export class AuditApi extends BaseApi {
  /**
   * Cursor-paginated audit log query. Pass `cursor` from the previous response's
   * `nextCursor` to advance; omit for the first page. Filters mutate the cursor
   * space, so changing filters means starting from no cursor.
   */
  async queryAuditLogs(
    params: IAuditLogsQueryParams,
  ): Promise<IPaginatedAuditLogsResponse> {
    const search = new URLSearchParams();

    switch (params.scope.kind) {
      case "user":
        search.set("userId", params.scope.userId);
        if (params.scope.tenantId) {
          search.set("tenantId", params.scope.tenantId);
        }
        break;
      case "tenant":
        search.set("tenantId", params.scope.tenantId);
        break;
      case "all":
        if (params.userId) search.set("userId", params.userId);
        if (params.tenantId) search.set("tenantId", params.tenantId);
        break;
    }

    for (const actionType of params.actionTypes ?? []) {
      search.append("actionTypes", actionType);
    }

    for (const severity of params.severities ?? []) {
      search.append("severities", severity);
    }

    if (params.startDate) {
      search.set("startDate", params.startDate.toISOString());
    }

    if (params.endDate) {
      search.set("endDate", params.endDate.toISOString());
    }

    if (params.includeArchived) {
      search.set("includeArchived", "true");
    }

    if (params.cursor) {
      search.set("cursor", params.cursor);
    }

    if (params.take !== undefined) {
      search.set("take", params.take.toString());
    }

    const query = search.toString();
    const path = query ? `/api/Audit/logs?${query}` : "/api/Audit/logs";
    return this.get<IPaginatedAuditLogsResponse>(path);
  }

  /**
   * Streams the audit log export to a Blob. The server currently honors `fileType`
   * and ignores the legacy skip/take pair; we pass them only to match the existing
   * route shape until the export endpoint is migrated to the new query.
   */
  async exportAuditLogs(fileType: "csv" | "json"): Promise<Blob> {
    const search = new URLSearchParams({ fileType });
    const path = `/api/Audit/logs/export?${search.toString()}`;
    return this.get<Blob>(path);
  }

  /**
   * Archives audit logs in the supplied date range for the given tenant.
   * Tenant id must be supplied — the server requires it for tenant scoping.
   */
  async archiveAuditLogs(
    tenantId: string,
    start: string,
    end: string,
  ): Promise<void> {
    const search = new URLSearchParams({ tenantId, start, end });
    await this.post<void>(`/api/Audit/archive?${search.toString()}`);
  }
}

export const auditApi = new AuditApi();
