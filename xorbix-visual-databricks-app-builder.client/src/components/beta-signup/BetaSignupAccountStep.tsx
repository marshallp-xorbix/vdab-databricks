import { Loader2 } from "lucide-react";
import { AuthButton } from "../AuthButton";
import TermsAndPrivacyCheckbox from "../TermsAndPrivacyCheckbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { isValidEmail } from "../../utils/authUtils";
import { authSpinnerClassName } from "../../constants/authBranding";

interface AccountFields {
  firstName: string;
  lastName: string;
  email: string;
}

interface IBetaSignupAccountStepProps {
  account: AccountFields;
  touched: Record<string, boolean>;
  termsAccepted: boolean;
  loading: boolean;
  error: string | null;
  onAccountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  onTermsChange: (accepted: boolean) => void;
  onSubmit: (e: React.SubmitEvent<HTMLFormElement>) => void;
}

export default function BetaSignupAccountStep({
  account,
  touched,
  termsAccepted,
  loading,
  error,
  onAccountChange,
  onBlur,
  onTermsChange,
  onSubmit,
}: Readonly<IBetaSignupAccountStepProps>) {
  const emailValue = account.email.trim();
  const isEmailValid = emailValue.length > 0 && isValidEmail(emailValue);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className={`h-10 w-10 animate-spin ${authSpinnerClassName}`} />
        <p className="text-sm text-muted-foreground">Creating your beta account...</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">All fields are required.</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            name="firstName"
            value={account.firstName}
            onChange={onAccountChange}
            onBlur={onBlur}
            placeholder="Jane"
          />
          {touched.firstName && !account.firstName.trim() && (
            <p className="text-xs text-destructive">First name is required.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            name="lastName"
            value={account.lastName}
            onChange={onAccountChange}
            onBlur={onBlur}
            placeholder="Smith"
          />
          {touched.lastName && !account.lastName.trim() && (
            <p className="text-xs text-destructive">Last name is required.</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={account.email}
          onChange={onAccountChange}
          onBlur={onBlur}
          placeholder="jane@company.com"
        />
        {touched.email && emailValue.length > 0 && !isEmailValid && (
          <p className="text-xs text-destructive">Enter a valid email address.</p>
        )}
        {touched.email && emailValue.length === 0 && (
          <p className="text-xs text-destructive">Email is required.</p>
        )}
      </div>

      <TermsAndPrivacyCheckbox
        checked={termsAccepted}
        onCheckedChange={onTermsChange}
      />

      <AuthButton
        type="submit"
        className="w-full mt-2"
        disabled={
          !account.firstName.trim() ||
          !account.lastName.trim() ||
          !isEmailValid ||
          !termsAccepted
        }
      >
        Create beta account
      </AuthButton>
    </form>
  );
}
