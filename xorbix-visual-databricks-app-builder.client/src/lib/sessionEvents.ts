/**
 * Decoupled session-invalidation events between the HTTP layer and UI state.
 * BaseApi emits; IdentityContext (and tests) subscribe.
 */

export type SessionInvalidatedReason = "revoked" | "expired";

type SessionInvalidatedListener = (reason: SessionInvalidatedReason) => void;

const listeners = new Set<SessionInvalidatedListener>();

export const sessionEvents = {
  /**
   * Notifies all subscribers that the local session is no longer valid.
   */
  emit(reason: SessionInvalidatedReason): void {
    for (const listener of listeners) {
      listener(reason);
    }
  },

  /**
   * Subscribes to session invalidation. Returns an unsubscribe function.
   */
  subscribe(listener: SessionInvalidatedListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
