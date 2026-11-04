import { TextInputType } from "../../types/components/componentTypes";

// height validation
export const isValidHeight = (height: unknown): boolean => {
  if (height === null || height === undefined) return false;

  // Normalize string
  if (typeof height === "string") {
    const normalized = height.trim().toLowerCase();

    if (normalized === "content" || normalized === "stretch") {
      return true;
    }

    // Try parse number from string
    const parsed = Number(normalized);
    return !isNaN(parsed) && parsed > 98;
  }

  // Handle numeric input directly
  if (typeof height === "number") {
    return height > 98;
  }

  return false;
};

export const getTextInputHeightValidationError = (height: unknown): string | undefined => {
  if (height === null || height === undefined || height === "") {
    return undefined; // Optional field, so no error if empty
  }

  if (!isValidHeight(height)) {
    return "Invalid height value. Must be a number greater than 98, 'content', or 'stretch'.";
  }

  return undefined;
};

// type validation
export const getTextInputTypeValidationError = (type: unknown): string | undefined => {
    if (type === null || type === undefined || type === "") {
        return undefined; // Optional field, so no error if empty
    }
    const validTypes = Object.values(TextInputType);
    if (typeof type !== "string" || !validTypes.includes(type.toLowerCase() as TextInputType)) {
        return `Invalid type value. Must be one of: ${validTypes.join(", ")}.`;
    }
    return undefined;
}
