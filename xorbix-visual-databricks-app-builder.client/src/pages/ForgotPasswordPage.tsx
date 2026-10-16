import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
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
import { AuthPageShell } from "../components/AuthPageShell";
import {
  authInputFocusClassName,
  authLinkClassName,
} from "../constants/authBranding";
import { identityApi } from "../providers/IdentityApi";
import { useLogger } from "../logger/useLogger";

export default function ForgotPasswordPage() {
  const logger = useLogger("ForgotPasswordPage");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await identityApi.forgotPassword({ email });
      setSubmitted(true);
    } catch (err) {
      logger.handleError(err, "forgotPassword");
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            {submitted ? (
              <>
                <div className="flex justify-center mb-3">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <CardTitle className="text-xl font-bold tracking-tight">
                  Check your email
                </CardTitle>
                <CardDescription className="mt-1 text-muted-foreground">
                  If an account exists for{" "}
                  <span className="font-medium text-foreground">{email}</span>,
                  you&apos;ll receive a password reset link shortly.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  Forgot password?
                </CardTitle>
                <CardDescription className="mt-1 text-muted-foreground">
                  Enter your email and we&apos;ll send you a reset link.
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="space-y-3">
                <AuthButton asChild className="w-full">
                  <Link className="text-white!" to="/login">
                    Back to login
                  </Link>
                </AuthButton>
                <p className="text-center text-xs text-muted-foreground">
                  Didn&apos;t receive it?{" "}
                  <button
                    type="button"
                    className={authLinkClassName}
                    onClick={() => setSubmitted(false)}
                  >
                    Try again
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                )}

                <div>
                  <Label htmlFor="email" className="text-foreground">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    className={`mt-1 border-border bg-background text-foreground placeholder:text-muted-foreground ${authInputFocusClassName}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoFocus
                  />
                </div>

                <AuthButton
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </AuthButton>

                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{" "}
                  <Link to="/login" className={authLinkClassName}>
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthPageShell>
  );
}
