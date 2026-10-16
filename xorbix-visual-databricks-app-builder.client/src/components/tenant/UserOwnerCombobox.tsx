import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

import type { ApplicationUser } from "../../models";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface IUserOwnerComboboxProps {
  id?: string;
  options: ApplicationUser[];
  value: string;
  onChange: (userId: string) => void;
  allowNone?: boolean;
  noneLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}

type SelectableOption = { userId: string; user?: ApplicationUser };

function getUserLabel(user: ApplicationUser): string {
  return user.fullName || user.email || user.id;
}

function filterUsers(
  users: ApplicationUser[],
  query: string,
): ApplicationUser[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return users;
  }
  return users.filter((user) => {
    const fullName = (user.fullName || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    const id = (user.id || "").toLowerCase();
    return (
      fullName.includes(normalized) ||
      email.includes(normalized) ||
      id.includes(normalized)
    );
  });
}

function UserOwnerCombobox({
  id,
  options,
  value,
  onChange,
  allowNone = false,
  noneLabel = "No owner",
  placeholder = "Select owner",
  disabled = false,
}: Readonly<IUserOwnerComboboxProps>) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedUser = useMemo(
    () => options.find((user) => user.id === value),
    [options, value],
  );

  let triggerLabel = placeholder;
  if (selectedUser) {
    triggerLabel = getUserLabel(selectedUser);
  } else if (allowNone && !value) {
    triggerLabel = noneLabel;
  }

  const showPlaceholderStyle = !selectedUser && !(allowNone && !value);

  const filteredOptions = useMemo(
    () => filterUsers(options, filter),
    [options, filter],
  );

  const selectableOptions = useMemo<SelectableOption[]>(
    () => [
      ...(allowNone ? [{ userId: "" }] : []),
      ...filteredOptions.map((user) => ({ userId: user.id, user })),
    ],
    [allowNone, filteredOptions],
  );

  const selectableCount = selectableOptions.length;

  const getOptionId = (index: number) => `${listboxId}-option-${index}`;

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setFilter("");
    setHighlightedIndex(0);
  };

  const selectByIndex = (index: number) => {
    const option = selectableOptions[index];
    if (!option) {
      return;
    }
    selectValue(option.userId);
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
    const matches = filterUsers(options, nextFilter);
    const firstUserIndex = allowNone ? 1 : 0;
    setHighlightedIndex(
      nextFilter.trim() && matches.length > 0 ? firstUserIndex : 0,
    );
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

  let statusMessage = "No matching users";
  if (options.length === 0) {
    statusMessage = "No users";
  } else if (filteredOptions.length > 0) {
    const userWord = filteredOptions.length === 1 ? "user" : "users";
    statusMessage = `${filteredOptions.length} ${userWord} available`;
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
          disabled={disabled}
          className={cn(
            "mt-1 h-10 w-full justify-between rounded-md border-input bg-background font-normal",
            showPlaceholderStyle && "text-muted-foreground",
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0"
        align="start"
      >
        <div className="border-b border-border p-2">
          <Input
            placeholder="Search by name or email…"
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-owns={listboxId}
            aria-controls={listboxId}
            aria-activedescendant={activeDescendantId}
            aria-label="Search owners by name or email"
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
          aria-label="Owner"
          className="max-h-56 overflow-y-auto p-1"
        >
          {selectableOptions.map((option, optionIndex) => {
            const isNoneOption = option.user === undefined;
            const isSelected = isNoneOption ? !value : option.userId === value;
            const isHighlighted = highlightedIndex === optionIndex;
            const primary = option.user ? getUserLabel(option.user) : noneLabel;
            const showEmailSecondary =
              Boolean(option.user?.fullName) && Boolean(option.user?.email);

            return (
              <button
                key={isNoneOption ? "__none__" : option.userId}
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
                onClick={() => selectValue(option.userId)}
                onMouseEnter={() => setHighlightedIndex(optionIndex)}
              >
                <Check
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isSelected ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{primary}</span>
                  {showEmailSecondary && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.user?.email}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">No users</p>
          )}
          {options.length > 0 && filteredOptions.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No matching users
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default UserOwnerCombobox;
