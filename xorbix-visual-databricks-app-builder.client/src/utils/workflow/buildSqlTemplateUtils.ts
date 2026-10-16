import { ComponentType } from "../../types/components/componentTypes";
import type { VdabComponent } from "../../types/components";
import type {
  BuildSqlFormatHint,
  BuildSqlPlaceholderReference,
  WorkflowValueType,
} from "../../types/workflow/sharedReferences";

const BUILD_SQL_TOKEN_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export const parseBuildSqlTokens = (sqlTemplate: string): string[] => {
  const tokens: string[] = [];
  const seenTokens = new Set<string>();

  for (const match of sqlTemplate.matchAll(BUILD_SQL_TOKEN_PATTERN)) {
    const token = match[1];
    if (!token || seenTokens.has(token)) {
      continue;
    }

    seenTokens.add(token);
    tokens.push(token);
  }

  return tokens;
};

export const inferWorkflowValueType = (
  component?: VdabComponent,
): WorkflowValueType => {
  switch (component?.type) {
    case ComponentType.Checkbox:
    case ComponentType.Toggle:
      return "boolean";
    case ComponentType.Slider:
      return "number";
    case ComponentType.DatePicker:
      return "date";
    case ComponentType.TimePicker:
      return "datetime";
    case ComponentType.TextInput:
    case ComponentType.Dropdown:
    case ComponentType.FileUpload:
      return "string";
    default:
      return "unknown";
  }
};

export const inferBuildSqlFormatHint = (
  component?: VdabComponent,
): BuildSqlFormatHint => {
  switch (component?.type) {
    case ComponentType.DatePicker:
      return "dateLiteral";
    case ComponentType.TextInput:
    case ComponentType.Dropdown:
    case ComponentType.TimePicker:
    case ComponentType.FileUpload:
      return "sqlStringLiteral";
    default:
      return "raw";
  }
};

export const synchronizeBuildSqlPlaceholders = (
  sqlTemplate: string,
  existingPlaceholders: BuildSqlPlaceholderReference[],
  components: VdabComponent[],
): BuildSqlPlaceholderReference[] => {
  const componentMap = new Map(
    components
      .filter((component) => Boolean(component.codeName))
      .map((component) => [component.codeName, component] as const),
  );
  const existingByToken = new Map(
    existingPlaceholders.map((placeholder) => [placeholder.token, placeholder]),
  );

  return parseBuildSqlTokens(sqlTemplate).map((token) => {
    const matchedComponent = componentMap.get(token);
    const existingPlaceholder = existingByToken.get(token);

    return {
      token,
      componentCodeName: token,
      valueType:
        matchedComponent != null
          ? inferWorkflowValueType(matchedComponent)
          : (existingPlaceholder?.valueType ?? "unknown"),
      formatHint:
        matchedComponent != null
          ? inferBuildSqlFormatHint(matchedComponent)
          : (existingPlaceholder?.formatHint ?? "raw"),
    };
  });
};

export const getInvalidBuildSqlTokens = (
  sqlTemplate: string,
  components: VdabComponent[],
): string[] => {
  const componentCodeNames = new Set(
    components
      .map((component) => component.codeName?.trim())
      .filter((codeName): codeName is string => Boolean(codeName)),
  );

  return parseBuildSqlTokens(sqlTemplate).filter(
    (token) => !componentCodeNames.has(token),
  );
};
