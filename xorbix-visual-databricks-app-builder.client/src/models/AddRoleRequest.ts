export interface IAddRoleRequest {
  roleName: string;
}

export class AddRoleRequest implements IAddRoleRequest {
  roleName: string = "";

  constructor(init?: Partial<IAddRoleRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
