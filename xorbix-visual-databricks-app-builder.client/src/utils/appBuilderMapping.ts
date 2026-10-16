import type { ComponentRegistryResponse } from "../providers/CanvasApi";
import type { AppComponentDto } from "../models";
import type { VdabComponent } from "../types/components";
import type { Binding } from "../types/components/bindings";
import { ComponentCategory } from "../types/components/componentTypes";
import {
  toCanonicalComponentCategory,
  toCanonicalComponentType,
} from "./componentEnumGuards";
import { getRegistryDefinitionType } from "./registryComponentUtils";

export const mapDtoToComponent = (
  comp: AppComponentDto,
  registry: ComponentRegistryResponse | null,
): VdabComponent => {
  let props: Record<string, unknown> = {};
  let bindings: Record<string, Binding> | undefined = undefined;
  let children: string[] | undefined = undefined;
  let layout: string | undefined = undefined;

  try {
    props = JSON.parse(comp.properties);
  } catch (e) {
    console.warn("Failed to parse properties JSON:", e);
  }

  if (comp.bindings) {
    try {
      bindings = JSON.parse(comp.bindings);
    } catch (e) {
      console.warn("Failed to parse bindings JSON:", e);
    }
  }

  if (comp.children) {
    try {
      const childrenArray = JSON.parse(comp.children);
      children = Array.isArray(childrenArray) ? childrenArray : undefined;
    } catch (e) {
      console.warn("Failed to parse children JSON:", e);
    }
  }

  if (comp.layout) {
    layout = comp.layout;
  }

  const dtoTypeCanon = toCanonicalComponentType(String(comp.componentType));
  const registryComponent = registry?.components?.find((c) => {
    const regCanon = toCanonicalComponentType(getRegistryDefinitionType(c));
    if (dtoTypeCanon != null && regCanon != null) {
      return regCanon === dtoTypeCanon;
    }
    return getRegistryDefinitionType(c) === String(comp.componentType);
  });
  const supportedBindings = registryComponent?.supportedBindings;
  const supportedEvents = registryComponent?.supportedEvents;
  const categoryRaw =
    registryComponent?.category ?? ComponentCategory.Controls;
  const category =
    toCanonicalComponentCategory(String(categoryRaw)) ??
    ComponentCategory.Controls;
  const resolvedType = dtoTypeCanon ?? comp.componentType;

  const frontendId = comp.id.toString();

  const vdabComponent: VdabComponent = {
    id: frontendId,
    codeName: comp.codeName,
    type: resolvedType,
    category: category,
    label: comp.codeName,
    layout,
    props,
    bindings,
    supportedBindings,
    supportedEvents,
    children,
    schemaVersion: comp.componentVersion,
  };

  return vdabComponent;
};
