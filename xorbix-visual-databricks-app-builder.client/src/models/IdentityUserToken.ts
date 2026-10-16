export interface IIdentityUserToken {
  userId: string;
  loginProvider: string;
  name: string;
  value: string;
}

export class IdentityUserToken implements IIdentityUserToken {
  userId: string = "";
  loginProvider: string = "";
  name: string = "";
  value: string = "";

  constructor(init?: Partial<IIdentityUserToken>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
