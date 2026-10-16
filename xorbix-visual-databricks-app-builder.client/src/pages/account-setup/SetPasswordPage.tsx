import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { Loader2, CheckCircle } from "lucide-react";
import { AuthButton } from "../../components/AuthButton";
import { PasswordFields } from "../../components/PasswordFields";
import { isPasswordFormValid } from "../../utils/authUtils";
import { identityApi } from "../../providers/IdentityApi";
import { useClientConfig } from "../../hooks/useClientConfig";
import { useLogger } from "../../logger/useLogger";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { AuthPageShell } from "../../components/AuthPageShell";
import { authSpinnerClassName } from "../../constants/authBranding";

export default function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const logger = useLogger("SetPasswordPage");

  const { passwordlessOnly, isConfigLoaded } = useClientConfig();

  const userId = searchParams.get("userId") ?? "";
  const resetToken = searchParams.get("resetToken") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isCheckingPasswordStatus, setIsCheckingPasswordStatus] =
    useState(true);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!success) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [success, navigate]);

  useEffect(() => {
    let isDisposed = false;

    async function checkPasswordStatus() {
      try {
        logger.UI.log("checkPasswordStatus: started", { userId });
        const isPasswordAlreadySet =
          await identityApi.isPasswordAlreadySet(userId);
        logger.UI.log("checkPasswordStatus: result", {
          isPasswordAlreadySet,
        });

        if (!isDisposed && isPasswordAlreadySet) {
          logger.UI.log(
            "checkPasswordStatus: password already set — redirecting to /login",
          );
          navigate("/login", { replace: true });
        }
      } catch (ex) {
        logger.handleError(ex, "checkPasswordStatus");
        // Keep on this step when status check fails.
      } finally {
        if (!isDisposed) {
          setIsCheckingPasswordStatus(false);
        }
      }
    }

    void checkPasswordStatus();

    return () => {
      isDisposed = true;
    };
  }, [userId, navigate]);

  // Setting a password is meaningless in passwordless-only mode (and the backend rejects it). This page is
  // only reachable there via a stale link or manual nav, so wait for config then route away.
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

  if (isCheckingPasswordStatus) {
    return (
      <AuthPageShell>
        <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
      </AuthPageShell>
    );
  }

  if (success) {
    return (
      <AuthPageShell>
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6">
            <div className="space-y-4 text-center">
              <div className="h-12 w-12 rounded-full bg-success-subtle flex items-center justify-center mx-auto">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Password set successfully!
              </h3>
              <p className="text-sm text-muted-foreground">
                Redirecting to login in {countdown} second
                {countdown !== 1 && "s"}...
              </p>
              <AuthButton className="w-full" onClick={() => navigate("/login")}>
                Go to Login Now
              </AuthButton>
            </div>
          </CardContent>
        </Card>
      </AuthPageShell>
    );
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isPasswordFormValid(password, confirmPassword)) {
      setError("Please satisfy all password requirements.");
      return;
    }

    setLoading(true);
    try {
      logger.UI.log("resetPassword: started", { userId });
      await identityApi.resetPassword({
        userId,
        token: resetToken,
        newPassword: password,
        confirmPassword,
      });
      logger.UI.log("resetPassword: succeeded");
      setSuccess(true);
    } catch (err: unknown) {
      logger.handleError(err, "SetPasswordPage.resetPassword");
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to set password. The link may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Password</CardTitle>
          <CardDescription>
            Create a secure password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={handleSetPassword} className="space-y-4">
            <PasswordFields
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
            />
            <AuthButton
              type="submit"
              className="w-full"
              disabled={
                loading || !isPasswordFormValid(password, confirmPassword)
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting password...
                </>
              ) : (
                "Set Password"
              )}
            </AuthButton>
          </form>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
