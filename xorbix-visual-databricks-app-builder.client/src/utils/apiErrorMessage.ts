import { parseError } from "../lib/utils";

/**
 * Human-readable message from fetch failures (ProblemDetails, FluentResults, etc.).
 * @deprecated Prefer `parseError(error).message` directly.
 */
export function formatApiErrorMessage(error: unknown): string {
  return parseError(error).message;
}
