export interface IUpdateUserRequest {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  azureAdObjectId?: string;
  clearAzureAdObjectId?: boolean;
}

export class UpdateUserRequest implements IUpdateUserRequest {
  firstName: string = "";
  lastName: string = "";
  phoneNumber?: string;
  azureAdObjectId?: string;
  clearAzureAdObjectId?: boolean;

  constructor(init?: Partial<IUpdateUserRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
