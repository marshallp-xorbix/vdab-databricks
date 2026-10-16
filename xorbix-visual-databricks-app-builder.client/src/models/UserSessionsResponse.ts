import { type IUserSession } from "./UserSession";

export interface IUserSessionsResponse {
  sessions: IUserSession[];
  totalCount: number;
}

export class UserSessionsResponse implements IUserSessionsResponse {
  sessions: IUserSession[] = [];
  totalCount: number = 0;

  constructor(data?: Partial<IUserSessionsResponse>) {
    if (data) {
      this.totalCount = data.totalCount ?? 0;
      this.sessions = data.sessions ?? [];
    }
  }
}
