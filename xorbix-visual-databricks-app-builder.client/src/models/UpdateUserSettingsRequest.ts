export interface IUpdateUserSettingsRequest {
  usePasswordlessLogin: boolean;
  twoFactorEnabled: boolean;
  emailNotificationsEnabled: boolean;
  workflowNotificationsEnabled: boolean;
}

export class UpdateUserSettingsRequest implements IUpdateUserSettingsRequest {
  usePasswordlessLogin: boolean = false;
  twoFactorEnabled: boolean = false;
  emailNotificationsEnabled: boolean = true;
  workflowNotificationsEnabled: boolean = true;

  constructor(init?: Partial<IUpdateUserSettingsRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
