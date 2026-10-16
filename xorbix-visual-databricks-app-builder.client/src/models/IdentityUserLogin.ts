export interface IIdentityUserLogin {
  loginProvider: string;
  providerKey: string;
  providerDisplayName: string;
  userId: string;
}

export class IdentityUserLogin implements IIdentityUserLogin {
  loginProvider: string = "";
  providerKey: string = "";
  providerDisplayName: string = "";
  userId: string = "";

  constructor(init?: Partial<IIdentityUserLogin>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
