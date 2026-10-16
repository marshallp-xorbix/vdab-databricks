export interface IUserInfo {
  userId: string;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  fullName: string;
}

export class UserInfo implements IUserInfo {
  userId: string = "";
  userName: string = "";
  email: string = "";
  firstName: string = "";
  lastName: string = "";
  roles: string[] = [];

  constructor(init?: Partial<IUserInfo>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  private _fullName: string = "";

  get fullName(): string {
    return this._fullName || `${this.firstName} ${this.lastName}`.trim();
  }

  set fullName(value: string) {
    this._fullName = value;
  }
}
