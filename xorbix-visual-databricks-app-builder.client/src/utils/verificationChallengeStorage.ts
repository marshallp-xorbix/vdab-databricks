/**
 * Single owner of the persisted passwordless / 2FA challenge.
 *
 * Deliberately `sessionStorage`, not `localStorage`: the challenge is scoped to one tab and the code
 * behind it lives ~5 minutes. sessionStorage already survives refresh, hard reload, and in-tab
 * navigation, which is the case worth surviving. localStorage would additionally keep the user's
 * email on disk after the tab closes — indefinitely, since only a successful sign-in or a deliberate
 * exit clears it — and would let two tabs racing on this single global key overwrite each other.
 */

const STORAGE_KEY = "vdab_auth_verify";

export interface VerificationChallengeSession {
  email: string;
  /** ISO-8601 UTC. When the issued code stops being accepted. */
  expiresAt: string;
  /** ISO-8601 UTC. Server-issued backoff; when another code may be requested. */
  resendAvailableAt: string;
  /** Server-reported submissions left on this code; null until the server has reported one. */
  remainingAttempts: number | null;
}

/**
 * Reads the raw stored record without validating freshness. Used for merge-updates, where a record
 * that has just expired should still accept a write rather than silently dropping it.
 */
function readRaw(): Partial<VerificationChallengeSession> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<VerificationChallengeSession>;
  } catch {
    // Unavailable (private mode, blocked storage) or corrupt JSON. Neither is user-actionable — the
    // caller simply behaves as though no challenge is in progress.
    return null;
  }
}

/**
 * Reads the active challenge, or null when there is none, it is malformed, or its code has already
 * expired. An expired record is cleared on the way out so a stale email does not linger.
 */
export function readVerificationChallenge(): VerificationChallengeSession | null {
  const stored = readRaw();
  if (!stored?.email || typeof stored.email !== "string") {
    return null;
  }

  const expiresAt = new Date(stored.expiresAt ?? "");
  if (Number.isNaN(expiresAt.getTime())) {
    clearVerificationChallenge();
    return null;
  }

  // Freshness, not just parseability: a past-dated record would otherwise strand the user on a
  // verify page for a code that can no longer be accepted.
  if (expiresAt.getTime() <= Date.now()) {
    clearVerificationChallenge();
    return null;
  }

  // Records written before the server drove the cooldown carry no usable value; treating resend as
  // immediately available lets the server's 429 be the authority.
  const resendAvailableAt = new Date(stored.resendAvailableAt ?? "");
  const resolvedResendAvailableAt = Number.isNaN(resendAvailableAt.getTime())
    ? new Date()
    : resendAvailableAt;

  return {
    email: stored.email,
    expiresAt: expiresAt.toISOString(),
    resendAvailableAt: resolvedResendAvailableAt.toISOString(),
    remainingAttempts:
      typeof stored.remainingAttempts === "number"
        ? stored.remainingAttempts
        : null,
  };
}

/** Replaces the stored challenge. Used when a new code is issued. */
export function writeVerificationChallenge(
  session: VerificationChallengeSession,
): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable; the challenge simply will not survive a reload.
  }
}

/**
 * Merges a partial update into the stored challenge, leaving the rest intact. No-ops when nothing is
 * stored, so it can be called unconditionally from error paths.
 */
export function updateVerificationChallenge(
  patch: Partial<VerificationChallengeSession>,
): void {
  const stored = readRaw();
  if (!stored) return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, ...patch }));
  } catch {
    // Storage unavailable; the update is simply not persisted.
  }
}

/**
 * Discards the challenge. Called on successful sign-in, on every deliberate exit from the verify
 * flow, and on sign-out — the last of which stops a previous user's email address from being
 * rendered to whoever uses the tab next.
 */
export function clearVerificationChallenge(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable; there is nothing persisted to clear.
  }
}
