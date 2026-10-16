export interface IAccountSetupStatus {
  isSetupComplete: boolean;
  currentStep: string | null;
  hasSubscription: boolean;
  hasPaymentMethod: boolean;
  isPaused: boolean;
  requiresPaymentMethod: boolean;
  isAdmin: boolean;
  needsPolicyAcceptance: boolean;
  needsTermsOfServiceAcceptance: boolean;
  needsPrivacyPolicyAcceptance: boolean;
  latestTermsOfServiceVersionDate: string;
  latestPrivacyPolicyVersionDate: string;
}

export class AccountSetupStatus implements IAccountSetupStatus {
  isSetupComplete: boolean = false;
  currentStep: string | null = null;
  hasSubscription: boolean = false;
  hasPaymentMethod: boolean = false;
  isPaused: boolean = false;
  requiresPaymentMethod: boolean = false;
  isAdmin: boolean = false;
  needsPolicyAcceptance: boolean = false;
  needsTermsOfServiceAcceptance: boolean = false;
  needsPrivacyPolicyAcceptance: boolean = false;
  latestTermsOfServiceVersionDate: string = "";
  latestPrivacyPolicyVersionDate: string = "";

  constructor(init?: Partial<IAccountSetupStatus>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
