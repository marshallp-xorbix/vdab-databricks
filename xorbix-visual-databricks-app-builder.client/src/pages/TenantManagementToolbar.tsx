import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";

export type TenantStatusFilter = "active" | "inactive";

interface ITenantManagementToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilters: TenantStatusFilter[];
  onStatusFiltersChange: (values: TenantStatusFilter[]) => void;
  subscriptionTierFilters: string[];
  onSubscriptionTierFiltersChange: (values: string[]) => void;
  availableSubscriptionTiers: string[];
  onClearFilters?: () => void;
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
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

const TenantManagementToolbar = ({
  searchTerm,
  onSearchChange,
  statusFilters,
  onStatusFiltersChange,
  subscriptionTierFilters,
  onSubscriptionTierFiltersChange,
  availableSubscriptionTiers,
  onClearFilters,
}: Readonly<ITenantManagementToolbarProps>) => {
  const hasActiveFilters =
    statusFilters.length > 0 || subscriptionTierFilters.length > 0;

  const statusLabelMap: Record<string, string> = Object.fromEntries(
    STATUS_OPTIONS.map((option) => [option.value, option.label]),
  );

  const clearFilters = () => {
    if (onClearFilters) {
      onClearFilters();
      return;
    }

    onStatusFiltersChange([]);
    onSubscriptionTierFiltersChange([]);
  };

  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-3">
        <span className="mr-1 text-sm font-medium text-muted-foreground">
          Filters:
        </span>

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
            {STATUS_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={statusFilters.includes(option.value)}
                onCheckedChange={() =>
                  onStatusFiltersChange(
                    toggleValue(statusFilters, option.value),
                  )
                }
                onSelect={(event) => event.preventDefault()}
              >
                {option.label}
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
              {formatSelectedLabel(subscriptionTierFilters, "All Tiers")}
              <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <DropdownMenuLabel className="text-xs">
              Subscription Tier
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableSubscriptionTiers.map((tier) => (
              <DropdownMenuCheckboxItem
                key={tier}
                checked={subscriptionTierFilters.includes(tier)}
                onCheckedChange={() =>
                  onSubscriptionTierFiltersChange(
                    toggleValue(subscriptionTierFilters, tier),
                  )
                }
                onSelect={(event) => event.preventDefault()}
              >
                {tier}
              </DropdownMenuCheckboxItem>
            ))}
            {availableSubscriptionTiers.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No tiers found
              </div>
            )}
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
            {subscriptionTierFilters.map((tier) => (
              <button
                key={`tier-${tier}`}
                type="button"
                onClick={() =>
                  onSubscriptionTierFiltersChange(
                    subscriptionTierFilters.filter((value) => value !== tier),
                  )
                }
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
              >
                {tier}
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
            placeholder="Search by tenant name..."
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>
    </div>
  );
};

export default TenantManagementToolbar;
