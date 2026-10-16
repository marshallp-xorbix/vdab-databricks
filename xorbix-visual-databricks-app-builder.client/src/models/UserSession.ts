export interface IUserSession {
  /** Stable identifier for the login (rotation chain). Use this as the React key. */
  sessionId: string;
  /** Live (most recent) refresh-token id in the chain. Used as the revoke target. */
  id: number;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  operatingSystem?: string;
  deviceType?: string;
  city?: string;
  country?: string;
  region?: string;
  /** When the session was first established (earliest CreatedAt across the chain). */
  firstSeenAt: string | Date;
  /** When the session most recently rotated (latest CreatedAt across the chain). */
  lastActivityAt: string | Date;
  /** Alias for firstSeenAt. Kept for backward compatibility. */
  createdAt: string | Date;
  expiresAt: string | Date;
  isRevoked: boolean;
  revokedAt?: string | Date;
  isActive: boolean;
  isCurrentSession: boolean;
  isExpired: boolean;
}

export class UserSession implements IUserSession {
  sessionId: string = "";
  id: number = 0;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  operatingSystem?: string;
  deviceType?: string;
  city?: string;
  country?: string;
  region?: string;
  firstSeenAt: Date = new Date();
  lastActivityAt: Date = new Date();
  createdAt: Date = new Date();
  expiresAt: Date = new Date();
  isRevoked: boolean = false;
  revokedAt?: Date;
  isActive: boolean = false;
  isCurrentSession: boolean = false;
  isExpired: boolean = false;

  constructor(data?: Partial<IUserSession>) {
    if (data) {
      Object.assign(this, data);
      if (data.firstSeenAt) this.firstSeenAt = new Date(data.firstSeenAt);
      if (data.lastActivityAt) this.lastActivityAt = new Date(data.lastActivityAt);
      if (data.createdAt) this.createdAt = new Date(data.createdAt);
      if (data.expiresAt) this.expiresAt = new Date(data.expiresAt);
      if (data.revokedAt) this.revokedAt = new Date(data.revokedAt);
    }
  }
}
