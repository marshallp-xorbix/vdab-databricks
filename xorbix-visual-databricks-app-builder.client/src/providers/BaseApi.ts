import { API_BASE_URL } from "../config/api";
import { ApiError, type IAuthResponse } from "../models";
import {
  sessionEvents,
  type SessionInvalidatedReason,
} from "../lib/sessionEvents";

export type AuthMode = "jwt" | "cookie";

export type { SessionInvalidatedReason };

export class BaseApi {
  protected baseUrl: string;
  // Access token stored in memory (safer against XSS)
  // Shared across all instances so that login via IdentityApi updates UserApi, etc.
  private static accessToken: string | null = null;

  // Refresh token stored in storage (needed to survive page reloads)
  protected refreshTokenKey = "vdab-refresh-token";

  // Track in-flight requests to prevent duplicate calls (e.g. React Strict Mode)
  private readonly pendingRequests = new Map<string, Promise<unknown>>();

  // Single-flight refresh: when multiple requests 401 in parallel, share one
  // refresh call so the server doesn't rotate the refresh token multiple times.
  // Shared across all BaseApi instances.
  private static refreshInFlight: Promise<IAuthResponse | null> | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  protected getAccessToken(): string | null {
    return BaseApi.accessToken;
  }

  public getToken(): string | null {
    return BaseApi.accessToken;
  }

  protected getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  protected setTokens(accessToken: string, refreshToken: string) {
    BaseApi.accessToken = accessToken;
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  protected clearTokens() {
    BaseApi.accessToken = null;
    localStorage.removeItem(this.refreshTokenKey);
  }

  /** Clears in-memory and stored tokens without notifying session listeners. */
  public clearLocalTokens() {
    this.clearTokens();
  }

  /**
   * Clears local auth state and notifies listeners that the session is no longer valid.
   * No-ops when tokens are already cleared (avoids duplicate toasts on concurrent 401s).
   */
  protected invalidateSession(reason: SessionInvalidatedReason) {
    if (BaseApi.accessToken === null) {
      return;
    }
    this.clearTokens();
    sessionEvents.emit(reason);
  }

  /**
   * HTTP statuses that indicate a transient backend condition (a cold database connection or a
   * warming app instance) worth retrying for idempotent operations, rather than a definitive
   * result the caller should act on.
   */
  private static isTransientStatus(status: number): boolean {
    return status === 500 || status === 502 || status === 503 || status === 504;
  }

  /** Linear backoff between retry attempts (attempt 1 → 300ms, attempt 2 → 600ms). */
  private static delayForAttempt(attempt: number): Promise<void> {
    const backoffMs = 300 * attempt;
    return new Promise((resolve) => setTimeout(resolve, backoffMs));
  }

  /**
   * Attempts to restore the session on app startup using the stored refresh token.
   * Call this when your application initializes.
   */
  public async restoreSession(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const tokens = await this.refreshAccessToken(refreshToken);
      if (tokens) {
        this.setTokens(tokens.accessToken, tokens.refreshToken);
        return true;
      }
    } catch (e) {
      console.warn("Failed to restore session", e);
    }

    this.clearTokens();
    return false;
  }

  /**
   * Performs a fetch request with automatic token attachment and refreshing.
   */
  protected async fetchWithAuth(
    endpoint: string,
    options: RequestInit = {},
    authMode: AuthMode = "jwt",
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    if (authMode === "jwt") {
      const token = this.getAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    } else {
      config.credentials = "include";
    }

    let response = await fetch(url, config);

    const isSessionRevoked =
      response.headers.get("Vdab-Session-Revoked") === "true";
    const isTokenExpired =
      response.headers.get("Vdab-Token-Expired") === "true";

    if (response.status === 401 && isSessionRevoked) {
      if (authMode === "jwt") {
        this.invalidateSession("revoked");
      }
      return response;
    }

    if (response.status === 401 && isTokenExpired) {
      if (authMode === "jwt") {
        // Token is expired, try to refresh
        const refreshToken = this.getRefreshToken();
        if (refreshToken) {
          try {
            const refreshResponse = await this.refreshAccessToken(refreshToken);
            if (refreshResponse) {
              // Update tokens
              this.setTokens(
                refreshResponse.accessToken,
                refreshResponse.refreshToken,
              );

              // Retry original request with new token
              headers.set(
                "Authorization",
                `Bearer ${refreshResponse.accessToken}`,
              );
              const newConfig = {
                ...options,
                headers,
              };
              response = await fetch(url, newConfig);
            } else {
              // Refresh failed: drop the session and notify listeners.
              this.invalidateSession("expired");
            }
          } catch (error) {
            console.error("Token refresh failed", error);
            this.invalidateSession("expired");
          }
        } else {
          this.invalidateSession("expired");
        }
      } else {
        // Cookie refresh logic
        const refreshed = await this.refreshCookieSession();
        if (refreshed) {
          response = await fetch(url, config);
        }
      }
    }

    return response;
  }

  protected async refreshCookieSession(): Promise<boolean> {
    // Placeholder for cookie-based refresh logic
    return false;
  }

  /**
   * Generic GET request
   */
  protected async get<T>(
    endpoint: string,
    options: RequestInit = {},
    authMode: AuthMode = "jwt",
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" }, authMode);
  }

  /**
   * Generic POST request
   */
  protected async post<T>(
    endpoint: string,
    body?: unknown,
    options: RequestInit = {},
    authMode: AuthMode = "jwt",
  ): Promise<T> {
    const config = { ...options, method: "POST" };
    if (body !== undefined) {
      config.body = JSON.stringify(body);
    }
    return this.request<T>(endpoint, config, authMode);
  }

  /**
   * Generic PUT request
   */
  protected async put<T>(
    endpoint: string,
    body?: unknown,
    options: RequestInit = {},
    authMode: AuthMode = "jwt",
  ): Promise<T> {
    const config = { ...options, method: "PUT" };
    if (body !== undefined) {
      config.body = JSON.stringify(body);
    }
    return this.request<T>(endpoint, config, authMode);
  }

  /**
   * Generic PATCH request
   */
  protected async patch<T>(
    endpoint: string,
    body?: unknown,
    options: RequestInit = {},
    authMode: AuthMode = "jwt",
  ): Promise<T> {
    const config = { ...options, method: "PATCH" };
    if (body !== undefined) {
      config.body = JSON.stringify(body);
    }
    return this.request<T>(endpoint, config, authMode);
  }

  /**
   * Generic DELETE request
   */
  protected async delete<T>(
    endpoint: string,
    options: RequestInit = {},
    authMode: AuthMode = "jwt",
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      { ...options, method: "DELETE" },
      authMode,
    );
  }

  /**
   * Internal helper to execute request and handle response parsing
   */
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authMode: AuthMode = "jwt",
  ): Promise<T> {
    // Create a unique key for this request to prevent duplicate in-flight requests.
    // Only a string body yields a stable key; a non-string body (FormData, Blob, etc.)
    // stringifies to "[object Object]" and would wrongly collapse distinct requests, so
    // such requests are never deduplicated.
    const method = options.method || "GET";
    const hasNonStringBody =
      options.body != null && typeof options.body !== "string";
    const bodyKey = typeof options.body === "string" ? options.body : "";
    const requestKey = `${method}:${endpoint}:${bodyKey}`;

    const canDeduplicate = !options.signal && !hasNonStringBody;

    if (canDeduplicate && this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey) as Promise<T>;
    }

    const isIdempotent = method === "GET";
    // Initial attempt plus bounded retries for idempotent reads, so a transient backend hiccup
    // (e.g. a cold database connection surfacing as a 5xx) is absorbed here instead of forcing
    // every caller to recover from it. Mutations are never retried automatically.
    const maxAttempts = isIdempotent ? 3 : 1;

    const requestPromise = (async () => {
      try {
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await this.executeAttempt<T>(endpoint, options, authMode);
          } catch (error) {
            lastError = error;
            // Only idempotent reads retry, and only on a transient condition: a network-level
            // failure (not an ApiError) or a 5xx. A definitive 4xx is surfaced immediately.
            const isRetryable =
              isIdempotent &&
              attempt < maxAttempts &&
              (!(error instanceof ApiError) ||
                BaseApi.isTransientStatus(error.status));
            if (!isRetryable) {
              throw error;
            }
            await BaseApi.delayForAttempt(attempt);
          }
        }
        throw lastError;
      } finally {
        if (canDeduplicate) {
          this.pendingRequests.delete(requestKey);
        }
      }
    })();

    if (canDeduplicate) {
      this.pendingRequests.set(requestKey, requestPromise);
    }

    return requestPromise;
  }

  /**
   * Performs a single request attempt: fetches (with auth + token-refresh handling) and either
   * returns the parsed body or throws an {@link ApiError} carrying the HTTP status. Retry policy
   * lives in {@link request}; this method intentionally does not retry.
   */
  private async executeAttempt<T>(
    endpoint: string,
    options: RequestInit,
    authMode: AuthMode,
  ): Promise<T> {
    const response = await this.fetchWithAuth(endpoint, options, authMode);

    if (!response.ok) {
      let errorData: unknown = null;
      try {
        const text = await response.text();
        if (text) {
          try {
            errorData = JSON.parse(text);
          } catch {
            errorData = text;
          }
        }
      } catch {
        // ignore error parsing failure
      }
      throw new ApiError(
        response.statusText || "Request failed",
        response.status,
        errorData,
      );
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const text = await response.text();
    if (!text) return undefined as unknown as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  private async refreshAccessToken(
    refreshToken: string,
  ): Promise<IAuthResponse | null> {
    // Single-flight: if a refresh is already in progress, await the same promise.
    // Prevents duplicate rotation rows when several requests 401 simultaneously.
    if (BaseApi.refreshInFlight) {
      return BaseApi.refreshInFlight;
    }

    const inFlight = (async (): Promise<IAuthResponse | null> => {
      const url = `${this.baseUrl}/api/Identity/token/refresh`;
      // Retry only on transient failures (network error or 5xx). A 4xx means the refresh token
      // was definitively rejected (expired/revoked) — retrying cannot help and would only delay
      // the inevitable sign-out, so stop immediately and let the caller clear the session.
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });

          if (response.ok) {
            return await response.json();
          }

          if (!BaseApi.isTransientStatus(response.status)) {
            return null;
          }
        } catch (error) {
          console.error("Error refreshing token", error);
        }

        if (attempt < maxAttempts) {
          await BaseApi.delayForAttempt(attempt);
        }
      }
      return null;
    })();

    BaseApi.refreshInFlight = inFlight;
    try {
      return await inFlight;
    } finally {
      // Clear only if this is still the current promise (defensive against races).
      if (BaseApi.refreshInFlight === inFlight) {
        BaseApi.refreshInFlight = null;
      }
    }
  }
}
