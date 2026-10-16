export interface IReportsStats {
  activeUsersCount: number;
  newUsersLast30DaysCount: number;
  pendingInvitesCount: number;
  activeAppsCount: number;
  activeWorkspacesCount: number;
  activeTenantsCount: number;
  newTenantsLast30DaysCount: number;
  systemHealthStatus: string;
  generatedAt: string;
}

export class ReportsStats implements IReportsStats {
  activeUsersCount = 0;
  newUsersLast30DaysCount = 0;
  pendingInvitesCount = 0;
  activeAppsCount = 0;
  activeWorkspacesCount = 0;
  activeTenantsCount = 0;
  newTenantsLast30DaysCount = 0;
  systemHealthStatus = "";
  generatedAt = "";

  constructor(init?: Partial<IReportsStats>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
