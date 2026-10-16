import { ChevronDown, Search, X } from "lucide-react";
import { Input } from "../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Button } from "../components/ui/button";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended in this workspace" },
  { value: "unconfirmed", label: "Unconfirmed" },
  { value: "removed", label: "Removed & deleted" },
] as const;

const USER_AUDIENCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "customers", label: "Customers" },
  { value: "admins", label: "Admins" },
] as const;

export type UserStatusFilter =
  | "active"
  | "inactive"
  | "suspended"
  | "unconfirmed"
  | "removed";
export type UserAudienceFilter = "all" | "customers" | "admins";

interface Props {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  roleFilters: string[];
  onRoleFiltersChange: (values: string[]) => void;
  statusFilters: UserStatusFilter[];
  onStatusFiltersChange: (values: UserStatusFilter[]) => void;
  userAudienceFilter: UserAudienceFilter;
  onUserAudienceFilterChange: (value: UserAudienceFilter) => void;
  availableRoles: string[];
  onClearFilters?: () => void;
  /** When true, shows the Removed & deleted status filter (global admin only). */
  showRemovedFilter?: boolean;
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function formatSelectedLabel(
  selected: string[],
  allLabel: string,
  labels?: Record<string, string>,
): string {
  if (selected.length === 0) return allLabel;
  if (selected.length === 1) return labels?.[selected[0]] ?? selected[0];
  return `${selected.length} selected`;
}

export function UserManagementToolbar({
  searchTerm,
  onSearchChange,
  roleFilters,
  onRoleFiltersChange,
  statusFilters,
  onStatusFiltersChange,
  userAudienceFilter,
  onUserAudienceFilterChange,
  availableRoles,
  onClearFilters,
  showRemovedFilter = false,
}: Readonly<Props>) {
  const hasActiveFilters =
    userAudienceFilter !== "all" ||
    roleFilters.length > 0 ||
    statusFilters.length > 0;

  const clearFilters = () => {
    if (onClearFilters) {
      onClearFilters();
      return;
    }

    onUserAudienceFilterChange("all");
    onRoleFiltersChange([]);
    onStatusFiltersChange([]);
  };

  const visibleStatusOptions = showRemovedFilter
    ? STATUS_OPTIONS
    : STATUS_OPTIONS.filter((opt) => opt.value !== "removed");

  const statusLabelMap: Record<string, string> = Object.fromEntries(
    visibleStatusOptions.map((o) => [o.value, o.label]),
  );

  return (
    <div
      id="user-filters"
      className="mb-4 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="mr-1 text-sm font-medium text-muted-foreground">
          Filters:
        </span>

        <div className="inline-flex rounded-full border border-border bg-muted p-0.5">
          {USER_AUDIENCE_OPTIONS.map((option) => {
            const selected = userAudienceFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onUserAudienceFilterChange(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
            >
              {formatSelectedLabel(roleFilters, "All Roles")}
              <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[180px]">
            <DropdownMenuLabel className="text-xs">Roles</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableRoles.map((role) => (
              <DropdownMenuCheckboxItem
                key={role}
                checked={roleFilters.includes(role)}
                onCheckedChange={() =>
                  onRoleFiltersChange(toggleValue(roleFilters, role))
                }
                onSelect={(e) => e.preventDefault()}
              >
                {role}
              </DropdownMenuCheckboxItem>
            ))}
            {availableRoles.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No roles found
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
            >
              {formatSelectedLabel(
                statusFilters,
                "All Statuses",
                statusLabelMap,
              )}
              <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[180px]">
            <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleStatusOptions.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={statusFilters.includes(opt.value)}
                onCheckedChange={() =>
                  onStatusFiltersChange(toggleValue(statusFilters, opt.value))
                }
                onSelect={(e) => e.preventDefault()}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Clear All
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 sm:contents">
          <div className="flex flex-wrap items-center gap-1.5">
            {userAudienceFilter !== "all" && (
              <button
                key="audience-filter"
                type="button"
                onClick={() => onUserAudienceFilterChange("all")}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800 transition-colors hover:bg-indigo-200"
              >
                {USER_AUDIENCE_OPTIONS.find(
                  (option) => option.value === userAudienceFilter,
                )?.label ?? userAudienceFilter}
                <X className="h-3 w-3" />
              </button>
            )}
            {roleFilters.map((role) => (
              <button
                key={`role-${role}`}
                type="button"
                onClick={() =>
                  onRoleFiltersChange(roleFilters.filter((r) => r !== role))
                }
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
              >
                {role}
                <X className="h-3 w-3" />
              </button>
            ))}
            {statusFilters.map((status) => (
              <button
                key={`status-${status}`}
                type="button"
                onClick={() =>
                  onStatusFiltersChange(
                    statusFilters.filter((s) => s !== status),
                  )
                }
                className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2.5 py-1 text-xs font-medium text-success-foreground transition-colors hover:bg-success-subtle"
              >
                {statusLabelMap[status] ?? status}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
    </div>
  );
}
