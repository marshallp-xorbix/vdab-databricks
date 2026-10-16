import { parseApiDate } from "../lib/utils";

export interface IBetaCodeValidation {
  isValid: boolean;
  tier: string;
  trialPeriodDays?: number | null;
  trialEndDate?: string | Date | null;
  message: string;
}

export class BetaCodeValidation implements IBetaCodeValidation {
  isValid: boolean = false;
  tier: string = "";
  trialPeriodDays?: number | null;
  trialEndDate?: Date | null;
  message: string = "";

  constructor(init?: Partial<IBetaCodeValidation>) {
    if (init) {
      Object.assign(this, init);

      if (init.trialEndDate) {
        this.trialEndDate = parseApiDate(init.trialEndDate);
      }
    }
  }
}

export interface IValidateBetaCodeRequest {
  code: string;
}

export interface IRedeemBetaCodeRequest {
  code: string;
}
