import { BaseApi } from "./BaseApi";
import { AccountSetupStatus, UserProfileResponse } from "../models";
import type {
  IAccountSetupStatus,
  IAuthResponse,
  IChangeEmailRequest,
  IChangePasswordRequest,
  IConfirmEmailRequest,
  IConfirmEmailResponse,
  IEmailRequest,
  ILoginRequest,
  IRefreshTokenRequest,
  IRegisterRequest,
  IResetPasswordRequest,
  IUpdateProfileRequest,
  IUpdateUserSettingsRequest,
  IUserProfileResponse,
  IVerificationChallengeResponse,
  IVerifyCodeRequest,
} from "../models";

/**
 * API client for Identity and Authentication operations
 */
export class IdentityApi extends BaseApi {
  /**
   * Registers a new user account
   */
  async register(request: IRegisterRequest): Promise<string> {
    return this.post<string>("/api/Identity/register", request);
  }

  /**
   * Confirms a user's email address
   */
  async confirmEmail(
    request: IConfirmEmailRequest,
  ): Promise<IConfirmEmailResponse> {
    return this.post<IConfirmEmailResponse>(
      "/api/Identity/register/confirm-email",
      request,
    );
  }

  /**
   * Re-sends the email confirmation link
   */
  async resendConfirmation(request: IEmailRequest): Promise<void> {
    await this.post("/api/Identity/register/resend-confirmation", request);
  }

  /**
   * Authenticates a user and returns JWT tokens
   */
  async login(request: ILoginRequest): Promise<IAuthResponse> {
    const data = await this.post<IAuthResponse>("/api/Identity/login", request);
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  /**
   * Applies a complete auth response to the current session token store.
   */
  applyAuthResponse(response: IAuthResponse): void {
    this.setTokens(response.accessToken, response.refreshToken);
  }

  /**
   * Initiates passwordless authentication
   */
  async passwordlessSignIn(
    request: IEmailRequest,
  ): Promise<IVerificationChallengeResponse> {
    return this.post<IVerificationChallengeResponse>(
      "/api/Identity/passwordless/login",
      request,
    );
  }

  /**
   * Resends the two-factor authentication code
   */
  async resendTwoFactorCode(
    request: IEmailRequest,
  ): Promise<IVerificationChallengeResponse> {
    return this.post<IVerificationChallengeResponse>(
      "/api/Identity/2fa/resend",
      request,
    );
  }

  /**
   * Verifies an authentication code (2FA or passwordless)
   */
  async verifyCode(request: IVerifyCodeRequest): Promise<IAuthResponse> {
    const data = await this.post<IAuthResponse>(
      "/api/Identity/verify-code",
      request,
    );
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  /**
   * Refreshes the JWT access token
   */
  async refreshToken(request: IRefreshTokenRequest): Promise<IAuthResponse> {
    const data = await this.post<IAuthResponse>(
      "/api/Identity/token/refresh",
      request,
    );
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  /**
   * Logs out the current session by revoking the refresh token associated with this device.
   * Other active sessions on other devices remain valid.
   * Clears local tokens before the server call so a concurrent session-revoked 401 cannot toast.
   */
  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    const accessToken = this.getAccessToken();
    this.clearTokens();

    if (!refreshToken || !accessToken) {
      return;
    }

    try {
      await fetch(`${this.baseUrl}/api/Identity/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Best-effort server revoke; local session is already cleared.
    }
  }

  /**
   * Logs the current user out of every device by revoking all refresh tokens
   * and rotating the user's security stamp on the server.
   * Clears local tokens before the server call so a concurrent session-revoked 401 cannot toast.
   */
  async logoutAll(): Promise<void> {
    const accessToken = this.getAccessToken();
    this.clearTokens();

    if (!accessToken) {
      return;
    }

    try {
      await fetch(`${this.baseUrl}/api/Identity/logout/all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      // Best-effort server revoke; local session is already cleared.
    }
  }

  /**
   * Initiates password reset
   */
  async forgotPassword(request: IEmailRequest): Promise<void> {
    await this.post("/api/Identity/password/forgot", request);
  }

  /**
   * Resets a user's password
   */
  async resetPassword(request: IResetPasswordRequest): Promise<void> {
    await this.post("/api/Identity/password/reset", request);
  }

  /**
   * Checks whether a user already has a password set for account setup flow
   */
  async isPasswordAlreadySet(userId: string): Promise<boolean> {
    const params = new URLSearchParams({
      userId,
    });

    return this.get<boolean>(
      `/api/Identity/password/status?${params.toString()}`,
    );
  }

  /**
   * Gets the account setup completion status for the authenticated user
   */
  async getAccountSetupStatus(
    signal?: AbortSignal,
  ): Promise<AccountSetupStatus> {
    const data = await this.get<IAccountSetupStatus>(
      "/api/Identity/account-setup-status",
      { signal },
    );
    return new AccountSetupStatus(data);
  }

  /**
   * Records the authenticated user's acceptance of the current Terms of Service
   * and/or Privacy Policy version(s).
   */
  async acceptPolicies(body: {
    acceptTermsOfService: boolean;
    acceptPrivacyPolicy: boolean;
  }): Promise<void> {
    await this.post("/api/Identity/accept-policies", body);
  }

  /**
   * Gets the current authenticated user's profile including settings and metadata
   */
  async getCurrentUser(): Promise<UserProfileResponse> {
    const data = await this.get<IUserProfileResponse>("/api/Identity/profile");
    return new UserProfileResponse(data);
  }

  /**
   * Updates the authenticated user's profile
   */
  async updateProfile(request: IUpdateProfileRequest): Promise<void> {
    await this.put("/api/Identity/profile", request);
  }

  /**
   * Changes the authenticated user's password
   */
  async changePassword(request: IChangePasswordRequest): Promise<void> {
    await this.post("/api/Identity/profile/password", request);
  }

  /**
   * Initiates email change for the authenticated user
   */
  async changeEmail(request: IChangeEmailRequest): Promise<void> {
    await this.post("/api/Identity/profile/email", request);
  }

  /**
   * Confirms email change
   */
  async confirmEmailChange(
    userId: string,
    newEmail: string,
    token: string,
  ): Promise<void> {
    const params = new URLSearchParams({
      userId,
      newEmail,
      token,
    });

    await this.post(`/api/Identity/profile/email/confirm?${params.toString()}`);
  }

  /**
   * Enables two-factor authentication
   */
  async enable2FA(): Promise<void> {
    await this.post("/api/Identity/profile/2fa/enable");
  }

  /**
   * Disables two-factor authentication
   */
  async disable2FA(): Promise<void> {
    await this.post("/api/Identity/profile/2fa/disable");
  }

  /**
   * Updates the authenticated user's account settings (security and notification preferences)
   */
  async updateSettings(request: IUpdateUserSettingsRequest): Promise<void> {
    await this.put("/api/Identity/profile/settings", request);
  }
}

// Export a singleton instance
export const identityApi = new IdentityApi();
