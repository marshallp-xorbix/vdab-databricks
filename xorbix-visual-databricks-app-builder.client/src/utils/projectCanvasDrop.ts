import type { IProjectComponent } from "../models/ProjectComponents";
import {
  FORM_CHILD_TYPES,
  LAYOUT_CHILD_TYPES,
  MODAL_CHILD_TYPES,
  createProjectComponent,
  type ProjectComponentAddType,
} from "./projectComponentFactory";
import {
  readDefaultTabIndex,
  readLayoutSlotCount,
  readNextTabChildY,
  readTabNames,
} from "./projectComponentLayout";

/** Adds a palette component to a compatible layout container. */
export function appendProjectComponentToContainer(
  components: IProjectComponent[],
  containerKey: string,
  type: ProjectComponentAddType,
): IProjectComponent[] | null {
  const container = components.find((component) => component.key === containerKey);
  if (!container || !canAcceptChild(container, type)) return null;

  const createdChild = createProjectComponent(type, components);
  const child = createContainerChild(container, components, createdChild, type);
  return [
    ...components.map((component) =>
      component.key === containerKey
        ? { ...component, children: [...component.children, child.key] }
        : component,
    ),
    child,
  ];
}

function canAcceptChild(
  container: IProjectComponent,
  type: ProjectComponentAddType,
): boolean {
  if (
    (container.type === "Columns" || container.type === "Rows") &&
    container.children.length >=
      readLayoutSlotCount(container.type, container.properties)
  ) {
    return false;
  }

  return getAllowedChildTypes(container.type).some(
    (allowedType) => allowedType === type,
  );
}

function createContainerChild(
  container: IProjectComponent,
  components: IProjectComponent[],
  child: IProjectComponent,
  type: ProjectComponentAddType,
): IProjectComponent {
  if (container.type === "Tabs") {
    const tabIndex = readDefaultTabIndex(
      container.properties.defaultTabIndex,
      readTabNames(container.properties.tabs).length,
    );
    return {
      ...child,
      layout: {
        tabIndex,
        y: readNextTabChildY(container, components, tabIndex),
      },
    };
  }

  if (
    container.type === "Modal" &&
    LAYOUT_CHILD_TYPES.some((childType) => childType === type)
  ) {
    return { ...child, layout: { y: container.children.length } };
  }

  return child;
}

function getAllowedChildTypes(containerType: string): readonly string[] {
  switch (containerType) {
    case "Columns":
    case "Rows":
    case "Expander":
    case "Tabs":
      return LAYOUT_CHILD_TYPES;
    case "Form":
      return FORM_CHILD_TYPES;
    case "Modal":
      return MODAL_CHILD_TYPES;
    default:
      return [];
  }
}
