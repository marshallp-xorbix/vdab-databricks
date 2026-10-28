import type { ComponentCategory, VdabComponent } from "../types/components";
import type { ComponentType } from "../types/components/componentTypes";

type BuildVdabComponentArgs = {
  type: ComponentType;
  category: ComponentCategory;
  registryEntry?: VdabComponent | null;
  layout?: string | undefined;
};

/**
 * Creates a new canvas component from the palette/drag payload + the registry entry.
 * The registry provides default `props` and supported bindings/events metadata.
 */
export function buildVdabComponentFromRegistryEntry(
  args: BuildVdabComponentArgs,
): VdabComponent {
  const { type, category, registryEntry, layout } = args;

  const defaultProps = registryEntry?.props ? { ...registryEntry.props } : {};

  return {
    id: crypto.randomUUID(),
    codeName: "",
    category,
    type,
    props: defaultProps,
    supportedBindings: registryEntry?.supportedBindings || undefined,
    supportedEvents: registryEntry?.supportedEvents || undefined,
    schemaVersion: 1,
    layout,
  };
}

