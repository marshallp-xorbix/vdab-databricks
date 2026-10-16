export interface IUpdateProfileRequest {
  firstName: string;
  lastName: string;
}

export class UpdateProfileRequest implements IUpdateProfileRequest {
  firstName: string = "";
  lastName: string = "";

  constructor(init?: Partial<IUpdateProfileRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
