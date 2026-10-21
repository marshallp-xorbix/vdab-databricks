import type { ProjectComponent } from "../db/project-components-contract.ts";

export function uniqueVariableName(
  component: ProjectComponent,
  index: number,
  usedNames: Set<string>,
): string {
  const sourceName = (component.codeName ?? component.key)
    .replace(/[^A-Za-z0-9_]/g, "_")
    .toLowerCase();
  const baseName = `vdab_${sourceName || `component_${index + 1}`}`;
  let candidate = baseName;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    candidate = `${baseName}_${suffix}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

export function pythonHeight(value: string): string {
  if (/^\d+$/.test(value)) {
    const numericValue = Number(value);
    if (Number.isSafeInteger(numericValue) && numericValue > 98) {
      return String(numericValue);
    }
  }

  return pythonString(value);
}

export function pythonString(value: string): string {
  let escapedValue = "";

  for (const character of value) {
    switch (character) {
      case "\\":
        escapedValue += "\\\\";
        break;
      case "'":
        escapedValue += "\\'";
        break;
      case "\n":
        escapedValue += "\\n";
        break;
      case "\r":
        escapedValue += "\\r";
        break;
      case "\t":
        escapedValue += "\\t";
        break;
      case "\u2028":
        escapedValue += "\\u2028";
        break;
      case "\u2029":
        escapedValue += "\\u2029";
        break;
      default:
        escapedValue += character;
    }
  }

  return `'${escapedValue}'`;
}

export function pythonStringList(values: string[]): string {
  return `[${values.map(pythonString).join(", ")}]`;
}

export function formatPythonNumber(value: number): string {
  return value.toString();
}
