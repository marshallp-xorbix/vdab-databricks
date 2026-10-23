import { ApplicationError } from "../application-error.ts";

/** Creates the typed boundary error used for invalid workflow input. */
export function invalidWorkflow(detail: string): ApplicationError {
  return new ApplicationError(400, "invalid_project_workflow", "Invalid project workflow", detail);
}
