export interface IManageUserRolesRequest {
  rolesToAdd?: string[];
  rolesToRemove?: string[];
}

export class ManageUserRolesRequest implements IManageUserRolesRequest {
  rolesToAdd?: string[];
  rolesToRemove?: string[];

  constructor(init?: Partial<IManageUserRolesRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
