import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, XCircle } from "lucide-react";
import { AuthButton } from "../components/AuthButton";
import { AuthPageShell } from "../components/AuthPageShell";
import { PasswordFields } from "../components/PasswordFields";
import TermsAndPrivacyCheckbox from "../components/TermsAndPrivacyCheckbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { toast } from "../components/ui/use-toast";
import { useIdentity } from "../context/IdentityContext";
import { useClientConfig } from "../hooks/useClientConfig";
import { tenantInviteApi } from "../api/TenantInviteApi";
import { useLogger } from "../logger/useLogger";
import { isPasswordFormValid } from "../utils/authUtils";
import type { IInviteValidationResponse } from "../models";

type Status = "loading" | "invalid" | "ready" | "submitting";

function AcceptInviteRegisterPage() {
  const logger = useLogger("AcceptInviteRegisterPage");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { login, applySession } = useIdentity();
  const { passwordlessOnly, isConfigLoaded } = useClientConfig();

  const [status, setStatus] = useState<Status>("loading");
  const [validation, setValidation] =
    useState<IInviteValidationResponse | null>(null);
  const [message, setMessage] = useState("Validating your invite…");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setMessage("Invalid or missing invite token.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await tenantInviteApi.validateToken(token);
        if (cancelled) return;

        if (!result.isValid) {
          setValidation(result);
          setStatus("invalid");
          setMessage(
            result.reason
              ? `This invite is no longer valid (${result.reason}).`
              : "This invite is no longer valid.",
          );
          return;
        }

        if (result.userExists) {
          // An account already exists — fall back to the standard accept flow.
          navigate(`/accept-invite?token=${encodeURIComponent(token)}`, {
            replace: true,
          });
          return;
        }

        setValidation(result);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        logger.handleError(err, "validateToken");
        setStatus("invalid");
        setMessage("Failed to validate invite. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, logger, navigate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!passwordlessOnly && !isPasswordFormValid(password, confirmPassword)) {
      setError("Please satisfy all password requirements.");
      return;
    }
    if (!termsAccepted) {
      setError("You must accept the Terms of Service and Privacy Policy.");
      return;
    }

    setStatus("submitting");
    try {
      const response = await tenantInviteApi.registerAndAcceptInvite({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        // In passwordless-only mode the account is created without a password.
        password: passwordlessOnly ? undefined : password,
      });

      // Passwordless-only: invite acceptance signs the user in directly (no separate sign-in).
      if (response.authResponse) {
        await applySession(response.authResponse);
        toast({ title: "Welcome!" });
        navigate("/apps", { replace: true });
        return;
      }

      // Password-based: sign in with the password just chosen.
      if (!passwordlessOnly && validation?.email) {
        try {
          await login(validation.email, password);
          toast({ title: "Welcome!" });
          navigate("/apps", { replace: true });
          return;
        } catch (loginErr) {
          logger.handleError(loginErr, "loginAfterRegister");
          toast({
            title: "Account created — please sign in",
          });
          navigate("/login", { replace: true });
          return;
        }
      }

      // Fallback (e.g. passwordless mode where token issuance failed): route to sign-in.
      navigate("/login", { replace: true });
    } catch (err) {
      logger.handleError(err, "registerAndAcceptInvite");
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to create account. Please try again.";
      setError(msg);
      setStatus("ready");
    }
  }

  if (status === "loading" || !isConfigLoaded) {
    return (
      <AuthPageShell>
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </CardContent>
        </Card>
      </AuthPageShell>
    );
  }

  if (status === "invalid") {
    return (
      <AuthPageShell>
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 flex flex-col items-center gap-3">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-foreground">{message}</p>
            <AuthButton
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
            >
              Go home
            </AuthButton>
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
              {validation?.tenantDisplayName
                ? `You've been invited to join ${validation.tenantDisplayName}.`
                : "You've been invited to join a workspace."}
              {validation?.email && (
                <>
                  <br />
                  <span className="text-xs">
                    Signing up as {validation.email}
                  </span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                  />
                </div>
              </div>
              {!passwordlessOnly && (
                <PasswordFields
                  password={password}
                  confirmPassword={confirmPassword}
                  onPasswordChange={setPassword}
                  onConfirmPasswordChange={setConfirmPassword}
                />
              )}
              <TermsAndPrivacyCheckbox
                checked={termsAccepted}
                onCheckedChange={setTermsAccepted}
              />
              <AuthButton
                type="submit"
                className="w-full mt-2"
                disabled={
                  status === "submitting" ||
                  !firstName.trim() ||
                  !lastName.trim() ||
                  !termsAccepted ||
                  (!passwordlessOnly &&
                    !isPasswordFormValid(password, confirmPassword))
                }
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create account & accept invite"
                )}
              </AuthButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </AuthPageShell>
  );
}

export default AcceptInviteRegisterPage;
