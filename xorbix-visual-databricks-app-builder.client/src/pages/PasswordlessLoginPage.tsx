import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthButton } from "../components/AuthButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { useLoginWorkflow } from "../hooks/useLoginWorkflow";
import { useClientConfig } from "../hooks/useClientConfig";
import { AuthPageShell } from "../components/AuthPageShell";
import { clearVerificationChallenge } from "../utils/verificationChallengeStorage";
import {
  authInputFocusClassName,
  authLinkClassName,
  authSpinnerClassName,
} from "../constants/authBranding";

export default function PasswordlessLoginPage() {
  const {
    navigate,
    isIdentityLoading,
    initiatePasswordlessLogin,
    loading,
    error,
  } = useLoginWorkflow();
  const { passwordlessOnly, isConfigLoaded } = useClientConfig();

  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Landing here abandons any challenge in progress — including via the back button, which runs no
  // handler on the way out. Without this, a previous user's email stays addressable at /verify-code.
  // Must stay above the early return below: a hook after it would be a conditional hook.
  useEffect(() => {
    clearVerificationChallenge();
  }, []);

  // Wait for both identity and runtime config so the "Back to Standard Login" footer never flashes
  // in/out as the config resolves (mirrors LoginPage's gating).
  if (isIdentityLoading || !isConfigLoaded) {
    return (
      <AuthPageShell>
        <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
      </AuthPageShell>
    );
  }

  const handleEmailSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim()) {
      setLocalError("Please enter your email address.");
      return;
    }

    await initiatePasswordlessLogin(email);
  };

  const displayError = localError ?? error;

  return (
    <AuthPageShell>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            Login
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter your email to receive a login code
          </CardDescription>
        </CardHeader>

        <CardContent>
          {displayError && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-foreground"
            >
              {displayError}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  className={`pl-9 border-border bg-background text-foreground placeholder:text-muted-foreground ${authInputFocusClassName}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <AuthButton
              type="submit"
              disabled={loading || !email.trim() || !/\S+@\S+\.\S+/.test(email)}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Code...
                </>
              ) : (
                "Send Code"
              )}
            </AuthButton>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                className={authLinkClassName}
              >
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>

        {!passwordlessOnly && (
          <CardFooter className="flex justify-center border-t border-border pt-6">
            <AuthButton variant="outline" onClick={() => navigate("/login")}>
              <ArrowLeft className="h-4 w-4" />
              Back to Standard Login
            </AuthButton>
          </CardFooter>
        )}
      </Card>
    </AuthPageShell>
  );
}
