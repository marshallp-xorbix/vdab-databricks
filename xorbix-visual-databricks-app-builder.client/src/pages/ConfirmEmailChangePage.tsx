import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { identityApi } from "../providers/IdentityApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthPageShell } from "../components/AuthPageShell";
import { authSpinnerClassName } from "../constants/authBranding";
import { useLogger } from "../logger/useLogger";

export default function ConfirmEmailChangePage() {
  const logger = useLogger("ConfirmEmailChangePage");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userId = searchParams.get("userId");
  const newEmail = searchParams.get("newEmail");
  const confirmToken = searchParams.get("confirmToken");

  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!userId || !newEmail || !confirmToken) {
      setError("Invalid link parameters.");
      return;
    }

    setStatus("loading");
    try {
      await identityApi.confirmEmailChange(userId, newEmail, confirmToken);
      setStatus("success");
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      logger.handleError(err, "confirmEmailChange");
      setStatus("error");
      setError("Failed to confirm email change. The link may be expired.");
    }
  };

  const handleCancel = () => {
    navigate("/login");
  };

  if (!userId || !newEmail || !confirmToken) {
    return (
      <AuthPageShell>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium text-destructive-foreground">Invalid Link</p>
            <p className="text-muted-foreground text-center mt-2">
              The link you followed is missing required information.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="mt-6"
              variant="outline"
            >
              Go to Login
            </Button>
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
            Confirm Email Change
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Security Check
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center space-y-6">
          {status === "idle" && (
            <>
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  A request was made to change your email address to:
                </p>
                <p className="text-lg font-semibold text-foreground bg-muted py-2 px-4 rounded-md border border-border">
                  {newEmail}
                </p>
                <p className="text-muted-foreground text-sm">
                  If you did not request this change, please click "No, cancel".
                </p>
              </div>
              <div className="flex gap-4 w-full">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 border-border hover:bg-muted/60 text-foreground"
                >
                  No, cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1 bg-primary text-primary-foreground hover:opacity-90"
                >
                  Yes, confirm
                </Button>
              </div>
            </>
          )}

          {status === "loading" && (
            <div className="flex flex-col items-center py-4">
              <Loader2
                className={`h-10 w-10 animate-spin mb-4 ${authSpinnerClassName}`}
              />
              <p className="text-muted-foreground">Processing request...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Email Changed!
              </h3>
              <p className="text-muted-foreground">
                Your email address has been successfully updated. Sign in with
                your new email address.
              </p>
              <p className="text-muted-foreground text-sm mt-4">
                Redirecting to login...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center py-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-xl font-semibold text-destructive-foreground mb-2">Error</h3>
              <p className="text-muted-foreground">{error}</p>
              <Button
                onClick={() => navigate("/login")}
                className="mt-6"
                variant="outline"
              >
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
