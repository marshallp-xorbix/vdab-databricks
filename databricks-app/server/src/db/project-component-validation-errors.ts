import { ApplicationError } from "../application-error.ts";

export function invalidComponents(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_component_aggregate",
    "Invalid component collection",
    "Correct the component definitions, nesting, order, and project-local references before saving.",
  );
}
