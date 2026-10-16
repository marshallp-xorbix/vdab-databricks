import { useInfiniteQuery } from "@tanstack/react-query";
import { auditApi } from "../api/AuditApi";
import { AuditLogDto, type IPaginatedAuditLogsResponse } from "../models/AuditLog";
import type {
  AuditLogFilters,
  AuditScope,
} from "../types/auditLog";

export const auditLogKeys = {
  all: ["auditLogs"] as const,
  paged: (scope: AuditScope, filters: AuditLogFilters, take: number) =>
    [
      "auditLogs",
      "paged",
      scope,
      {
        userId: filters.userId ?? null,
        tenantId: filters.tenantId ?? null,
        actionTypes: filters.actionTypes ?? [],
        severities: filters.severities ?? [],
        startDate: filters.startDate?.toISOString() ?? null,
        endDate: filters.endDate?.toISOString() ?? null,
      },
      take,
    ] as const,
};

interface UseAuditLogsQueryOptions {
  scope: AuditScope;
  filters?: AuditLogFilters;
  /** Page size requested from the server. Defaults to 10 to match table UX. */
  take?: number;
  /** When false, the query is parked and will not execute. Defaults to true. */
  enabled?: boolean;
}

interface AuditLogPage extends IPaginatedAuditLogsResponse {
  /** Items wrapped as model instances so dates are parsed once. */
  parsedItems: AuditLogDto[];
}

/**
 * Cursor-paginated audit log query backed by TanStack Query's `useInfiniteQuery`.
 * Fits the server's `{ items, nextCursor }` shape directly — no offset math, stable
 * under insert pressure, and naturally drives "Load more" / Next-Prev UIs.
 *
 * Filter changes invalidate the query (the cursor space is scoped to a filter set),
 * so the client just changes inputs and TanStack Query starts a new chain.
 */
export function useAuditLogsQuery({
  scope,
  filters = {},
  take = 10,
  enabled = true,
}: UseAuditLogsQueryOptions) {
  return useInfiniteQuery<
    AuditLogPage,
    Error,
    { pages: AuditLogPage[]; pageParams: (string | null)[] },
    readonly unknown[],
    string | null
  >({
    queryKey: auditLogKeys.paged(scope, filters, take),
    enabled,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const response = await auditApi.queryAuditLogs({
        scope,
        userId: filters.userId,
        tenantId: filters.tenantId,
        actionTypes: filters.actionTypes,
        severities: filters.severities,
        startDate: filters.startDate,
        endDate: filters.endDate,
        cursor: pageParam,
        take,
      });
      return {
        ...response,
        parsedItems: response.items.map((item) => new AuditLogDto(item)),
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Audit data should feel reasonably fresh on revisit but doesn't need to be live.
    staleTime: 30 * 1000,
  });
}

interface UseRecentAuditActivityOptions {
  scope: AuditScope;
  filters?: AuditLogFilters;
  /** How many recent entries to show. Defaults to 5. */
  take?: number;
  enabled?: boolean;
}

/**
 * Compact variant for "Recent Activity" callouts (dashboards, Security Events card).
 * Wraps `useAuditLogsQuery` but only exposes the first page so consumers don't have
 * to think about pagination.
 */
export function useRecentAuditActivity({
  scope,
  filters = {},
  take = 5,
  enabled = true,
}: UseRecentAuditActivityOptions) {
  const query = useAuditLogsQuery({ scope, filters, take, enabled });
  const firstPage = query.data?.pages[0];
  return {
    items: firstPage?.parsedItems ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
