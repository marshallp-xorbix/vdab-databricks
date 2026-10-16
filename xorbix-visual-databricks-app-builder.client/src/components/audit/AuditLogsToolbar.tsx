import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { userApi } from "../../providers/UserApi";
import { tenantApi } from "../../api/TenantApi";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_SEVERITIES,
  type AuditActionType,
  type AuditScope,
  type AuditSeverity,
} from "../../types/auditLog";

interface IAuditLogsToolbarProps {
  scope: AuditScope;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  actionTypes: AuditActionType[];
  onActionTypesChange: (values: AuditActionType[]) => void;
  severities: AuditSeverity[];
  onSeveritiesChange: (values: AuditSeverity[]) => void;
  /** User-id filter — applied only when scope.kind === "all". */
  userIdFilter: string | undefined;
  onUserIdFilterChange: (value: string | undefined) => void;
  /** Tenant-id filter — applied only when scope.kind === "all". */
  tenantIdFilter: string | undefined;
  onTenantIdFilterChange: (value: string | undefined) => void;
  startDate?: Date;
  endDate?: Date;
  onStartDateChange: (value: Date | undefined) => void;
  onEndDateChange: (value: Date | undefined) => void;
  /** Optional archive action — only shown on the global scope. */
  onArchiveDateRange?: (start: Date, end: Date) => void;
  onClearFilters: () => void;
}

// Radix Select / DropdownMenuRadioGroup reject empty strings as item values.
// Use a sentinel for "no filter" and convert at the boundary.
const ALL_SENTINEL = "__all__";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function summarize(selected: string[], allLabel: string): string {
  if (selected.length === 0) return allLabel;
  if (selected.length === 1) return selected[0];
  return `${selected.length} selected`;
}

function formatUserLabel(user: {
  firstName?: string;
  lastName?: string;
  email?: string | null;
}): string {
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  if (fullName && user.email) return `${fullName} (${user.email})`;
  return fullName || user.email || "Unknown user";
}

function AuditLogsToolbar({
  scope,
  searchTerm,
  onSearchChange,
  actionTypes,
  onActionTypesChange,
  severities,
  onSeveritiesChange,
  userIdFilter,
  onUserIdFilterChange,
  tenantIdFilter,
  onTenantIdFilterChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onArchiveDateRange,
  onClearFilters,
}: Readonly<IAuditLogsToolbarProps>) {
  const [localStart, setLocalStart] = useState<Date | null>(startDate ?? null);
  const [localEnd, setLocalEnd] = useState<Date | null>(endDate ?? null);

  const showGlobalFilters = scope.kind === "all";

  // Load the user/tenant option lists only when they're actually needed (global view).
  // Both endpoints require Administrator on the server, so non-admins won't see this scope.
  const usersQuery = useQuery({
    queryKey: ["users", "auditFilterList"],
    queryFn: () => userApi.getUsers(),
    enabled: showGlobalFilters,
    staleTime: 5 * 60 * 1000,
  });

  const tenantsQuery = useQuery({
    queryKey: ["tenants", "auditFilterList"],
    queryFn: () => tenantApi.getAllTenants(0, 200),
    enabled: showGlobalFilters,
    staleTime: 5 * 60 * 1000,
  });

  const sortedUsers = useMemo(() => {
    if (!usersQuery.data) return [];
    return [...usersQuery.data].sort((a, b) =>
      formatUserLabel(a).localeCompare(formatUserLabel(b)),
    );
  }, [usersQuery.data]);

  const sortedTenants = useMemo(() => {
    if (!tenantsQuery.data?.tenants) return [];
    return [...tenantsQuery.data.tenants].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [tenantsQuery.data]);

  const selectedUserLabel = useMemo(() => {
    if (!userIdFilter) return "All Users";
    const match = sortedUsers.find((u) => u.id === userIdFilter);
    return match ? formatUserLabel(match) : "Selected user";
  }, [userIdFilter, sortedUsers]);

  const selectedTenantLabel = useMemo(() => {
    if (!tenantIdFilter) return "All Tenants";
    const match = sortedTenants.find((t) => t.tenantId === tenantIdFilter);
    return match ? match.displayName : "Selected tenant";
  }, [tenantIdFilter, sortedTenants]);

  const hasActiveFilters =
    actionTypes.length > 0 ||
    severities.length > 0 ||
    localStart !== null ||
    localEnd !== null ||
    userIdFilter !== undefined ||
    tenantIdFilter !== undefined;

  const showArchive = showGlobalFilters && !!onArchiveDateRange;
  const canArchive = showArchive && localStart !== null && localEnd !== null;

  const handleClear = () => {
    setLocalStart(null);
    setLocalEnd(null);
    onClearFilters();
  };

  const handleStartChange = (next: Date | null) => {
    if (!next) {
      setLocalStart(null);
      onStartDateChange(undefined);
      return;
    }
    if (localEnd && next.getTime() > localEnd.getTime()) {
      return;
    }
    setLocalStart(next);
    onStartDateChange(next);
  };

  const handleEndChange = (next: Date | null) => {
    if (!next) {
      setLocalEnd(null);
      onEndDateChange(undefined);
      return;
    }
    if (localStart && next.getTime() < localStart.getTime()) {
      return;
    }
    setLocalEnd(next);
    onEndDateChange(next);
  };

  const handleUserFilterChange = (value: string) => {
    onUserIdFilterChange(value === ALL_SENTINEL ? undefined : value);
  };

  const handleTenantFilterChange = (value: string) => {
    onTenantIdFilterChange(value === ALL_SENTINEL ? undefined : value);
  };

  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-3">
        <span className="mr-1 text-sm font-medium text-muted-foreground">Filters:</span>

        <DatePicker
          className="w-[180px]"
          selected={localStart}
          onChange={handleStartChange}
          dateFormat="MM/dd/yyyy"
          placeholderText="Start date"
          isClearable
        />

        <DatePicker
          className="w-[180px]"
          selected={localEnd}
          onChange={handleEndChange}
          dateFormat="MM/dd/yyyy"
          placeholderText="End date"
          isClearable
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
            >
              {summarize(actionTypes, "All Actions")}
              <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            <DropdownMenuLabel className="text-xs">Action Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {AUDIT_ACTION_TYPES.map((value) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={actionTypes.includes(value)}
                onCheckedChange={() =>
                  onActionTypesChange(toggle(actionTypes, value))
                }
                onSelect={(e) => e.preventDefault()}
              >
                {value}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
            >
              {summarize(severities, "All Severities")}
              <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[180px]">
            <DropdownMenuLabel className="text-xs">Severity</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {AUDIT_SEVERITIES.map((value) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={severities.includes(value)}
                onCheckedChange={() =>
                  onSeveritiesChange(toggle(severities, value))
                }
                onSelect={(e) => e.preventDefault()}
              >
                {value}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {showGlobalFilters && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 max-w-[220px] rounded-full text-xs"
              >
                <span className="truncate">{selectedUserLabel}</span>
                <ChevronDown className="ml-1.5 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[320px] w-[260px] overflow-y-auto">
              <DropdownMenuLabel className="text-xs">User</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {usersQuery.isLoading && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Loading users...
                </div>
              )}
              {usersQuery.isError && (
                <div className="px-2 py-1.5 text-xs text-destructive">
                  Failed to load users
                </div>
              )}
              {!usersQuery.isLoading && !usersQuery.isError && (
                <DropdownMenuRadioGroup
                  value={userIdFilter ?? ALL_SENTINEL}
                  onValueChange={handleUserFilterChange}
                >
                  <DropdownMenuRadioItem value={ALL_SENTINEL}>
                    All Users
                  </DropdownMenuRadioItem>
                  {sortedUsers.map((user) => (
                    <DropdownMenuRadioItem key={user.id} value={user.id}>
                      <span className="truncate">{formatUserLabel(user)}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {showGlobalFilters && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 max-w-[220px] rounded-full text-xs"
              >
                <span className="truncate">{selectedTenantLabel}</span>
                <ChevronDown className="ml-1.5 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[320px] w-[260px] overflow-y-auto">
              <DropdownMenuLabel className="text-xs">Tenant</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tenantsQuery.isLoading && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Loading tenants...
                </div>
              )}
              {tenantsQuery.isError && (
                <div className="px-2 py-1.5 text-xs text-destructive">
                  Failed to load tenants
                </div>
              )}
              {!tenantsQuery.isLoading && !tenantsQuery.isError && (
                <DropdownMenuRadioGroup
                  value={tenantIdFilter ?? ALL_SENTINEL}
                  onValueChange={handleTenantFilterChange}
                >
                  <DropdownMenuRadioItem value={ALL_SENTINEL}>
                    All Tenants
                  </DropdownMenuRadioItem>
                  {sortedTenants.map((tenant) => (
                    <DropdownMenuRadioItem
                      key={tenant.tenantId}
                      value={tenant.tenantId}
                    >
                      <span className="truncate">{tenant.displayName}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Clear All
            <X className="h-3 w-3" />
          </button>
        )}

        {canArchive && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() =>
              localStart && localEnd && onArchiveDateRange?.(localStart, localEnd)
            }
          >
            Archive in range
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search description, action, user..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
    </div>
  );
}

export default AuditLogsToolbar;
