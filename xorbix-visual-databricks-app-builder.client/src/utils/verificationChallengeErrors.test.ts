import { describe, expect, it } from "vitest";
import { ApiError } from "../models";
import {
  readRemainingAttempts,
  readRetryAfter,
  resolveChallengeRequestErrorMessage,
  resolveVerifyCodeErrorMessage,
} from "./verificationChallengeErrors";

describe("readRemainingAttempts", () => {
  it("returns the server-reported budget", () => {
    const error = new ApiError("Invalid code", 401, { remainingAttempts: 2 });

    expect(readRemainingAttempts(error)).toBe(2);
  });

  it("returns zero when the budget is spent", () => {
    const error = new ApiError("Exhausted", 400, { remainingAttempts: 0 });

    expect(readRemainingAttempts(error)).toBe(0);
  });

  it("returns null when the response carries no budget", () => {
    const error = new ApiError("Expired", 400, {});

    expect(readRemainingAttempts(error)).toBeNull();
  });

  it("returns null for a non-API error", () => {
    expect(readRemainingAttempts(new Error("network down"))).toBeNull();
  });
});

describe("readRetryAfter", () => {
  it("parses retryAfter from a throttled response", () => {
    const retryAfter = "2026-07-20T12:00:00.000Z";
    const error = new ApiError("Too many", 429, { retryAfter });

    expect(readRetryAfter(error)?.toISOString()).toBe(retryAfter);
  });

  it("ignores retryAfter on a non-429 response", () => {
    const error = new ApiError("Invalid", 401, {
      retryAfter: "2026-07-20T12:00:00.000Z",
    });

    expect(readRetryAfter(error)).toBeNull();
  });

  it("returns null when retryAfter is unparseable", () => {
    const error = new ApiError("Too many", 429, { retryAfter: "soon" });

    expect(readRetryAfter(error)).toBeNull();
  });
});

describe("resolveVerifyCodeErrorMessage", () => {
  it("tells the user to request a new code once the budget is spent", () => {
    const error = new ApiError("Exhausted", 400, { remainingAttempts: 0 });

    expect(resolveVerifyCodeErrorMessage(error, 0)).toContain("request a new one");
  });

  it("reports the remaining attempts using the server's number", () => {
    const error = new ApiError("Invalid code", 401, { remainingAttempts: 2 });

    expect(resolveVerifyCodeErrorMessage(error, 2)).toBe(
      "Invalid code. 2 attempts remaining.",
    );
  });

  it("uses the singular form for a final attempt", () => {
    const error = new ApiError("Invalid code", 401, { remainingAttempts: 1 });

    expect(resolveVerifyCodeErrorMessage(error, 1)).toBe(
      "Invalid code. 1 attempt remaining.",
    );
  });

  it("does not blame the code for a transport or server failure", () => {
    const message = resolveVerifyCodeErrorMessage(new Error("network"), null);

    expect(message).toBe(
      "We couldn't verify your code right now. Please try again in a moment.",
    );
  });

  it("falls back to a generic code message when no budget is reported", () => {
    const error = new ApiError("Expired", 400, {});

    expect(resolveVerifyCodeErrorMessage(error, null)).toContain(
      "Invalid or expired code",
    );
  });

  it("tells the user to wait on a rate-limit 429 rather than blaming the code", () => {
    const error = new ApiError("Too Many Requests", 429, {
      retryAfter: new Date().toISOString(),
    });

    const message = resolveVerifyCodeErrorMessage(error, null);

    expect(message).toContain("wait");
    expect(message).not.toContain("Invalid");
  });
});

describe("resolveChallengeRequestErrorMessage", () => {
  it("explains the backoff on a throttled request", () => {
    const error = new ApiError("Too many", 429, {});

    expect(resolveChallengeRequestErrorMessage(error)).toContain(
      "too frequently",
    );
  });

  it("reports a send failure for anything else", () => {
    expect(resolveChallengeRequestErrorMessage(new Error("boom"))).toContain(
      "Failed to send verification code",
    );
  });
});
