import type { ClipboardEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../models";
import {
  readVerificationChallenge,
  writeVerificationChallenge,
  type VerificationChallengeSession,
} from "../../utils/verificationChallengeStorage";
import { useLoginWorkflow } from "../useLoginWorkflow";

// The hook reads its API calls off the identity context, not the api module, so mock the context. The
// fns are hoisted so the vi.mock factory can close over them (per Vitest's hoisting rules).
const { verifyCode, resendTwoFactorCode, loginPasswordless } = vi.hoisted(() => ({
  verifyCode: vi.fn(),
  resendTwoFactorCode: vi.fn(),
  loginPasswordless: vi.fn(),
}));

vi.mock("../../context/IdentityContext", () => ({
  useIdentity: () => ({
    user: null,
    isLoading: false,
    isLoaded: true, // no auth redirect fires while user is null and identity is loaded
    login: vi.fn(),
    verifyCode,
    resendTwoFactorCode,
    loginPasswordless,
  }),
}));

// useLogger reaches for SettingsProvider, which isn't mounted here; stub it to just the used surface.
vi.mock("../../logger/useLogger", () => ({
  useLogger: () => ({
    handleError: vi.fn(),
    UI: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), get: vi.fn(() => []), clear: vi.fn() },
    AI: { info: vi.fn(), warning: vi.fn(), error: vi.fn(), event: vi.fn() },
  }),
}));

const email = "user@example.com";

/** A live challenge in storage. `updateVerificationChallenge` no-ops unless a record already exists. */
function seedSession(overrides: Partial<VerificationChallengeSession> = {}): void {
  writeVerificationChallenge({
    email,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    resendAvailableAt: new Date(Date.now() - 1000).toISOString(),
    remainingAttempts: null,
    ...overrides,
  });
}

function pasteEvent(text: string): ClipboardEvent<HTMLInputElement> {
  return {
    preventDefault: () => {},
    clipboardData: { getData: () => text },
  } as unknown as ClipboardEvent<HTMLInputElement>;
}

function renderWorkflow() {
  return renderHook(() => useLoginWorkflow(), {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useLoginWorkflow", () => {
  it("persists the server remaining-attempt budget on a rejected code, so a refresh cannot re-open a spent code", async () => {
    seedSession();
    verifyCode.mockRejectedValueOnce(new ApiError("Unauthorized", 401, { remainingAttempts: 2 }));

    const { result } = renderWorkflow();
    act(() => result.current.handlePaste(pasteEvent("123456")));
    await act(async () => {
      await result.current.handleVerify(email);
    });

    expect(result.current.remainingAttempts).toBe(2);
    // The realized guarantee: the persisted challenge now carries the spent-down budget.
    expect(readVerificationChallenge()?.remainingAttempts).toBe(2);
  });

  it("clears the code inputs once the server reports the budget is spent", async () => {
    seedSession();
    verifyCode.mockRejectedValueOnce(new ApiError("Bad Request", 400, { remainingAttempts: 0 }));

    const { result } = renderWorkflow();
    act(() => result.current.handlePaste(pasteEvent("123456")));
    await act(async () => {
      await result.current.handleVerify(email);
    });

    expect(result.current.remainingAttempts).toBe(0);
    expect(result.current.codeDigits).toEqual(["", "", "", "", "", ""]);
    expect(readVerificationChallenge()?.remainingAttempts).toBe(0);
  });

  it("persists the server retry-after on a throttled resend, so a reload cannot shorten the backoff", async () => {
    seedSession();
    const retryAfterIso = new Date(Date.now() + 60 * 1000).toISOString();
    resendTwoFactorCode.mockRejectedValueOnce(
      new ApiError("Too Many Requests", 429, { retryAfter: retryAfterIso }),
    );

    const { result } = renderWorkflow();
    await act(async () => {
      await result.current.handleResend(email);
    });

    expect(readVerificationChallenge()?.resendAvailableAt).toBe(retryAfterIso);
  });

  it("persists the server retry-after when verify is throttled, so the backstop 429 drives the countdown", async () => {
    seedSession();
    const retryAfterIso = new Date(Date.now() + 60 * 1000).toISOString();
    verifyCode.mockRejectedValueOnce(
      new ApiError("Too Many Requests", 429, { retryAfter: retryAfterIso }),
    );

    const { result } = renderWorkflow();
    act(() => result.current.handlePaste(pasteEvent("123456")));
    await act(async () => {
      await result.current.handleVerify(email);
    });

    expect(readVerificationChallenge()?.resendAvailableAt).toBe(retryAfterIso);
  });
});
