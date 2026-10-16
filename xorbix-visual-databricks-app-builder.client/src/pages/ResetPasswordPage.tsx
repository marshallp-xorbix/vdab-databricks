import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { identityApi } from "../providers/IdentityApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../components/ui/card";
import { AuthButton } from "../components/AuthButton";
import { PasswordFields } from "../components/PasswordFields";
import { isPasswordFormValid } from "../utils/authUtils";
import { Loader2 } from "lucide-react";
import { AuthPageShell } from "../components/AuthPageShell";
import { authSpinnerClassName } from "../constants/authBranding";
import { useClientConfig } from "../hooks/useClientConfig";
import { useLogger } from "../logger/useLogger";

export default function ResetPasswordPage() {
  const logger = useLogger("ResetPasswordPage");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { passwordlessOnly, isConfigLoaded } = useClientConfig();

  const userId = searchParams.get("userId");
  const resetToken = searchParams.get("resetToken");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId || !resetToken) {
      setError("Invalid reset link.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isPasswordFormValid(password, confirmPassword)) {
      setError("Please satisfy all password requirements.");
      return;
    }

    setLoading(true);
    try {
      await identityApi.resetPassword({
        userId,
        token: resetToken,
        newPassword: password,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      logger.handleError(err, "resetPassword");
      setError("Failed to reset password. The link may be expired.");
    } finally {
      setLoading(false);
    }
  };

  // Password reset is disabled in passwordless-only mode; wait for config, then route away rather than
  // showing a form whose submission the backend would reject.
  if (!isConfigLoaded) {
    return (
      <AuthPageShell>
        <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
      </AuthPageShell>
    );
  }

  if (passwordlessOnly) {
    return <Navigate to="/login" replace />;
  }

  if (success) {
    return (
      <AuthPageShell>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-12 w-12 rounded-full bg-success-subtle flex items-center justify-center">
              <svg
                className="h-6 w-6 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Password Reset Complete
            </h2>
            <p className="text-muted-foreground text-center">
              Your password has been successfully updated. Redirecting to
              login...
            </p>
            <AuthButton onClick={() => navigate("/login")} className="mt-4">
              Go to Login
            </AuthButton>
          </CardContent>
        </Card>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Reset Password
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your new password below.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordFields
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
            />

            <AuthButton
              type="submit"
              disabled={loading || !isPasswordFormValid(password, confirmPassword)}
              className="mt-2 w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </AuthButton>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <AuthButton variant="outline" onClick={() => navigate("/login")}>
            Back to Login
          </AuthButton>
        </CardFooter>
      </Card>
    </AuthPageShell>
  );
}
