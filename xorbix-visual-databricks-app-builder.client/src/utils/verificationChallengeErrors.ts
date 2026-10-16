import { ApiError } from "../models";

/**
 * Reads the server's remaining-attempt budget from a rejected verification response. The server owns
 * the limit and reports what is left, so the client never encodes the number and cannot drift from it.
 *
 * @returns The remaining attempts, or null when the response did not carry a budget.
 */
export function readRemainingAttempts(error: unknown): number | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const remainingAttempts = error.data?.remainingAttempts;
  return typeof remainingAttempts === "number" ? remainingAttempts : null;
}

/**
 * Reads the `retryAfter` instant from a throttled (429) response.
 *
 * @returns The parsed date, or null when absent or unparseable.
 */
export function readRetryAfter(error: unknown): Date | null {
  if (!(error instanceof ApiError) || error.status !== 429) {
    return null;
  }

  const retryAfter = error.data?.retryAfter;
  if (typeof retryAfter !== "string") {
    return null;
  }

  const parsed = new Date(retryAfter);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Builds the user-facing message for a rejected verification code.
 *
 * A 400 or 401 is a genuine, user-actionable code problem. Anything else (a network failure or a 5xx
 * from a cold backend) must not be reported as an invalid code, or the user will retype a correct
 * code believing it was rejected.
 */
export function resolveVerifyCodeErrorMessage(
  error: unknown,
  remainingAttempts: number | null,
): string {
  if (remainingAttempts === 0) {
    return "Too many incorrect attempts. That code is no longer valid — request a new one.";
  }

  // A 429 is the rate-limit backstop, not a rejected code; tell the user to wait rather than implying
  // the code was wrong.
  if (error instanceof ApiError && error.status === 429) {
    return "Too many attempts. Please wait a moment before trying again.";
  }

  const isCodeRejected =
    error instanceof ApiError && (error.status === 400 || error.status === 401);

  if (!isCodeRejected) {
    return "We couldn't verify your code right now. Please try again in a moment.";
  }

  if (remainingAttempts === null) {
    return "Invalid or expired code. Please try again or request a new one.";
  }

  const attemptLabel = remainingAttempts === 1 ? "attempt" : "attempts";
  return `Invalid code. ${remainingAttempts} ${attemptLabel} remaining.`;
}

/**
 * Builds the user-facing message for a failed request for a new code, distinguishing the server's
 * escalating backoff (429) from a genuine send failure.
 */
export function resolveChallengeRequestErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return "You've requested codes too frequently. Please wait before requesting another.";
  }

  return "Failed to send verification code. Please check your email and try again.";
}
