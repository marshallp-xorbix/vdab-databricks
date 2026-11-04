import type { ComponentRegistryResponse } from "../models/ComponentRegistry";
import type { VdabComponent } from "../types/components";
import type { IComponentRegistry } from "../models/ComponentRegistry";

/** Maps the versioned API registry into the editor's component contract. */
export function toEditorComponentRegistry(
  registry: IComponentRegistry,
): ComponentRegistryResponse {
  return {
    version: registry.version,
    bindingSchemas: registry.bindingSchemas,
    components: registry.components.map(
      (definition): VdabComponent => ({
        id: definition.id,
        codeName: definition.codeName,
        type: definition.type as VdabComponent["type"],
        category: definition.category as VdabComponent["category"],
        icon: definition.icon,
        props: definition.props,
        supportedBindings: definition.supportedBindings ?? undefined,
        supportedEvents: definition.supportedEvents ?? undefined,
        children: definition.children ?? undefined,
        schemaVersion: definition.schemaVersion,
      }),
    ),
  };
}
