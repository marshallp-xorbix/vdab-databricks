import { BaseApi } from "./BaseApi";
import type {
  IAddUserRequest,
  IApplicationUser,
  IChangeEmailRequest,
  IManageUserRolesRequest,
  IRevokeSessionResponse,
  IUpdateUserRequest,
  IUpdateUserSettingsRequest,
  IUserInfo,
  IUserSessionsResponse,
} from "../models";

/**
 * API client for User management operations
 */
export class UserApi extends BaseApi {
  /**
   * Gets all users
   */
  async getUsers(): Promise<IApplicationUser[]> {
    return this.get<IApplicationUser[]>("/api/User");
  }

  /**
   * Gets soft-deleted (retired) users that have not been anonymized.
   * Global administrators only.
   */
  async getRetiredUsers(): Promise<IApplicationUser[]> {
    return this.get<IApplicationUser[]>("/api/User/retired");
  }

  /**
   * Gets all active users
   */
  async getActiveUsers(): Promise<IUserInfo[]> {
    return this.get<IUserInfo[]>("/api/User/active");
  }

  /**
   * Gets the active users belonging to the caller's current tenant.
   */
  async getActiveUsersForTenant(): Promise<IUserInfo[]> {
    return this.get<IUserInfo[]>("/api/User/active/tenant");
  }

  /**
   * Adds a new user with specified roles
   */
  async addUser(request: IAddUserRequest): Promise<IApplicationUser> {
    return this.post<IApplicationUser>("/api/User", request);
  }

  /**
   * Gets a user by ID
   */
  async getUser(id: string): Promise<IApplicationUser> {
    return this.get<IApplicationUser>(`/api/User/${id}`);
  }

  /**
   * Updates a user's information
   */
  async updateUser(
    id: string,
    request: IUpdateUserRequest,
  ): Promise<IApplicationUser> {
    return this.put<IApplicationUser>(`/api/User/${id}`, request);
  }

  /**
   * Deactivates a user account
   */
  async deactivateUser(id: string): Promise<void> {
    return this.delete<void>(`/api/User/${id}`);
  }

  /**
   * Enables two-factor authentication for a user account
   */
  async enable2FA(id: string): Promise<void> {
    return this.post<void>(`/api/User/${id}/2fa/enable`);
  }

  /**
   * Disables two-factor authentication for a user account
   */
  async disable2FA(id: string): Promise<void> {
    return this.post<void>(`/api/User/${id}/2fa/disable`);
  }

  /**
   * Initiates email change for a user
   */
  async changeEmail(id: string, request: IChangeEmailRequest): Promise<void> {
    return this.put<void>(`/api/User/${id}/email`, request);
  }

  /**
   * Re-sends the email confirmation for a user
   */
  async resendConfirmation(id: string): Promise<void> {
    return this.post<void>(`/api/User/${id}/email/resend-confirmation`);
  }

  /**
   * Initiates an admin-initiated password reset for a user
   */
  async initiatePasswordReset(id: string): Promise<void> {
    return this.post<void>(`/api/User/${id}/password/reset`);
  }

  /**
   * Gets the roles assigned to a specific user
   */
  async getUserRoles(id: string): Promise<string[]> {
    return this.get<string[]>(`/api/User/${id}/roles`);
  }

  /**
   * Manages user roles by adding and/or removing specified roles
   */
  async manageUserRoles(
    id: string,
    request: IManageUserRolesRequest,
  ): Promise<string[]> {
    return this.put<string[]>(`/api/User/${id}/roles`, request);
  }

  /**
   * Forces logout on all devices by invalidating all tokens and sessions
   */
  async forceLogoutAllDevices(id: string): Promise<void> {
    return this.delete<void>(`/api/User/${id}/sessions`);
  }

  /**
   * Gets paginated sessions for a user
   */
  async getUserSessions(
    id: string,
    skip: number = 0,
    take: number = 25,
    activeOnly: boolean = true,
  ): Promise<IUserSessionsResponse> {
    return this.get<IUserSessionsResponse>(
      `/api/User/${id}/sessions?skip=${skip}&take=${take}&activeOnly=${activeOnly}`,
    );
  }

  /**
   * Revokes a specific user session
   */
  async revokeSession(
    userId: string,
    sessionId: number,
  ): Promise<IRevokeSessionResponse> {
    return this.delete<IRevokeSessionResponse>(
      `/api/User/${userId}/sessions/${sessionId}`,
    );
  }

  /**
   * Locks a user account
   */
  async lockUser(id: string): Promise<void> {
    return this.post<void>(`/api/User/${id}/lock`);
  }

  /**
   * Unlocks a user account
   */
  async unlockUser(id: string): Promise<void> {
    return this.post<void>(`/api/User/${id}/unlock`);
  }

  /**
   * Restores a previously deactivated or retired user account
   */
  async reactivateUser(id: string): Promise<void> {
    return this.post<void>(`/api/User/${id}/reactivate`);
  }

  /**
   * Updates a user's account settings (security and notification preferences)
   */
  async updateUserSettings(
    id: string,
    request: IUpdateUserSettingsRequest,
  ): Promise<IApplicationUser> {
    return this.put<IApplicationUser>(`/api/User/${id}/settings`, request);
  }

  /**
   * Soft-deletes a user, freeing their email for re-registration
   */
  async softDeleteUser(id: string): Promise<void> {
    return this.delete<void>(`/api/User/${id}/soft-delete`);
  }

  /**
   * Permanently purges all data associated with a user (GDPR)
   */
  async purgeUserData(id: string): Promise<void> {
    return this.delete<void>(`/api/User/${id}/purge`);
  }
}

// Export a singleton instance
export const userApi = new UserApi();
