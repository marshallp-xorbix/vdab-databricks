import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthButton } from "../components/AuthButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { Loader2 } from "lucide-react";
import { useLoginWorkflow } from "../hooks/useLoginWorkflow";
import { useClientConfig } from "../hooks/useClientConfig";
import { ApiError } from "../models";
import { useLogger } from "../logger/useLogger";
import { AuthPageShell } from "../components/AuthPageShell";
import {
  authInputFocusClassName,
  authLinkClassName,
  authMutedLinkClassName,
  authSpinnerClassName,
} from "../constants/authBranding";
import { cn } from "../lib/utils";
import { clearVerificationChallenge } from "../utils/verificationChallengeStorage";

/** Used only when the server did not report a 2FA code expiry. */
const CODE_TTL_FALLBACK_MS = 5 * 60 * 1000;

export default function LoginPage() {
  const logger = useLogger("LoginPage");
  const location = useLocation();
  const { login, isIdentityLoading, startCodeVerification } =
    useLoginWorkflow();
  const { passwordlessOnly, isConfigLoaded } = useClientConfig();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Landing here abandons any challenge in progress — including via the back button, which runs no
  // handler on the way out. Must stay above the early returns below: a hook after them would be a
  // conditional hook.
  useEffect(() => {
    clearVerificationChallenge();
  }, []);

  // Hold on a spinner until both identity and runtime config have resolved, so the password form never
  // flashes before redirecting in passwordless-only mode.
  if (isIdentityLoading || !isConfigLoaded) {
    return (
      <AuthPageShell>
        <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
      </AuthPageShell>
    );
  }

  // In passwordless-only mode the standard password login is hidden; route to the passwordless flow,
  // preserving any post-login redirect target carried in the query string.
  if (passwordlessOnly) {
    return <Navigate to={`/passwordless${location.search}`} replace />;
  }

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter an email.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter a password.");
      return;
    }

    setLoading(true);
    try {
      const response = await login(email, password);
      if (response.twoFactorRequired) {
        const expiresAt = response.twoFactorExpiresAt
          ? new Date(response.twoFactorExpiresAt).toISOString()
          : new Date(Date.now() + CODE_TTL_FALLBACK_MS).toISOString();
        // Absent a server value, treat resend as immediately available and let the server's 429
        // (with its Retry-After) be the authority rather than guessing a cooldown here.
        const resendAvailableAt = response.twoFactorResendAvailableAt
          ? new Date(response.twoFactorResendAvailableAt).toISOString()
          : new Date().toISOString();
        startCodeVerification(email, { expiresAt, resendAvailableAt });
      }
    } catch (err) {
      logger.handleError(err, "login");
      // The server returns 401 for a genuine credential rejection (bad password, locked out,
      // unconfirmed email). Anything else (a network error or a 5xx from a cold backend) is a
      // transient failure that must not be reported to the user as bad credentials.
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid email or password. Please try again."
          : "We couldn't sign you in right now. Please try again in a moment.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <div className="w-full max-w-md space-y-2">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Welcome back
            </CardTitle>
            <CardDescription className="mt-1 text-muted-foreground">
              Enter your credentials to access your account.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-foreground"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`mt-1 border-border bg-background text-foreground placeholder:text-muted-foreground ${authInputFocusClassName}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="password" className="text-foreground">
                    Password
                  </Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={`border-border bg-background text-foreground placeholder:text-muted-foreground ${authInputFocusClassName}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <div className="flex items-center justify-end mb-1">
                  <Link
                    to="/forgot-password"
                    className={cn("text-xs", authLinkClassName)}
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <AuthButton
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="mt-2 w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </AuthButton>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className={authLinkClassName}>
                  Sign up
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="flex justify-end px-1">
          <Link
            to="/passwordless"
            className={`text-xs ${authMutedLinkClassName}`}
          >
            Dev Login
          </Link>
        </div>
      </div>
    </AuthPageShell>
  );
}
