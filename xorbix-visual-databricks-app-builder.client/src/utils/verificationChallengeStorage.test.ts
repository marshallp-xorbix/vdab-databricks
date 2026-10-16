import { beforeEach, describe, expect, it } from "vitest";
import {
  clearVerificationChallenge,
  readVerificationChallenge,
  updateVerificationChallenge,
  writeVerificationChallenge,
  type VerificationChallengeSession,
} from "./verificationChallengeStorage";

const STORAGE_KEY = "vdab_auth_verify";

function futureSession(
  overrides: Partial<VerificationChallengeSession> = {},
): VerificationChallengeSession {
  return {
    email: "user@example.com",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 60 * 1000).toISOString(),
    remainingAttempts: null,
    ...overrides,
  };
}

describe("verificationChallengeStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips a live challenge, which is what survives a page refresh", () => {
    writeVerificationChallenge(futureSession());

    const restored = readVerificationChallenge();

    expect(restored?.email).toBe("user@example.com");
  });

  it("restores the remaining-attempt budget so a refresh cannot re-open a spent code", () => {
    writeVerificationChallenge(futureSession({ remainingAttempts: 0 }));

    expect(readVerificationChallenge()?.remainingAttempts).toBe(0);
  });

  it("returns null when nothing is stored", () => {
    expect(readVerificationChallenge()).toBeNull();
  });

  it("rejects a challenge whose code has already expired", () => {
    writeVerificationChallenge(
      futureSession({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    );

    expect(readVerificationChallenge()).toBeNull();
  });

  it("clears an expired challenge rather than leaving the email behind", () => {
    writeVerificationChallenge(
      futureSession({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    );

    readVerificationChallenge();

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("rejects a malformed expiry", () => {
    writeVerificationChallenge(futureSession({ expiresAt: "not-a-date" }));

    expect(readVerificationChallenge()).toBeNull();
  });

  it("rejects a record with no email", () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ expiresAt: "x" }));

    expect(readVerificationChallenge()).toBeNull();
  });

  it("survives corrupt JSON without throwing", () => {
    sessionStorage.setItem(STORAGE_KEY, "{ not json");

    expect(() => readVerificationChallenge()).not.toThrow();
    expect(readVerificationChallenge()).toBeNull();
  });

  it("tolerates a legacy record that predates the resend cooldown", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        email: "user@example.com",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );

    const restored = readVerificationChallenge();

    // Falls back to "resend available now" and lets the server's 429 be the authority.
    expect(restored?.email).toBe("user@example.com");
    expect(restored?.remainingAttempts).toBeNull();
    expect(new Date(restored!.resendAvailableAt).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it("merges a partial update without disturbing the rest of the record", () => {
    writeVerificationChallenge(futureSession());

    updateVerificationChallenge({ remainingAttempts: 2 });

    const restored = readVerificationChallenge();
    expect(restored?.remainingAttempts).toBe(2);
    expect(restored?.email).toBe("user@example.com");
  });

  it("no-ops an update when no challenge is stored", () => {
    updateVerificationChallenge({ remainingAttempts: 1 });

    expect(readVerificationChallenge()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clears the stored challenge", () => {
    writeVerificationChallenge(futureSession());

    clearVerificationChallenge();

    expect(readVerificationChallenge()).toBeNull();
  });
});
