import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthButton } from "../components/AuthButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { identityApi } from "../providers/IdentityApi";
import type { IRegisterRequest } from "../models";
import { isValidEmail } from "../utils/authUtils";
import { useLogger } from "../logger/useLogger";
import { AuthPageShell } from "../components/AuthPageShell";
import TermsAndPrivacyCheckbox from "../components/TermsAndPrivacyCheckbox";
import {
  authLinkClassName,
  authSpinnerClassName,
} from "../constants/authBranding";

interface AccountFields {
  firstName: string;
  lastName: string;
  email: string;
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const logger = useLogger("SignUpPage");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [account, setAccount] = useState<AccountFields>({
    firstName: "",
    lastName: "",
    email: "",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);

  const emailValue = account.email.trim();
  const isEmailValid = emailValue.length > 0 && isValidEmail(emailValue);

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  }

  function handleAccountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAccount((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validate(): string | null {
    if (!account.firstName.trim() || !account.lastName.trim())
      return "First and last name are required.";
    if (!emailValue) return "Email is required.";
    if (!isEmailValid) return "Enter a valid email address.";
    if (!termsAccepted)
      return "You must accept the Terms of Service and Privacy Policy.";
    return null;
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);

    const request: IRegisterRequest = {
      firstName: account.firstName,
      lastName: account.lastName,
      email: emailValue,
    };

    try {
      logger.UI.log("register: started", { email: emailValue });
      await identityApi.register(request);
      logger.UI.log("register: succeeded — navigating to /account-created");
      navigate("/account-created", { state: { email: emailValue } });
    } catch (err: unknown) {
      logger.handleError(err, "SignUpPage.register");
      const msg =
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AuthPageShell>
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 flex flex-col items-center gap-4">
            <Loader2
              className={`h-10 w-10 animate-spin ${authSpinnerClassName}`}
            />
            <p className="text-sm text-muted-foreground">Creating your account...</p>
          </CardContent>
        </Card>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="w-full max-w-md">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription className="text-muted-foreground">
              Get started with VDAB.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-muted-foreground">All fields are required.</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={account.firstName}
                    onChange={handleAccountChange}
                    onBlur={handleBlur}
                    placeholder="Jane"
                  />
                  {touched.firstName && !account.firstName.trim() && (
                    <p className="text-xs text-destructive">
                      First name is required.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={account.lastName}
                    onChange={handleAccountChange}
                    onBlur={handleBlur}
                    placeholder="Smith"
                  />
                  {touched.lastName && !account.lastName.trim() && (
                    <p className="text-xs text-destructive">
                      Last name is required.
                    </p>
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
                  onChange={handleAccountChange}
                  onBlur={handleBlur}
                  placeholder="jane@company.com"
                />
                {touched.email && emailValue.length > 0 && !isEmailValid && (
                  <p className="text-xs text-destructive">
                    Enter a valid email address.
                  </p>
                )}
                {touched.email && emailValue.length === 0 && (
                  <p className="text-xs text-destructive">Email is required.</p>
                )}
              </div>

              <TermsAndPrivacyCheckbox
                checked={termsAccepted}
                onCheckedChange={setTermsAccepted}
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
                Continue
              </AuthButton>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className={authLinkClassName}>
                  Log in
                </Link>
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Have a beta code?{" "}
                <Link to="/beta-signup" className={authLinkClassName}>
                  Sign up for beta
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </AuthPageShell>
  );
}
