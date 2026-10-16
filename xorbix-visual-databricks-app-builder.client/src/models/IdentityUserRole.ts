export interface IIdentityUserRole {
  userId: string;
  roleId: number;
}

export class IdentityUserRole implements IIdentityUserRole {
  userId: string = "";
  roleId: number = 0;

  constructor(init?: Partial<IIdentityUserRole>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
