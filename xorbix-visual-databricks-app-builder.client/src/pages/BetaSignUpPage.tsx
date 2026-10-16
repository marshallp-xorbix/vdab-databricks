import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { AuthPageShell } from "../components/AuthPageShell";
import BetaSignupPlanAndCodeStep from "../components/beta-signup/BetaSignupPlanAndCodeStep";
import BetaSignupAccountStep from "../components/beta-signup/BetaSignupAccountStep";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { betaSignupApi } from "../api/BetaSignupApi";
import { BetaCodeValidation } from "../models";
import { normalizeTier } from "../hooks/useSubscription";
import { isValidEmail } from "../utils/authUtils";
import { formatApiErrorMessage } from "../utils/apiErrorMessage";
import { useLogger } from "../logger/useLogger";
import { authLinkClassName } from "../constants/authBranding";
import type { BillingInterval } from "../types/pricing";

const SESSION_KEY = "vdab_beta_signup";

interface BetaSignupSession {
  step: number;
  selectedTier: string;
  billingInterval: BillingInterval;
  betaCode: string;
  betaValidation: BetaCodeValidation | null;
}

interface AccountFields {
  firstName: string;
  lastName: string;
  email: string;
}

function getStepBadgeClass(completed: boolean, active: boolean): string {
  const base = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full";
  if (completed) return `${base} bg-primary text-primary-foreground`;
  if (active)
    return `${base} border-2 border-primary text-primary font-semibold`;
  return `${base} border-2 border-border text-muted-foreground font-semibold`;
}

interface IStepIndicatorProps {
  step: number;
  title: string;
  completed: boolean;
  active: boolean;
  onCompletedClick?: () => void;
}

function StepIndicator({
  step,
  title,
  completed,
  active,
  onCompletedClick,
}: Readonly<IStepIndicatorProps>) {
  const badge = (
    <div className={getStepBadgeClass(completed, active)}>
      {completed ? <Check className="h-4 w-4" /> : step}
    </div>
  );

  return (
    <div className="flex items-center gap-3 mb-4">
      {completed && onCompletedClick ? (
        <button
          type="button"
          onClick={onCompletedClick}
          className="shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 hover:opacity-90"
          aria-label={`Back to ${title}`}
        >
          {badge}
        </button>
      ) : (
        badge
      )}
      <h2
        className={
          active || completed
            ? "text-lg font-semibold text-foreground"
            : "text-lg font-semibold text-muted-foreground"
        }
      >
        {title}
      </h2>
    </div>
  );
}

function loadSession(): Partial<BetaSignupSession> | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<BetaSignupSession>;
  } catch {
    return null;
  }
}

function saveSession(session: BetaSignupSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export default function BetaSignUpPage() {
  const navigate = useNavigate();
  const logger = useLogger("BetaSignUpPage");

  const saved = loadSession();
  const savedValidation = saved?.betaValidation
    ? new BetaCodeValidation(saved.betaValidation)
    : null;
  const initialStep =
    saved?.step && saved.step >= 2 && savedValidation ? 2 : 1;
  const [step, setStep] = useState(initialStep);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    saved?.billingInterval ?? "monthly",
  );
  const [selectedTier, setSelectedTier] = useState(saved?.selectedTier ?? "");
  const [betaCode, setBetaCode] = useState(saved?.betaCode ?? "");
  const [betaValidation, setBetaValidation] =
    useState<BetaCodeValidation | null>(savedValidation);

  const [planStepError, setPlanStepError] = useState<string | null>(null);
  const [planStepValidating, setPlanStepValidating] = useState(false);

  const [account, setAccount] = useState<AccountFields>({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => {
    saveSession({
      step,
      selectedTier,
      billingInterval,
      betaCode,
      betaValidation,
    });
  }, [step, selectedTier, billingInterval, betaCode, betaValidation]);

  const handlePlanSelect = useCallback((slug: string) => {
    setSelectedTier(slug);
    setPlanStepError(null);
  }, []);

  const handlePlanAndCodeValidated = useCallback(
    (code: string, validation: BetaCodeValidation) => {
      setBetaCode(code);
      setBetaValidation(validation);
      setSelectedTier(normalizeTier(validation.tier));
      setStep(2);
    },
    [],
  );

  const handleBackToPlanAndCode = useCallback(() => {
    setAccountError(null);
    setStep(1);
  }, []);

  function handleAccountBlur(e: React.FocusEvent<HTMLInputElement>) {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  }

  function handleAccountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAccount((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validateAccount(): string | null {
    const emailValue = account.email.trim();
    if (!account.firstName.trim() || !account.lastName.trim()) {
      return "First and last name are required.";
    }
    if (!emailValue) return "Email is required.";
    if (!isValidEmail(emailValue)) return "Enter a valid email address.";
    if (!termsAccepted) {
      return "You must accept the Terms of Service and Privacy Policy.";
    }
    if (!betaCode || !betaValidation) {
      return "A valid beta code is required.";
    }
    return null;
  }

  async function handleAccountSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const err = validateAccount();
    if (err) {
      setAccountError(err);
      return;
    }

    setAccountError(null);
    setAccountLoading(true);

    const emailValue = account.email.trim();

    try {
      logger.UI.log("registerBeta: started", { email: emailValue, tier: selectedTier });
      await betaSignupApi.registerBeta({
        firstName: account.firstName,
        lastName: account.lastName,
        email: emailValue,
        tier: selectedTier,
        betaCode,
      });
      clearSession();
      logger.UI.log("registerBeta: succeeded — navigating to /account-created");
      navigate("/account-created", {
        state: { email: emailValue, source: "beta" },
      });
    } catch (submitError: unknown) {
      logger.handleError(submitError, "BetaSignUpPage.registerBeta");
      setAccountError(formatApiErrorMessage(submitError));
    } finally {
      setAccountLoading(false);
    }
  }

  const stepTitles = ["Choose plan & beta code", "Create your account"];

  return (
    <AuthPageShell>
      <div className="w-full max-w-5xl">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign up for beta</CardTitle>
            <CardDescription className="text-muted-foreground">
              Select your plan, enter your beta code, then create your account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            <StepIndicator
              step={1}
              title={stepTitles[0]}
              completed={step > 1}
              active={step === 1}
              onCompletedClick={
                step > 1 ? handleBackToPlanAndCode : undefined
              }
            />
            {step === 1 && (
              <>
                <BetaSignupPlanAndCodeStep
                  interval={billingInterval}
                  selectedTier={selectedTier}
                  betaCode={betaCode}
                  error={planStepError}
                  validating={planStepValidating}
                  onIntervalChange={setBillingInterval}
                  onSelect={handlePlanSelect}
                  onBetaCodeChange={setBetaCode}
                  onError={setPlanStepError}
                  onValidatingChange={setPlanStepValidating}
                  onValidated={handlePlanAndCodeValidated}
                />
                <p className="text-center text-sm text-muted-foreground">
                  Not joining the beta?{" "}
                  <Link to="/signup" className={authLinkClassName}>
                    Standard signup
                  </Link>
                </p>
              </>
            )}

            {step >= 2 && (
              <>
                <StepIndicator
                  step={2}
                  title={stepTitles[1]}
                  completed={false}
                  active={step === 2}
                />
                {step === 2 && (
                  <div className="max-w-md mx-auto">
                    <BetaSignupAccountStep
                      account={account}
                      touched={touched}
                      termsAccepted={termsAccepted}
                      loading={accountLoading}
                      error={accountError}
                      onAccountChange={handleAccountChange}
                      onBlur={handleAccountBlur}
                      onTermsChange={setTermsAccepted}
                      onSubmit={handleAccountSubmit}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthPageShell>
  );
}
