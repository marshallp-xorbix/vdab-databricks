import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

import type { Tenant } from "../../models";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface ITenantPickerComboboxProps {
  id?: string;
  options: Tenant[];
  value: string;
  onChange: (tenantId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

/**
 * Formats a tenant option as "<display name> - <id>" so admins can tell
 * similarly named tenants apart.
 */
export function formatTenantPickerLabel(tenant: Tenant): string {
  const name = tenant.displayName || tenant.tenantName || "Unnamed tenant";
  return `${name} - ${tenant.tenantId}`;
}

function filterTenants(tenants: Tenant[], query: string): Tenant[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return tenants;
  }

  return tenants.filter((tenant) => {
    const displayName = (tenant.displayName || "").toLowerCase();
    const tenantName = (tenant.tenantName || "").toLowerCase();
    const tenantId = (tenant.tenantId || "").toLowerCase();
    return (
      displayName.includes(normalized) ||
      tenantName.includes(normalized) ||
      tenantId.includes(normalized)
    );
  });
}

/**
 * Searchable tenant picker used on the global-admin "Add to account" surface.
 * Matches by display name, tenant name, or tenant id.
 */
function TenantPickerCombobox({
  id,
  options,
  value,
  onChange,
  placeholder = "Select a tenant",
  disabled = false,
  emptyMessage = "No available tenants",
}: Readonly<ITenantPickerComboboxProps>) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedTenant = useMemo(
    () => options.find((tenant) => tenant.tenantId === value),
    [options, value],
  );

  const triggerLabel = selectedTenant
    ? formatTenantPickerLabel(selectedTenant)
    : options.length === 0
      ? emptyMessage
      : placeholder;

  const showPlaceholderStyle = !selectedTenant;

  const filteredOptions = useMemo(
    () => filterTenants(options, filter),
    [options, filter],
  );

  const selectableCount = filteredOptions.length;

  const getOptionId = (index: number) => `${listboxId}-option-${index}`;

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setFilter("");
    setHighlightedIndex(0);
  };

  const selectByIndex = (index: number) => {
    const option = filteredOptions[index];
    if (!option) {
      return;
    }
    selectValue(option.tenantId);
  };

  const moveHighlight = (delta: number) => {
    if (selectableCount === 0) {
      return;
    }
    setHighlightedIndex((current) => {
      return (current + delta + selectableCount) % selectableCount;
    });
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (selectableCount === 0) {
        return;
      }
      const indexToSelect =
        highlightedIndex >= 0 && highlightedIndex < selectableCount
          ? highlightedIndex
          : 0;
      selectByIndex(indexToSelect);
    }
  };

  const handleFilterChange = (nextFilter: string) => {
    setFilter(nextFilter);
    setHighlightedIndex(0);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const optionElement = document.getElementById(
      getOptionId(highlightedIndex),
    );
    optionElement?.scrollIntoView?.({ block: "nearest" });
  }, [open, highlightedIndex, listboxId]);

  const activeDescendantId =
    open && selectableCount > 0 ? getOptionId(highlightedIndex) : undefined;

  let statusMessage = "No matching tenants";
  if (options.length === 0) {
    statusMessage = emptyMessage;
  } else if (filteredOptions.length > 0) {
    const tenantWord = filteredOptions.length === 1 ? "tenant" : "tenants";
    statusMessage = `${filteredOptions.length} ${tenantWord} available`;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFilter("");
          setHighlightedIndex(0);
        } else {
          setHighlightedIndex(0);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          disabled={disabled || options.length === 0}
          className={cn(
            "h-10 w-full justify-between rounded-md border-input bg-background font-normal",
            showPlaceholderStyle && "text-muted-foreground",
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
        align="start"
      >
        <div className="border-b border-border p-2">
          <Input
            placeholder="Search by display name or ID…"
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-owns={listboxId}
            aria-controls={listboxId}
            aria-activedescendant={activeDescendantId}
            aria-label="Search tenants by display name or ID"
            className="h-8"
            autoFocus
          />
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {statusMessage}
        </span>
        <div
          id={listboxId}
          role="listbox"
          aria-label="Tenant"
          className="max-h-56 overflow-y-auto p-1"
        >
          {filteredOptions.map((tenant, optionIndex) => {
            const isSelected = tenant.tenantId === value;
            const isHighlighted = highlightedIndex === optionIndex;

            return (
              <button
                key={tenant.tenantId}
                type="button"
                id={getOptionId(optionIndex)}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                className={cn(
                  "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                  isSelected && "bg-accent font-medium",
                  isHighlighted && "bg-accent",
                )}
                onClick={() => selectValue(tenant.tenantId)}
                onMouseEnter={() => setHighlightedIndex(optionIndex)}
              >
                <Check
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isSelected ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">
                  {formatTenantPickerLabel(tenant)}
                </span>
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
          {options.length > 0 && filteredOptions.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No matching tenants
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default TenantPickerCombobox;
