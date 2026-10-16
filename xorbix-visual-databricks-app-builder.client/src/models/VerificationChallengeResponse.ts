/**
 * Result of requesting a passwordless / 2FA verification code. `resendAvailableAt` is the server's
 * escalating backoff, so the client drives its resend countdown from it rather than hard-coding a
 * cooldown that could drift from the server's schedule.
 */
export interface IVerificationChallengeResponse {
  expiresAt: string;
  resendAvailableAt: string;
}

export class VerificationChallengeResponse
  implements IVerificationChallengeResponse
{
  public expiresAt: string;
  public resendAvailableAt: string;

  constructor(response: IVerificationChallengeResponse) {
    this.expiresAt = response.expiresAt;
    this.resendAvailableAt = response.resendAvailableAt;
  }
}
