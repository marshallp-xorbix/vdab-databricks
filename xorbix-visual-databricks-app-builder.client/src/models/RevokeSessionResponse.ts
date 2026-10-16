export interface IRevokeSessionResponse {
  revokedCurrentSession: boolean;
}

export class RevokeSessionResponse implements IRevokeSessionResponse {
  revokedCurrentSession: boolean = false;

  constructor(data?: Partial<IRevokeSessionResponse>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
