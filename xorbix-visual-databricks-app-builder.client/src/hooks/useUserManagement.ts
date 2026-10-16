import { useState, useCallback } from "react";
import { userApi } from "../providers/UserApi";
import { managementApi } from "../providers/ManagementApi";
import {
  ApplicationUser,
  UpdateUserRequest,
  UpdateUserSettingsRequest,
} from "../models";
import { toast } from "../components/ui/use-toast";
import type {
  IAddUserRequest,
  IManageUserRolesRequest,
  IUpdateUserRequest,
  IUpdateUserSettingsRequest,
} from "../models";
import { parseError } from "../lib/utils";
import { useLogger } from "../logger/useLogger";
import { useIdentity } from "../context/IdentityContext";

/**
 * Shared hook for user management operations across UserManagement, UserDetail, and UserEdit pages.
 * Centralizes API calls, state, and toast notifications.
 * @param initialLoading - Set true when the page needs to load data immediately on mount.
 */
export function useUserManagement(initialLoading: boolean = false) {
  const logger = useLogger("useUserManagement");
  const { user: identityUser, clearLocalSession } = useIdentity();
  const [users, setUsers] = useState<ApplicationUser[]>([]);
  const [user, setUser] = useState<ApplicationUser | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(initialLoading);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Data Loading ──────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await userApi.getUsers();
      setUsers(data.map((u) => new ApplicationUser(u)));
    } catch (err) {
      logger.UI.error("Failed to load users:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRetiredUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await userApi.getRetiredUsers();
      setUsers(data.map((u) => new ApplicationUser(u)));
    } catch (err) {
      logger.UI.error("Failed to load retired users:", err);
      setError("Failed to load removed users. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUser = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await userApi.getUser(userId);
      const loadedUser = new ApplicationUser(data);
      setUser(loadedUser);

      const roles = await userApi.getUserRoles(userId);
      setUserRoles(roles);

      return loadedUser;
    } catch (err) {
      logger.UI.error("Failed to load user:", err);
      setError("Failed to load user. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAvailableRoles = useCallback(async () => {
    try {
      const roles = await managementApi.getRoles();
      setAvailableRoles(roles);
    } catch (err) {
      logger.UI.error("Failed to load roles:", err);
    }
  }, []);

  // ── User CRUD ─────────────────────────────────────────────────────────

  const addUser = useCallback(
    async (request: IAddUserRequest): Promise<boolean> => {
      try {
        setSaving(true);
        await userApi.addUser(request);
        toast({
          title: "User created",
          description: "User created successfully.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to create user:", err);
        toast({
          title: "Failed to create user",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const updateUser = useCallback(
    async (
      userId: string,
      request: IUpdateUserRequest,
    ): Promise<boolean> => {
      try {
        setSaving(true);
        const updateRequest = new UpdateUserRequest({
          firstName: request.firstName.trim(),
          lastName: request.lastName.trim(),
          phoneNumber: request.phoneNumber,
          azureAdObjectId: request.azureAdObjectId,
          clearAzureAdObjectId: request.clearAzureAdObjectId,
        });
        await userApi.updateUser(userId, updateRequest);
        toast({
          title: "User updated",
          description: "User information updated successfully.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to update user:", err);
        toast({
          title: "Failed to update user",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // ── Account Actions ───────────────────────────────────────────────────

  const deactivateUser = useCallback(
    async (userId: string, displayName?: string): Promise<boolean> => {
      try {
        await userApi.deactivateUser(userId);
        toast({
          title: "User deactivated",
          description: `${displayName || "User"} was deactivated successfully.`,
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to deactivate user:", err);
        toast({
          title: "Failed to deactivate user",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [],
  );

  const reactivateUser = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        await userApi.reactivateUser(userId);
        toast({
          title: "User restored",
          description: "User account restored successfully.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to restore user:", err);
        toast({
          title: "Failed to restore user",
          description: parseError(err).message || "Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [],
  );

  const changeEmail = useCallback(
    async (userId: string, newEmail: string): Promise<boolean> => {
      try {
        await userApi.changeEmail(userId, { newEmail: newEmail.trim() });
        toast({
          title: "Emails sent",
          description: "Instruct the user to check their email to confirm the change.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to change email:", err);
        toast({
          title: "Failed to change email",
          description: parseError(err).message,
          variant: "destructive",
        });
        return false;
      }
    },
    [],
  );

  const manageRoles = useCallback(
    async (
      userId: string,
      request: IManageUserRolesRequest,
    ): Promise<boolean> => {
      try {
        await userApi.manageUserRoles(userId, request);
        toast({
          title: "Roles updated",
          description: "Roles updated successfully.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to manage roles:", err);
        toast({
          title: "Failed to update roles",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [],
  );

  const enable2FA = useCallback(async (userId: string): Promise<boolean> => {
    try {
      await userApi.enable2FA(userId);
      toast({
        title: "2FA enabled",
        description: "Two-factor authentication enabled.",
      });
      return true;
    } catch (err) {
      logger.UI.error("Failed to enable 2FA:", err);
      toast({
        title: "Action failed",
        description: "Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  const disable2FA = useCallback(async (userId: string): Promise<boolean> => {
    try {
      await userApi.disable2FA(userId);
      toast({
        title: "2FA disabled",
        description: "Two-factor authentication disabled.",
      });
      return true;
    } catch (err) {
      logger.UI.error("Failed to disable 2FA:", err);
      toast({
        title: "Action failed",
        description: "Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  const resendConfirmation = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        await userApi.resendConfirmation(userId);
        toast({
          title: "Confirmation sent",
          description: "Confirmation email sent successfully.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to resend confirmation:", err);
        toast({
          title: "Action failed",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [],
  );

  const initiatePasswordReset = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        await userApi.initiatePasswordReset(userId);
        toast({
          title: "Password reset initiated",
          description: "Password reset email sent.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to initiate password reset:", err);
        toast({
          title: "Action failed",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [],
  );

  const lockUser = useCallback(async (userId: string): Promise<boolean> => {
    try {
      await userApi.lockUser(userId);
      toast({
        title: "Account locked",
        description: "User account locked successfully.",
      });
      return true;
    } catch (err) {
      logger.UI.error("Failed to lock user:", err);
      toast({
        title: "Action failed",
        description: "Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  const unlockUser = useCallback(async (userId: string): Promise<boolean> => {
    try {
      await userApi.unlockUser(userId);
      toast({
        title: "Account unlocked",
        description: "User account unlocked successfully.",
      });
      return true;
    } catch (err) {
      logger.UI.error("Failed to unlock user:", err);
      toast({
        title: "Action failed",
        description: "Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  const forceLogoutAllDevices = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        await userApi.forceLogoutAllDevices(userId);
        if (identityUser?.userId === userId) {
          clearLocalSession({ redirectTo: "/login" });
          return true;
        }
        toast({
          title: "Sessions invalidated",
          description: "All sessions have been invalidated.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to force logout:", err);
        toast({
          title: "Action failed",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [identityUser?.userId, clearLocalSession],
  );

  const updateUserSettings = useCallback(
    async (
      userId: string,
      settings: IUpdateUserSettingsRequest,
    ): Promise<boolean> => {
      try {
        setSaving(true);
        const request = new UpdateUserSettingsRequest(settings);
        const data = await userApi.updateUserSettings(userId, request);
        setUser(new ApplicationUser(data));
        toast({
          title: "Settings updated",
          description: "Account settings updated successfully.",
          duration: 3000,
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to update user settings:", err);
        toast({
          title: "Failed to update settings",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const softDeleteUser = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        await userApi.softDeleteUser(userId);
        toast({
          title: "User deleted",
          description: "The user has been soft-deleted successfully.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to soft-delete user:", err);
        toast({
          title: "Delete failed",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [],
  );

  const purgeUserData = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        await userApi.purgeUserData(userId);
        toast({
          title: "User data purged",
          description: "All user data has been permanently removed.",
        });
        return true;
      } catch (err) {
        logger.UI.error("Failed to purge user data:", err);
        toast({
          title: "Purge failed",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [],
  );

  return {
    // State
    users,
    user,
    userRoles,
    availableRoles,
    loading,
    saving,
    error,
    setError,

    // Data loading
    loadUsers,
    loadRetiredUsers,
    loadUser,
    loadAvailableRoles,

    // User CRUD
    addUser,
    updateUser,

    // Account actions
    deactivateUser,
    reactivateUser,
    changeEmail,
    manageRoles,
    enable2FA,
    disable2FA,
    resendConfirmation,
    initiatePasswordReset,
    lockUser,
    unlockUser,
    forceLogoutAllDevices,
    updateUserSettings,
    softDeleteUser,
    purgeUserData,
  };
}
