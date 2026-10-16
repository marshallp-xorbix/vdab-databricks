export interface IIdentityUserClaim {
  id: number;
  userId: string;
  claimType: string;
  claimValue: string;
}

export class IdentityUserClaim implements IIdentityUserClaim {
  id: number = 0;
  userId: string = "";
  claimType: string = "";
  claimValue: string = "";

  constructor(init?: Partial<IIdentityUserClaim>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
