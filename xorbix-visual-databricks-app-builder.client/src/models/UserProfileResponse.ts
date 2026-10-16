import type { IUserInfo } from "./UserInfo";
import { UserInfo } from "./UserInfo";

export interface IUserProfileResponse extends IUserInfo {
  phoneNumber?: string;
  phoneNumberConfirmed: boolean;
  emailConfirmed: boolean;
  twoFactorEnabled: boolean;
  usePasswordlessLogin: boolean;
  emailNotificationsEnabled: boolean;
  workflowNotificationsEnabled: boolean;
  createdOn: string | Date;
  lastLoginAt?: string | Date;
  /**
   * The user's role within their current tenant (from `UserTenantMembership.Role`),
   * e.g. "Admin", "Developer". Distinct from the global Identity roles
   * in `roles`. Null/undefined when the user has no active tenant membership.
   */
  tenantRole?: string;
  /**
   * The identifier of the user's current active tenant (JWT / membership context).
   * Undefined when the user has no active tenant membership (Detached).
   * Not used as account-administration authority.
   */
  tenantId?: string;
}

export class UserProfileResponse
  extends UserInfo
  implements IUserProfileResponse
{
  phoneNumber?: string;
  phoneNumberConfirmed: boolean = false;
  emailConfirmed: boolean = false;
  twoFactorEnabled: boolean = false;
  usePasswordlessLogin: boolean = false;
  emailNotificationsEnabled: boolean = true;
  workflowNotificationsEnabled: boolean = true;
  createdOn: Date = new Date();
  lastLoginAt?: Date;
  tenantRole?: string;
  tenantId?: string;

  constructor(init?: Partial<IUserProfileResponse>) {
    super(init);
    if (init) {
      Object.assign(this, init);
      if (typeof init.createdOn === "string") {
        this.createdOn = new Date(init.createdOn);
      }
      if (typeof init.lastLoginAt === "string") {
        this.lastLoginAt = new Date(init.lastLoginAt);
      }
    }
  }
}
