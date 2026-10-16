import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { identityApi } from "../providers/IdentityApi";
import type {
  IAuthResponse,
  IVerificationChallengeResponse,
  UserProfileResponse,
} from "../models";
import { setAuthenticatedUser, clearAuthenticatedUser } from "../telemetry";
import { useLogger } from "../logger/useLogger";
import { toast } from "../components/ui/use-toast";
import {
  sessionEvents,
  type SessionInvalidatedReason,
} from "../lib/sessionEvents";
import { clearVerificationChallenge } from "../utils/verificationChallengeStorage";

export type SignOutOptions = {
  /** When set, navigates here after local auth state is cleared. */
  redirectTo?: string;
};

type IdentityContextValue = {
  user: UserProfileResponse | null;
  isLoading: boolean;
  isLoaded: boolean;
  signup: (
    email: string,
    password?: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>;
  login: (email: string, password?: string) => Promise<IAuthResponse>;
  loginPasswordless: (email: string) => Promise<IVerificationChallengeResponse>;
  resendTwoFactorCode: (
    email: string,
  ) => Promise<IVerificationChallengeResponse>;
  verifyCode: (email: string, code: string) => Promise<void>;
  /**
   * Establishes a session from a pre-issued auth response (e.g. the auto-login granted on email confirmation
   * in passwordless-only mode), then loads the current user into context.
   */
  applySession: (authResponse: IAuthResponse) => Promise<void>;
  /**
   * Reloads the signed-in profile from the API (tenant id/role, roles, etc.).
   * Used after tenant switches so UI state matches the new JWT context.
   */
  refreshCurrentUser: () => Promise<void>;
  logout: (options?: SignOutOptions) => Promise<void>;
  logoutAll: (options?: SignOutOptions) => Promise<void>;
  /**
   * Clears local tokens and user state without calling the server.
   * Use when the server has already invalidated the session.
   */
  clearLocalSession: (options?: SignOutOptions) => void;
};

const IdentityContext = createContext<IdentityContextValue | undefined>(
  undefined,
);

type IdentityProviderProps = {
  children: ReactNode;
};

export function IdentityProvider({
  children,
}: Readonly<IdentityProviderProps>) {
  const logger = useLogger("IdentityProvider");
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const currentUser: UserProfileResponse =
        await identityApi.getCurrentUser();
      setUser(currentUser);
      setAuthenticatedUser(String(currentUser.userId), currentUser.email);
    } catch (error) {
      logger.handleError(error, "fetchCurrentUser");
      setUser(null);
      clearAuthenticatedUser();
    }
  }, []);

  useEffect(() => {
    const handleSessionInvalidated = (reason: SessionInvalidatedReason) => {
      clearAuthenticatedUser();
      setUser(null);
      // Same reasoning as finishLocalSignOut; this path does not run through it.
      clearVerificationChallenge();
      toast({
        title: "Session ended",
        description:
          reason === "revoked"
            ? "Your session was ended. Please sign in again."
            : "Your session has expired. Please sign in again.",
        variant: "destructive",
      });
    };

    const unsubscribe = sessionEvents.subscribe(handleSessionInvalidated);

    const initSession = async () => {
      try {
        const restored = await identityApi.restoreSession();
        if (restored) {
          await fetchCurrentUser();
        }
      } catch (error) {
        logger.handleError(error, "initSession");
      } finally {
        setIsLoading(false);
        setIsLoaded(true);
      }
    };

    initSession();

    return unsubscribe;
  }, []);

  const finishLocalSignOut = useCallback(
    (options?: SignOutOptions) => {
      clearAuthenticatedUser();
      setUser(null);
      // Signing out must not leave a half-finished sign-in behind: the stored challenge holds the
      // outgoing user's email address, which would otherwise be rendered to whoever uses this tab next.
      clearVerificationChallenge();
      if (options?.redirectTo) {
        navigate(options.redirectTo, { replace: true });
      }
    },
    [navigate],
  );

  const clearLocalSession = useCallback(
    (options?: SignOutOptions) => {
      identityApi.clearLocalTokens();
      finishLocalSignOut(options);
    },
    [finishLocalSignOut],
  );

  const signup = useCallback(
    async (
      email: string,
      password?: string,
      firstName: string = "",
      lastName: string = "",
    ) => {
      if (!password) throw new Error("Password is required for registration");
      try {
        await identityApi.register({ email, password, firstName, lastName });
      } catch (error) {
        logger.handleError(error, "signup");
        throw error;
      }
    },
    [],
  );

  const login = useCallback(
    async (email: string, password?: string) => {
      if (!password) throw new Error("Password is required for login");
      try {
        const response = await identityApi.login({ email, password });
        if (!response.twoFactorRequired) {
          await fetchCurrentUser();
        }
        return response;
      } catch (error) {
        logger.handleError(error, "login");
        throw error;
      }
    },
    [fetchCurrentUser],
  );

  const loginPasswordless = useCallback(async (email: string) => {
    try {
      return await identityApi.passwordlessSignIn({ email });
    } catch (error) {
      logger.handleError(error, "loginPasswordless");
      throw error;
    }
  }, []);

  const resendTwoFactorCode = useCallback(async (email: string) => {
    try {
      return await identityApi.resendTwoFactorCode({ email });
    } catch (error) {
      logger.handleError(error, "resendTwoFactorCode");
      throw error;
    }
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      try {
        await identityApi.verifyCode({ email, code });
      } catch (error) {
        logger.handleError(error, "verifyCode");
        throw error;
      }

      await fetchCurrentUser();
    },
    [fetchCurrentUser],
  );

  const applySession = useCallback(
    async (authResponse: IAuthResponse) => {
      identityApi.applyAuthResponse(authResponse);
      await fetchCurrentUser();
    },
    [fetchCurrentUser],
  );

  const refreshCurrentUser = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  const logout = useCallback(
    async (options?: SignOutOptions) => {
      try {
        await identityApi.logout();
      } catch (error) {
        logger.handleError(error, "logout");
      } finally {
        finishLocalSignOut(options);
      }
    },
    [finishLocalSignOut],
  );

  const logoutAll = useCallback(
    async (options?: SignOutOptions) => {
      try {
        await identityApi.logoutAll();
      } catch (error) {
        logger.handleError(error, "logoutAll");
      } finally {
        finishLocalSignOut(options);
      }
    },
    [finishLocalSignOut],
  );

  const value = useMemo<IdentityContextValue>(
    () => ({
      user,
      isLoading,
      isLoaded,
      signup,
      login,
      loginPasswordless,
      resendTwoFactorCode,
      verifyCode,
      applySession,
      refreshCurrentUser,
      logout,
      logoutAll,
      clearLocalSession,
    }),
    [
      user,
      isLoading,
      isLoaded,
      signup,
      login,
      loginPasswordless,
      resendTwoFactorCode,
      verifyCode,
      applySession,
      refreshCurrentUser,
      logout,
      logoutAll,
      clearLocalSession,
    ],
  );

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx)
    throw new Error("useIdentity must be used within an IdentityProvider");
  return ctx;
}
