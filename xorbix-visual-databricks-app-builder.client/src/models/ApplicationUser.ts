import type { IIdentityUserClaim } from "./IdentityUserClaim";
import type { IIdentityUserLogin } from "./IdentityUserLogin";
import type { IIdentityUserToken } from "./IdentityUserToken";
import type { IIdentityUserRole } from "./IdentityUserRole";
import type { IUserTenantMembershipDto } from "./UserTenantMembershipDto.ts";
import { parseApiDate } from "../lib/utils";

export interface IApplicationUser {
  id: string;
  userName: string;
  normalizedUserName: string;
  email: string;
  normalizedEmail: string;
  emailConfirmed: boolean;
  phoneNumber?: string;
  phoneNumberConfirmed: boolean;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  usePasswordlessLogin: boolean;
  azureAdObjectId?: string;
  tenantId?: string;
  emailNotificationsEnabled: boolean;
  workflowNotificationsEnabled: boolean;
  twoFactorEnabled: boolean;
  lockoutEnd?: string | Date;
  lockoutEnabled: boolean;
  accessFailedCount: number;
  lastLoginAt?: string | Date;
  /** ISO yyyy-MM-dd version date of the Terms of Service the user accepted. */
  termsOfServiceVersionDate?: string;
  termsOfServiceAcceptedOn?: string | Date;
  /** ISO yyyy-MM-dd version date of the Privacy Policy the user accepted. */
  privacyPolicyVersionDate?: string;
  privacyPolicyAcceptedOn?: string | Date;
  createdOn: string | Date;
  createdBy?: string;
  modifiedOn?: string | Date;
  modifiedBy?: string;
  /** Soft-delete timestamp; set when the account is retired. */
  deletedOn?: string | Date;
  deletedBy?: string;
  /** Platform or self-service retirement reason when deletedOn is set. */
  retirementReason?: number;
  /** Set when PII has been anonymized; anonymized rows are excluded from retired lists. */
  anonymizedOn?: string | Date;
  claims?: IIdentityUserClaim[];
  logins?: IIdentityUserLogin[];
  tokens?: IIdentityUserToken[];
  userRoles?: IIdentityUserRole[];
  tenantMembershipsSummary?: IUserTenantMembershipDto[];
}

export class ApplicationUser implements IApplicationUser {
  id: string = "";
  userName: string = "";
  normalizedUserName: string = "";
  email: string = "";
  normalizedEmail: string = "";
  emailConfirmed: boolean = false;
  phoneNumber?: string;
  phoneNumberConfirmed: boolean = false;
  firstName: string = "";
  lastName: string = "";
  roles: string[] = [];
  isActive: boolean = true;
  usePasswordlessLogin: boolean = false;
  azureAdObjectId?: string;
  tenantId?: string;
  emailNotificationsEnabled: boolean = true;
  workflowNotificationsEnabled: boolean = true;
  twoFactorEnabled: boolean = false;
  lockoutEnd?: string | Date;
  lockoutEnabled: boolean = false;
  accessFailedCount: number = 0;
  lastLoginAt?: Date;
  termsOfServiceVersionDate?: string;
  termsOfServiceAcceptedOn?: Date;
  privacyPolicyVersionDate?: string;
  privacyPolicyAcceptedOn?: Date;
  createdOn: Date = new Date();
  createdBy?: string;
  modifiedOn?: Date;
  modifiedBy?: string;
  deletedOn?: Date;
  deletedBy?: string;
  retirementReason?: number;
  anonymizedOn?: Date;
  claims?: IIdentityUserClaim[];
  logins?: IIdentityUserLogin[];
  tokens?: IIdentityUserToken[];
  userRoles?: IIdentityUserRole[];
  tenantMembershipsSummary: IUserTenantMembershipDto[] = [];

  constructor(init?: Partial<IApplicationUser>) {
    if (init) {
      Object.assign(this, init);

      // Ensure dates are Date objects
      if (init.lastLoginAt) this.lastLoginAt = parseApiDate(init.lastLoginAt);
      if (init.termsOfServiceAcceptedOn)
        this.termsOfServiceAcceptedOn = parseApiDate(
          init.termsOfServiceAcceptedOn,
        );
      if (init.privacyPolicyAcceptedOn)
        this.privacyPolicyAcceptedOn = parseApiDate(
          init.privacyPolicyAcceptedOn,
        );
      if (init.createdOn) this.createdOn = parseApiDate(init.createdOn);
      if (init.modifiedOn) this.modifiedOn = parseApiDate(init.modifiedOn);
      if (init.lockoutEnd) this.lockoutEnd = parseApiDate(init.lockoutEnd);
      if (init.deletedOn) this.deletedOn = parseApiDate(init.deletedOn);
      if (init.anonymizedOn) this.anonymizedOn = parseApiDate(init.anonymizedOn);
    }
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }
}
