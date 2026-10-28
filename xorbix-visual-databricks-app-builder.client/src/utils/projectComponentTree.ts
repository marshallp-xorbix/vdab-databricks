import type { IProjectComponent } from "../models/ProjectComponents";
import { readTabIndex } from "./projectComponentLayout";

export type ProjectComponentMoveDirection = "up" | "down";

export interface IProjectComponentMoveAvailability {
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export interface IProjectComponentRemoval {
  components: IProjectComponent[];
  removedComponents: IProjectComponent[];
}

/** Reports whether a component has a sibling in the requested order direction. */
export function getProjectComponentMoveAvailability(
  components: IProjectComponent[],
  componentKey: string | null,
): IProjectComponentMoveAvailability {
  const siblings = readComponentSiblings(components, componentKey);
  if (!siblings) {
    return { canMoveUp: false, canMoveDown: false };
  }

  return {
    canMoveUp: siblings.index > 0,
    canMoveDown: siblings.index < siblings.keys.length - 1,
  };
}

/** Moves a component among its siblings while preserving the saved tree shape. */
export function moveProjectComponent(
  components: IProjectComponent[],
  componentKey: string,
  direction: ProjectComponentMoveDirection,
): IProjectComponent[] {
  const siblings = readComponentSiblings(components, componentKey);
  if (!siblings) {
    return components;
  }

  const neighborIndex = siblings.index + (direction === "up" ? -1 : 1);
  const neighborKey = siblings.keys[neighborIndex];
  if (!neighborKey) {
    return components;
  }

  if (!siblings.parent) {
    const currentIndex = components.findIndex(
      (component) => component.key === componentKey,
    );
    const nextIndex = components.findIndex(
      (component) => component.key === neighborKey,
    );
    const reorderedComponents = [...components];
    [reorderedComponents[currentIndex], reorderedComponents[nextIndex]] = [
      reorderedComponents[nextIndex],
      reorderedComponents[currentIndex],
    ];
    return reorderedComponents;
  }

  const parent = siblings.parent;
  const childIndex = parent.children.indexOf(componentKey);
  const neighborChildIndex = parent.children.indexOf(neighborKey);
  const childKeys = [...parent.children];
  [childKeys[childIndex], childKeys[neighborChildIndex]] = [
    childKeys[neighborChildIndex],
    childKeys[childIndex],
  ];
  const nextYByKey = readReorderedChildPositions(parent, childKeys, components);

  return components.map((component) => {
    if (component.key === parent.key) {
      return { ...component, children: childKeys };
    }

    const nextY = nextYByKey.get(component.key);
    if (nextY === undefined) {
      return component;
    }

    return {
      ...component,
      layout: { ...(component.layout ?? {}), y: nextY },
    };
  });
}

/** Moves a component before a compatible sibling without changing its parent. */
export function moveProjectComponentBefore(
  components: IProjectComponent[],
  componentKey: string,
  targetKey: string,
): IProjectComponent[] {
  const siblings = readComponentSiblings(components, componentKey);
  const targetSiblings = readComponentSiblings(components, targetKey);
  if (
    !siblings ||
    !targetSiblings ||
    siblings.parent?.key !== targetSiblings.parent?.key ||
    (siblings.parent?.type === "Tabs" &&
      targetSiblings.parent?.type === "Tabs" &&
      readTabIndex(
        components.find((component) => component.key === componentKey)
          ?.layout ?? null,
      ) !==
        readTabIndex(
          components.find((component) => component.key === targetKey)?.layout ??
            null,
        ))
  ) {
    return components;
  }

  const targetIndex = siblings.keys.indexOf(targetKey);
  if (targetIndex < 0 || siblings.index === targetIndex) {
    return components;
  }

  let reorderedComponents = components;
  const desiredIndex =
    siblings.index < targetIndex ? targetIndex - 1 : targetIndex;
  while (true) {
    const currentSiblings = readComponentSiblings(
      reorderedComponents,
      componentKey,
    );
    if (!currentSiblings || currentSiblings.index === desiredIndex) {
      return reorderedComponents;
    }
    reorderedComponents = moveProjectComponent(
      reorderedComponents,
      componentKey,
      currentSiblings.index < desiredIndex ? "down" : "up",
    );
  }
}

/** Removes the selected component and every component nested below it. */
export function removeProjectComponentSubtree(
  components: IProjectComponent[],
  componentKey: string,
): IProjectComponentRemoval {
  const componentsByKey = new Map(
    components.map((component) => [component.key, component]),
  );
  if (!componentsByKey.has(componentKey)) {
    return { components, removedComponents: [] };
  }

  const removedKeys = new Set<string>();
  function visit(key: string) {
    if (removedKeys.has(key)) {
      return;
    }

    removedKeys.add(key);
    componentsByKey.get(key)?.children.forEach(visit);
  }
  visit(componentKey);

  const removedComponents = components.filter((component) =>
    removedKeys.has(component.key),
  );
  const remainingComponents = components
    .filter((component) => !removedKeys.has(component.key))
    .map((component) => {
      const remainingChildren = component.children.filter(
        (childKey) => !removedKeys.has(childKey),
      );
      return remainingChildren.length === component.children.length
        ? component
        : { ...component, children: remainingChildren };
    });

  return { components: remainingComponents, removedComponents };
}

function readComponentSiblings(
  components: IProjectComponent[],
  componentKey: string | null,
): { parent: IProjectComponent | null; keys: string[]; index: number } | null {
  if (componentKey === null) {
    return null;
  }

  const component = components.find(
    (candidate) => candidate.key === componentKey,
  );
  if (!component) {
    return null;
  }

  const parent = components.find((candidate) =>
    candidate.children.includes(componentKey),
  );
  const childKeys = new Set(
    components.flatMap((candidate) => candidate.children),
  );
  const keys = parent
    ? readSiblingKeys(parent, component, components)
    : components
        .filter((candidate) => !childKeys.has(candidate.key))
        .map((candidate) => candidate.key);
  const index = keys.indexOf(componentKey);
  return index < 0 ? null : { parent: parent ?? null, keys, index };
}

function readSiblingKeys(
  parent: IProjectComponent,
  component: IProjectComponent,
  components: IProjectComponent[],
): string[] {
  if (parent.type !== "Tabs") {
    return parent.children;
  }

  const tabIndex = readTabIndex(component.layout);
  if (tabIndex === null) {
    return [];
  }

  const componentsByKey = new Map(
    components.map((candidate) => [candidate.key, candidate]),
  );
  return parent.children.filter(
    (childKey) =>
      readTabIndex(componentsByKey.get(childKey)?.layout ?? null) === tabIndex,
  );
}

function readReorderedChildPositions(
  parent: IProjectComponent,
  childKeys: string[],
  components: IProjectComponent[],
): Map<string, number> {
  if (parent.type !== "Tabs" && parent.type !== "Modal") {
    return new Map();
  }

  const componentsByKey = new Map(
    components.map((component) => [component.key, component]),
  );
  const positions = new Map<string, number>();
  const positionByTabIndex = new Map<number, number>();
  let modalPosition = 0;
  for (const childKey of childKeys) {
    const child = componentsByKey.get(childKey);
    if (!child) {
      continue;
    }

    if (parent.type === "Tabs") {
      const tabIndex = readTabIndex(child.layout);
      if (tabIndex === null) {
        continue;
      }
      const tabPosition = positionByTabIndex.get(tabIndex) ?? 0;
      positions.set(childKey, tabPosition);
      positionByTabIndex.set(tabIndex, tabPosition + 1);
    } else {
      positions.set(childKey, modalPosition);
      modalPosition += 1;
    }
  }

  return positions;
}
