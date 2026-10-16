import type { IApplicationUser } from "./ApplicationUser";
import { parseApiDate } from "../lib/utils";

export interface IRefreshToken {
  id: number;
  userId: string;
  token: string;
  expiresAt: string | Date;
  createdAt: string | Date;
  isRevoked: boolean;
  revokedAt?: string | Date;
  ipAddress?: string;
  userAgent?: string;
  replacedByTokenId?: number;
  user?: IApplicationUser;
  replacedByToken?: IRefreshToken;
  isActive: boolean;
  isExpired: boolean;
}

export class RefreshToken implements IRefreshToken {
  id: number = 0;
  userId: string = "";
  token: string = "";
  expiresAt: Date = new Date();
  createdAt: Date = new Date();
  isRevoked: boolean = false;
  revokedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  replacedByTokenId?: number;
  user?: IApplicationUser;
  replacedByToken?: IRefreshToken;

  constructor(init?: Partial<IRefreshToken>) {
    if (init) {
      Object.assign(this, init);
      if (init.expiresAt) this.expiresAt = parseApiDate(init.expiresAt);
      if (init.createdAt) this.createdAt = parseApiDate(init.createdAt);
      if (init.revokedAt) this.revokedAt = parseApiDate(init.revokedAt);
    }
  }

  get isActive(): boolean {
    return !this.isRevoked && this.expiresAt > new Date();
  }

  get isExpired(): boolean {
    return new Date() >= this.expiresAt;
  }
}
