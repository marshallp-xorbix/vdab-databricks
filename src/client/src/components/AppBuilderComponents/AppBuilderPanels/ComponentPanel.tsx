import {
  type ElementType,
  type FC,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import { Search } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { useComponentRegistry } from "../../../context/ComponentRegistryContext";
import {
  ComponentType,
  humanizeComponentType,
} from "../../../types/components/componentTypes";
import type { ComponentDragData } from "../../../types/dnd";
import CollapsibleSection from "./CollapsibleSection";
import { getPaletteIconByName } from "./componentPaletteIcons";
import { Input } from "../../ui/input";

interface ControlItemProps {
  icon: ElementType;
  label: string;
  componentType: string;
  category: string;
  onAddComponent?: (componentType: string, category: string) => void;
}

const ControlItem: FC<ControlItemProps> = ({
  icon: Icon,
  label,
  componentType,
  category,
  onAddComponent,
}) => {
  const dragData: ComponentDragData = {
    dragType: "new",
    type: componentType,
    label,
    category,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `component-${componentType}-${label}`,
    data: dragData,
  });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      className={`relative flex flex-col items-center justify-center rounded-lg border border-[var(--builder-chrome-border)] bg-muted h-16 px-1 py-1.5 transition-colors touch-none ${
        isDragging
          ? "cursor-grabbing border-primary bg-card"
          : "cursor-grab hover:bg-muted/60 hover:border-primary"
      }`}
      {...listeners}
      {...attributes}
      aria-label={onAddComponent ? `Add ${label}` : undefined}
      onClick={() => onAddComponent?.(componentType, category)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onAddComponent?.(componentType, category);
        }
      }}
    >
      <div className="mb-0 flex items-center justify-center">
        <Icon size={16} />
      </div>
      <span className="text-xs font-medium text-foreground text-center">
        {label}
      </span>
    </div>
  );
};

interface Control {
  icon: ElementType;
  label: string;
  componentType: string;
  category: string;
}

interface ComponentPanelProps {
  disableScroll?: boolean;
  onAddComponent?: (componentType: string, category: string) => void;
}

function ComponentPanelChrome({
  title,
  searchQuery,
  onSearchChange,
  children,
  disableScroll,
}: {
  title: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  children: ReactNode;
  disableScroll: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="builder-chrome-toolbar-row flex items-center border-b border-[var(--builder-chrome-border)] px-3">
        <span className="text-base font-bold tracking-tight text-[var(--builder-chrome-foreground)]">
          {title}
        </span>
      </div>
      <div className="builder-chrome-toolbar-row flex items-center border-b border-[var(--builder-chrome-border)] px-2">
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search components…"
            aria-label="Search components"
            className="h-8 w-full border-[var(--builder-chrome-border)] bg-card pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div
        className={`builder-panel-scroll min-h-0 flex-1 overflow-x-hidden px-2 pb-3 pt-1 ${
          disableScroll ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

const ComponentPanel: FC<ComponentPanelProps> = ({
  disableScroll = false,
  onAddComponent,
}) => {
  const { registry, loading, error } = useComponentRegistry();
  const [searchQuery, setSearchQuery] = useState("");

  // Keep this hook ahead of the loading/error returns so registry state changes
  // cannot alter ComponentPanel's hook order.
  const registryComponents = (registry?.components || []).filter(
    (comp) => comp.type !== ComponentType.Modal,
  );
  const componentsByCategory = registryComponents.reduce(
    (acc, comp) => {
      const category = comp.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        icon: getPaletteIconByName(comp.icon),
        label: humanizeComponentType(comp.type),
        componentType: comp.type,
        category,
      });
      return acc;
    },
    {} as Record<string, Control[]>,
  );
  const filteredByCategory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return componentsByCategory;
    }
    const next: Record<string, Control[]> = {};
    for (const [category, controls] of Object.entries(componentsByCategory)) {
      const labelCat = category.charAt(0).toUpperCase() + category.slice(1);
      const filtered = controls.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.componentType.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          labelCat.toLowerCase().includes(q),
      );
      if (filtered.length > 0) {
        next[category] = filtered;
      }
    }
    return next;
  }, [componentsByCategory, searchQuery]);
  const hasAny = Object.keys(componentsByCategory).length > 0;
  const hasFiltered = Object.keys(filteredByCategory).length > 0;

  if (loading) {
    return (
      <ComponentPanelChrome
        title="Components"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        disableScroll={disableScroll}
      >
        <div className="py-6 text-center text-sm text-[var(--builder-chrome-foreground)]">
          <div className="animate-pulse">Loading components...</div>
        </div>
      </ComponentPanelChrome>
    );
  }

  if (error) {
    return (
      <ComponentPanelChrome
        title="Components"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        disableScroll={disableScroll}
      >
        <div className="px-1 py-4 text-center text-sm text-destructive-foreground">
          <div className="mb-1 font-medium">Error loading components</div>
          <div className="text-xs">{error}</div>
        </div>
      </ComponentPanelChrome>
    );
  }

  return (
    <ComponentPanelChrome
      title="Components"
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      disableScroll={disableScroll}
    >
      {hasAny ? (
        hasFiltered ? (
          <div className="space-y-0">
            {Object.entries(filteredByCategory).map(([category, controls]) => (
              <div
                key={category}
                className="border-b border-[var(--builder-chrome-border)] last:border-b-0"
              >
                <CollapsibleSection
                  title={category.charAt(0).toUpperCase() + category.slice(1)}
                  defaultExpanded={true}
                  borderVariant="none"
                  panelTone="sidebarBlue"
                  scrollableContent={false}
                >
                  <div className="pb-2 pt-0">
                    <div className="grid grid-cols-2 gap-1.5">
                      {controls.map((control, controlIndex) => (
                        <ControlItem
                          key={`${category}-${controlIndex}`}
                          icon={control.icon}
                          label={control.label}
                          componentType={control.componentType}
                          category={control.category}
                          onAddComponent={onAddComponent}
                        />
                      ))}
                    </div>
                  </div>
                </CollapsibleSection>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-3 text-center text-sm text-[var(--builder-chrome-foreground)]">
            No components match your search.
          </div>
        )
      ) : (
        <div className="py-3 text-center text-sm text-[var(--builder-chrome-foreground)]">
          No components available
        </div>
      )}
    </ComponentPanelChrome>
  );
};

export default ComponentPanel;
