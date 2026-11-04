import type { VdabComponent } from "../../types/components";
import type { ComponentContexts } from "../../types/editor";
import {
  ComponentCategory,
  ComponentType,
} from "../../types/components/componentTypes";

export const createComponent = (
  overrides: Partial<VdabComponent> & {
    id: string;
    type: ComponentType;
    category?: ComponentCategory;
  },
): VdabComponent => ({
  category: overrides.category ?? ComponentCategory.Controls,
  props: {},
  schemaVersion: 1,
  ...overrides,
});

export const getComponentById = (
  contexts: ComponentContexts,
  componentId: string,
): VdabComponent | undefined =>
  Object.values(contexts)
    .flat()
    .find((component) => component.id === componentId);

export const createPageContext = (
  components: VdabComponent[],
): ComponentContexts => ({
  page_1: components,
});
