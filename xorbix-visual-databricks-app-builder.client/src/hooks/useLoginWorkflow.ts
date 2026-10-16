import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIdentity } from "../context/IdentityContext";
import type { IVerificationChallengeResponse } from "../models";
import { useLogger } from "../logger/useLogger";
import {
  readRemainingAttempts,
  readRetryAfter,
  resolveChallengeRequestErrorMessage,
  resolveVerifyCodeErrorMessage,
} from "../utils/verificationChallengeErrors";
import {
  clearVerificationChallenge,
  readVerificationChallenge,
  updateVerificationChallenge,
  writeVerificationChallenge,
  type VerificationChallengeSession,
} from "../utils/verificationChallengeStorage";

const AUTO_REDIRECT_DELAY_MS = 1200;
const DEFAULT_POST_LOGIN_PATH = "/apps";

/**
 * Returns a safe internal path to redirect to after login, or the default
 * landing path. Rejects absolute URLs and protocol-relative paths to prevent
 * open-redirect attacks.
 */
function sanitizePostLoginRedirect(rawRedirect: string | null): string {
  if (!rawRedirect) return DEFAULT_POST_LOGIN_PATH;
  if (!rawRedirect.startsWith("/")) return DEFAULT_POST_LOGIN_PATH;
  if (rawRedirect.startsWith("//") || rawRedirect.startsWith("/\\")) {
    return DEFAULT_POST_LOGIN_PATH;
  }
  return rawRedirect;
}

export function useLoginWorkflow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postLoginRedirect = sanitizePostLoginRedirect(
    searchParams.get("redirect"),
  );
  const logger = useLogger("LoginWorkflow");
  const {
    user,
    isLoading,
    isLoaded,
    login,
    verifyCode,
    loginPasswordless,
    resendTwoFactorCode,
  } = useIdentity();

  const [codeDigits, setCodeDigits] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [loading, setLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expirationTime, setExpirationTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [resendAvailableAt, setResendAvailableAt] = useState<Date | null>(null);
  const [resendCooldownLeft, setResendCooldownLeft] = useState<number>(0);
  /** Server-reported attempts left on the current code; null until the server tells us. */
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null,
  );
  const [hasVisitedUnauthenticatedState, setHasVisitedUnauthenticatedState] =
    useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const shouldRedirectAuthenticated = isLoaded && !isLoading && Boolean(user);

  useEffect(() => {
    if (isLoaded && !isLoading && !user) {
      setHasVisitedUnauthenticatedState(true);
    }
  }, [isLoaded, isLoading, user]);

  useEffect(() => {
    if (!shouldRedirectAuthenticated) {
      return;
    }

    const redirectDelayMs = hasVisitedUnauthenticatedState
      ? 0
      : AUTO_REDIRECT_DELAY_MS;

    const timer = setTimeout(() => {
      navigate(postLoginRedirect, { replace: true });
    }, redirectDelayMs);

    return () => clearTimeout(timer);
  }, [
    hasVisitedUnauthenticatedState,
    navigate,
    postLoginRedirect,
    shouldRedirectAuthenticated,
  ]);

  useEffect(() => {
    if (!expirationTime) return;

    const calculateTimeLeft = () => {
      const diff = Math.max(
        0,
        Math.floor((expirationTime.getTime() - Date.now()) / 1000),
      );
      setTimeLeft(diff);
      return diff;
    };

    calculateTimeLeft();

    const timer = setInterval(() => {
      if (calculateTimeLeft() <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [expirationTime]);

  useEffect(() => {
    if (!resendAvailableAt) {
      setResendCooldownLeft(0);
      return;
    }

    const calculateResendCooldownLeft = () => {
      const diff = Math.max(
        0,
        Math.floor((resendAvailableAt.getTime() - Date.now()) / 1000),
      );
      setResendCooldownLeft(diff);
      return diff;
    };

    calculateResendCooldownLeft();

    const timer = setInterval(() => {
      if (calculateResendCooldownLeft() <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [resendAvailableAt]);

  const startCodeVerification = useCallback(
    (email: string, challenge: IVerificationChallengeResponse) => {
      writeVerificationChallenge({
        email,
        expiresAt: challenge.expiresAt,
        resendAvailableAt: challenge.resendAvailableAt,
        remainingAttempts: null,
      });
      setExpirationTime(new Date(challenge.expiresAt));
      setResendAvailableAt(new Date(challenge.resendAvailableAt));
      setRemainingAttempts(null);
      const verifyTarget =
        postLoginRedirect === DEFAULT_POST_LOGIN_PATH
          ? "/verify-code"
          : `/verify-code?redirect=${encodeURIComponent(postLoginRedirect)}`;
      navigate(verifyTarget);
    },
    [navigate, postLoginRedirect],
  );

  const initiatePasswordlessLogin = useCallback(
    async (email: string) => {
      setLoading(true);
      setError(null);
      try {
        const challenge = await loginPasswordless(email);
        startCodeVerification(email, challenge);
      } catch (error) {
        logger.handleError(error, "initiatePasswordlessLogin");
        setError(resolveChallengeRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [logger, loginPasswordless, startCodeVerification],
  );

  /**
   * Restores an in-progress challenge after a reload. Returns null when there is none or its code
   * has already expired, in which case the caller sends the user back to sign in.
   */
  const loadSession = useCallback((): VerificationChallengeSession | null => {
    const session = readVerificationChallenge();
    if (!session) {
      return null;
    }

    setExpirationTime(new Date(session.expiresAt));
    setResendAvailableAt(new Date(session.resendAvailableAt));
    // Restoring this is what keeps a spent code locked after a refresh, instead of re-enabling the
    // inputs and inviting the user to burn submissions the server will reject anyway.
    setRemainingAttempts(session.remainingAttempts);
    return session;
  }, []);

  /** Discards the stored challenge; used by the deliberate exits from the verify page. */
  const abandonCodeVerification = useCallback(() => {
    clearVerificationChallenge();
    setRemainingAttempts(null);
    setCodeDigits(["", "", "", "", "", ""]);
    setError(null);
  }, []);

  const handleCodeChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setCodeDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleCodeKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [codeDigits],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      try {
        e.preventDefault();
        const numbers = e.clipboardData
          .getData("text")
          .replace(/\D/g, "")
          .slice(0, 6);
        if (!numbers) return;
        const newDigits = ["", "", "", "", "", ""];
        for (let i = 0; i < numbers.length; i++) newDigits[i] = numbers[i];
        setCodeDigits(newDigits);
        inputRefs.current[
          numbers.length === 6 ? 5 : Math.min(numbers.length, 5)
        ]?.focus();
      } catch (error) {
        logger.handleError(error, "handlePaste");
      }
    },
    [logger],
  );

  const handleVerify = useCallback(
    async (email: string) => {
      const code = codeDigits.join("");
      if (code.length !== 6) {
        setError("Please enter the complete 6-digit code.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await verifyCode(email, code);
        clearVerificationChallenge();
        navigate(postLoginRedirect);
      } catch (error) {
        logger.handleError(error, "handleVerify");
        // The server returns 401 for a wrong code and 400 for an expired/exhausted code; both are
        // genuine, user-actionable code problems. Anything else (a network error or a 5xx from a
        // cold backend) must not be reported as an invalid code, or the user will retype a correct
        // code believing it was rejected.
        // The server owns the attempt budget and reports what is left; the client never encodes the
        // limit itself, so the two cannot drift apart.
        const serverRemainingAttempts = readRemainingAttempts(error);

        if (serverRemainingAttempts !== null) {
          setRemainingAttempts(serverRemainingAttempts);
          // Persist alongside the challenge so a refresh does not silently re-open a spent code.
          updateVerificationChallenge({
            remainingAttempts: serverRemainingAttempts,
          });
        }

        if (serverRemainingAttempts === 0) {
          setCodeDigits(["", "", "", "", "", ""]);
        }

        // verify-code sits behind the identity-anonymous backstop, so it can 429. That response carries
        // a retryAfter but no attempt budget; honour it so the resend countdown reflects the server's
        // backoff and a reload can't shorten it — mirroring handleResend.
        const retryAfter = readRetryAfter(error);
        if (retryAfter) {
          setResendAvailableAt(retryAfter);
          updateVerificationChallenge({ resendAvailableAt: retryAfter.toISOString() });
        }

        setError(resolveVerifyCodeErrorMessage(error, serverRemainingAttempts));
      } finally {
        setLoading(false);
      }
    },
    [codeDigits, logger, navigate, postLoginRedirect, verifyCode],
  );

  const handleResend = useCallback(
    async (email: string) => {
      if (resendCooldownLeft > 0 || isResending || !email.trim()) {
        return;
      }

      setIsResending(true);
      setError(null);
      try {
        const challenge = await resendTwoFactorCode(email);
        setCodeDigits(["", "", "", "", "", ""]);
        setExpirationTime(new Date(challenge.expiresAt));
        setResendAvailableAt(new Date(challenge.resendAvailableAt));
        // A fresh code carries a fresh attempt budget.
        setRemainingAttempts(null);
        writeVerificationChallenge({
          email,
          expiresAt: challenge.expiresAt,
          resendAvailableAt: challenge.resendAvailableAt,
          remainingAttempts: null,
        });
        inputRefs.current[0]?.focus();
      } catch (error) {
        logger.handleError(error, "handleResend");

        // Honour the server's backoff so the button stays disabled for exactly as long as the
        // server will keep refusing — and persist it, so a reload cannot shorten the wait.
        const retryAfter = readRetryAfter(error);
        if (retryAfter) {
          setResendAvailableAt(retryAfter);
          updateVerificationChallenge({
            resendAvailableAt: retryAfter.toISOString(),
          });
        }

        setError(resolveChallengeRequestErrorMessage(error));
      } finally {
        setIsResending(false);
      }
    },
    [isResending, logger, resendCooldownLeft, resendTwoFactorCode],
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return {
    login,
    navigate,
    isIdentityLoading: !isLoaded || isLoading || shouldRedirectAuthenticated,
    codeDigits,
    loading,
    isResending,
    error,
    setError,
    timeLeft,
    resendCooldownLeft,
    remainingAttempts,
    /** True once the server reports the current code has no attempts left. */
    isCodeLockedOut: remainingAttempts === 0,
    inputRefs,
    startCodeVerification,
    initiatePasswordlessLogin,
    loadSession,
    abandonCodeVerification,
    handleCodeChange,
    handleCodeKeyDown,
    handlePaste,
    handleVerify,
    handleResend,
    formatTime,
  };
}
