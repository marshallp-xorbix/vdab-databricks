import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  SortingState,
  ColumnFiltersState,
  PaginationState,
} from "@tanstack/react-table";
import type { ColumnFilterType } from "../components/ui/data-table";

type Updater<T> = T | ((old: T) => T);

function resolveUpdater<T>(updater: Updater<T>, old: T): T {
  return typeof updater === "function"
    ? (updater as (old: T) => T)(old)
    : updater;
}

// ── URL encoding helpers ────────────────────────────────────────────────

function encodeColumnFilterValue(
  value: unknown,
  filterType: ColumnFilterType,
): string {
  switch (filterType) {
    case "text":
      return typeof value === "string" ? value : "";
    case "select":
      return (value as string[]).join("|");
    case "date":
    case "number": {
      const [a, b] = value as [
        string | number | undefined,
        string | number | undefined,
      ];
      return `${a ?? ""}~${b ?? ""}`;
    }
  }
}

function decodeColumnFilterValue(
  encoded: string,
  filterType: ColumnFilterType,
): unknown {
  switch (filterType) {
    case "text":
      return encoded;
    case "select":
      return encoded.split("|").filter(Boolean);
    case "date": {
      const [a, b] = encoded.split("~");
      return [a || undefined, b || undefined];
    }
    case "number": {
      const [a, b] = encoded.split("~");
      return [a ? Number(a) : undefined, b ? Number(b) : undefined];
    }
    default:
      return encoded;
  }
}

// ── Hook ────────────────────────────────────────────────────────────────

interface UseTableSearchParamsOptions {
  defaultSort?: SortingState;
  defaultPageSize?: number;
  columnFilterTypes?: Record<string, ColumnFilterType>;
}

type ListParamUpdates = Record<string, string[]>;

export function useTableSearchParams(
  options: UseTableSearchParamsOptions = {},
) {
  const {
    defaultSort = [],
    defaultPageSize = 10,
    columnFilterTypes = {},
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  // ── Read state from URL ───────────────────────────────────────────────

  const globalFilter: string = searchParams.get("q") ?? "";

  const sorting: SortingState = useMemo(() => {
    const sortParam = searchParams.get("sort");
    if (!sortParam) return defaultSort;
    const lastDot = sortParam.lastIndexOf(".");
    if (lastDot < 1) return defaultSort;
    const id = sortParam.slice(0, lastDot);
    const dir = sortParam.slice(lastDot + 1);
    if (dir !== "asc" && dir !== "desc") return defaultSort;
    return [{ id, desc: dir === "desc" }];
  }, [searchParams, defaultSort]);

  const pagination: PaginationState = useMemo(() => {
    const page = searchParams.get("page");
    const size = searchParams.get("pageSize");
    return {
      pageIndex: page ? Math.max(0, Number(page) - 1) : 0,
      pageSize: size ? Number(size) : defaultPageSize,
    };
  }, [searchParams, defaultPageSize]);

  const columnFilters: ColumnFiltersState = useMemo(() => {
    const filters: ColumnFiltersState = [];
    for (const [key, value] of searchParams.entries()) {
      if (!key.startsWith("cf.")) continue;
      const columnId = key.slice(3);
      const filterType = columnFilterTypes[columnId] ?? "text";
      filters.push({
        id: columnId,
        value: decodeColumnFilterValue(value, filterType),
      });
    }
    return filters;
  }, [searchParams, columnFilterTypes]);

  // ── Param updater (replace mode to avoid polluting history) ───────────

  const updateParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          updater(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // ── Setters ───────────────────────────────────────────────────────────

  const onGlobalFilterChange = useCallback(
    (value: string) => {
      updateParams((params) => {
        if (value) {
          params.set("q", value);
        } else {
          params.delete("q");
        }
        params.delete("page");
      });
    },
    [updateParams],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      updateParams((params) => {
        const next = resolveUpdater(updater, sorting);
        if (next.length > 0) {
          const { id, desc } = next[0];
          params.set("sort", `${id}.${desc ? "desc" : "asc"}`);
        } else {
          params.delete("sort");
        }
        params.delete("page");
      });
    },
    [updateParams, sorting],
  );

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      updateParams((params) => {
        const next = resolveUpdater(updater, pagination);
        if (next.pageIndex > 0) {
          params.set("page", String(next.pageIndex + 1));
        } else {
          params.delete("page");
        }
        if (next.pageSize === defaultPageSize) {
          params.delete("pageSize");
        } else {
          params.set("pageSize", String(next.pageSize));
        }
      });
    },
    [updateParams, pagination, defaultPageSize],
  );

  const onColumnFiltersChange = useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      updateParams((params) => {
        const next = resolveUpdater(updater, columnFilters);
        for (const key of Array.from(params.keys())) {
          if (key.startsWith("cf.")) {
            params.delete(key);
          }
        }
        for (const filter of next) {
          if (filter.value == null) continue;
          const filterType = columnFilterTypes[filter.id] ?? "text";
          const encoded = encodeColumnFilterValue(filter.value, filterType);
          if (encoded) {
            params.set(`cf.${filter.id}`, encoded);
          }
        }
        params.delete("page");
      });
    },
    [updateParams, columnFilters, columnFilterTypes],
  );

  // ── Generic list-param helpers (for toolbar filters like roles/status) ─

  const getListParam = useCallback(
    (key: string): string[] => {
      const value = searchParams.get(key);
      if (!value) return [];
      return value.split(",").filter(Boolean);
    },
    [searchParams],
  );

  const setListParam = useCallback(
    (key: string, values: string[]) => {
      updateParams((params) => {
        if (values.length > 0) {
          params.set(key, values.join(","));
        } else {
          params.delete(key);
        }
        params.delete("page");
      });
    },
    [updateParams],
  );

  const setListParams = useCallback(
    (updates: ListParamUpdates) => {
      updateParams((params) => {
        for (const [key, values] of Object.entries(updates)) {
          if (values.length > 0) {
            params.set(key, values.join(","));
          } else {
            params.delete(key);
          }
        }
        params.delete("page");
      });
    },
    [updateParams],
  );

  return {
    globalFilter,
    sorting,
    pagination,
    columnFilters,
    onGlobalFilterChange,
    onSortingChange,
    onPaginationChange,
    onColumnFiltersChange,
    getListParam,
    setListParam,
    setListParams,
  };
}
