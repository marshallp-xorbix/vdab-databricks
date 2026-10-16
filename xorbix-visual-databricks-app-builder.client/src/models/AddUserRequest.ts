export interface IAddUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  sendWelcomeEmail: boolean;
  usePasswordlessLogin: boolean;
  tenantId?: string;
}

export class AddUserRequest implements IAddUserRequest {
  email: string = "";
  firstName: string = "";
  lastName: string = "";
  roles: string[] = [];
  sendWelcomeEmail: boolean = true;
  usePasswordlessLogin: boolean = false;
  tenantId?: string;

  constructor(init?: Partial<IAddUserRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
