import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { identityApi } from "../providers/IdentityApi";
import { useIdentity } from "../context/IdentityContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { AuthButton } from "../components/AuthButton";
import { AuthPageShell } from "../components/AuthPageShell";
import { authSpinnerClassName } from "../constants/authBranding";
import { useLogger } from "../logger/useLogger";

const REDIRECT_DELAY_MS = 2000;

export default function ConfirmEmailPage() {
  const logger = useLogger("ConfirmEmailPage");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { applySession } = useIdentity();

  const userId = searchParams.get("userId");
  const confirmToken = searchParams.get("confirmToken");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (!userId || !confirmToken) {
      setStatus("error");
      setMessage("Invalid confirmation link.");
      return;
    }

    const confirm = async () => {
      try {
        logger.UI.log("confirmEmail: started", { userId });
        const response = await identityApi.confirmEmail({
          userId,
          token: confirmToken,
        });
        logger.UI.log("confirmEmail: succeeded", {
          requiresPasswordSetup: response.requiresPasswordSetup,
          hasResetToken: !!response.passwordResetToken,
          autoSignIn: !!response.authResponse,
        });
        setStatus("success");

        // Passwordless-only mode: the confirmation itself signs the user in. Establish the session, then
        // continue straight into the app instead of bouncing through a separate sign-in.
        if (response.authResponse) {
          setMessage("Email confirmed! Signing you in...");
          await applySession(response.authResponse);
          setTimeout(() => {
            logger.UI.log("confirmEmail: auto sign-in, navigating to /apps");
            navigate("/apps", { replace: true });
          }, REDIRECT_DELAY_MS);
          return;
        }

        setMessage("Email confirmed successfully!");

        // Password-based mode: redirect based on whether the user still needs to set a password.
        setTimeout(() => {
          if (
            response.requiresPasswordSetup &&
            response.userId &&
            response.passwordResetToken
          ) {
            const params = new URLSearchParams({
              userId: response.userId,
              resetToken: response.passwordResetToken,
            });
            logger.UI.log("confirmEmail: navigating to /set-password");
            navigate(`/set-password?${params.toString()}`);
          } else {
            logger.UI.log("confirmEmail: navigating to /login");
            navigate("/login");
          }
        }, REDIRECT_DELAY_MS);
      } catch (error) {
        logger.handleError(error, "confirmEmail");
        setStatus("error");
        setMessage(
          "Failed to confirm email. The link may be invalid or expired.",
        );
      }
    };

    confirm();
  }, [userId, confirmToken, navigate, applySession]);

  return (
    <AuthPageShell>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Email Confirmation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
              <p className="text-muted-foreground">{message}</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="text-lg font-medium text-success-foreground">{message}</p>
              <p className="text-sm text-muted-foreground">Redirecting...</p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-lg font-medium text-destructive-foreground">{message}</p>
              <AuthButton
                variant="outline"
                onClick={() => navigate("/login")}
                className="mt-4"
              >
                Back to Login
              </AuthButton>
            </>
          )}
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
