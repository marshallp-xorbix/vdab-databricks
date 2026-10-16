import type { ComponentContexts } from "../types/editor";
import type { VdabComponent } from "../types/components";
import { ComponentType } from "../types/components/componentTypes";

export const normalizeCodeName = (codeName?: string): string | undefined => {
  if (codeName === undefined) {
    return undefined;
  }

  const trimmedCodeName = codeName.trim();
  return trimmedCodeName.length > 0 ? trimmedCodeName : undefined;
};

export const MAX_CODE_NAME_LENGTH = 255;

const getCodeNamePrefix = (componentType: ComponentType): string => {
  const typeName = componentType.toString();
  if (typeName.length === 0) {
    return "component";
  }

  if (typeName.length === 1) {
    return typeName.toLowerCase();
  }

  return `${typeName[0].toLowerCase()}${typeName.slice(1)}`;
};

export const generateUniqueCodeName = (
  componentType: ComponentType,
  usedCodeNames: Set<string>,
): string => {
  const prefix = getCodeNamePrefix(componentType);
  let suffix = 1;
  let candidate = `${prefix}${suffix}`;

  while (usedCodeNames.has(candidate)) {
    suffix += 1;
    candidate = `${prefix}${suffix}`;
  }

  usedCodeNames.add(candidate);
  return candidate;
};

const buildUsedCodeNameSet = (components: VdabComponent[]): Set<string> => {
  const usedCodeNames = new Set<string>();

  components.forEach((component) => {
    const normalizedCodeName = normalizeCodeName(component.codeName);
    if (normalizedCodeName) {
      usedCodeNames.add(normalizedCodeName);
    }
  });

  return usedCodeNames;
};

export const assignCodeNameOnCreate = (
  component: VdabComponent,
  existingComponents: VdabComponent[],
): VdabComponent => {
  const normalizedCodeName = normalizeCodeName(component.codeName);
  if (normalizedCodeName) {
    return {
      ...component,
      codeName: normalizedCodeName,
    };
  }

  const usedCodeNames = buildUsedCodeNameSet(existingComponents);

  return {
    ...component,
    codeName: generateUniqueCodeName(component.type, usedCodeNames),
  };
};

const normalizeOrGenerateCodeName = (
  component: VdabComponent,
  usedCodeNames: Set<string>,
): VdabComponent => {
  const normalizedCodeName = normalizeCodeName(component.codeName);

  if (normalizedCodeName) {
    usedCodeNames.add(normalizedCodeName);
    if (normalizedCodeName === component.codeName) {
      return component;
    }

    return {
      ...component,
      codeName: normalizedCodeName,
    };
  }

  return {
    ...component,
    codeName: generateUniqueCodeName(component.type, usedCodeNames),
  };
};

export const applyCodeNamesToLoadedComponents = (
  componentContexts: ComponentContexts,
  modals: VdabComponent[],
): {
  componentContexts: ComponentContexts;
  modals: VdabComponent[];
} => {
  const allComponents = [...Object.values(componentContexts).flat(), ...modals];
  const usedCodeNames = buildUsedCodeNameSet(allComponents);

  const updatedContexts: ComponentContexts = {};
  Object.entries(componentContexts).forEach(([contextKey, components]) => {
    updatedContexts[contextKey] = components.map((component) =>
      normalizeOrGenerateCodeName(component, usedCodeNames),
    );
  });

  const updatedModals = modals.map((modal) =>
    normalizeOrGenerateCodeName(modal, usedCodeNames),
  );

  return {
    componentContexts: updatedContexts,
    modals: updatedModals,
  };
};

export const getCodeNameValidationError = (
  components: VdabComponent[],
): string | undefined => {
  const seenByCodeName = new Map<string, string>();

  for (const component of components) {
    const normalizedCodeName = normalizeCodeName(component.codeName);
    const componentId = component.id;

    if (!normalizedCodeName) {
      return `Component ${componentId} is missing a code name.`;
    }

    if (normalizedCodeName.length > MAX_CODE_NAME_LENGTH) {
      return `Code name '${normalizedCodeName}' exceeds ${MAX_CODE_NAME_LENGTH} characters.`;
    }

    const duplicateComponentId = seenByCodeName.get(normalizedCodeName);
    if (duplicateComponentId && duplicateComponentId !== componentId) {
      return `Code name '${normalizedCodeName}' is used by both component ${duplicateComponentId} and component ${componentId}.`;
    }

    seenByCodeName.set(normalizedCodeName, componentId);
  }

  return undefined;
};

export const getCodeNameInputValidationError = (
  codeNameInput: string,
  currentComponentId: string,
  components: VdabComponent[],
): string | undefined => {
  const normalizedCodeName = normalizeCodeName(codeNameInput);

  if (!normalizedCodeName) {
    return "Code name is required.";
  }

  if (normalizedCodeName.length > MAX_CODE_NAME_LENGTH) {
    return `Code name cannot exceed ${MAX_CODE_NAME_LENGTH} characters.`;
  }

  const duplicateComponent = components.find((component) => {
    if (component.id === currentComponentId) {
      return false;
    }

    return normalizeCodeName(component.codeName) === normalizedCodeName;
  });

  if (duplicateComponent) {
    return `Code name '${normalizedCodeName}' is already used.`;
  }

  return undefined;
};
