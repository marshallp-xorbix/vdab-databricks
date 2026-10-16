export interface IUserTenantMembershipDto {
  tenantId: string;
  tenantDisplayName: string;
  role: string;
  isDefault: boolean;
  isPrimary: boolean;
  isOwner: boolean;
  /** Membership status for this tenant (Active, Suspended, or Ended). */
  status?: string;
}
