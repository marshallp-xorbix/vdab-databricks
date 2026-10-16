import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { AuthPageShell } from "../components/AuthPageShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { AuthButton } from "../components/AuthButton";
import { toast } from "../components/ui/use-toast";
import { useIdentity } from "../context/IdentityContext";
import { useTenantContext } from "../context/TenantContext";
import { tenantInviteApi } from "../api/TenantInviteApi";
import { useLogger } from "../logger/useLogger";
import { parseError } from "../lib/utils";
import type { IInviteValidationResponse } from "../models";

type Status = "loading" | "invalid" | "ready" | "accepting" | "success";

function AcceptInvitePage() {
  const logger = useLogger("AcceptInvitePage");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { user, isLoaded } = useIdentity();
  const { refreshTenants, switchTenant } = useTenantContext();

  const [status, setStatus] = useState<Status>("loading");
  const [validation, setValidation] =
    useState<IInviteValidationResponse | null>(null);
  const [message, setMessage] = useState("Validating your invite…");

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
        setValidation(result);
        if (!result.isValid) {
          setStatus("invalid");
          setMessage(
            result.reason
              ? `This invite is no longer valid (${result.reason}).`
              : "This invite is no longer valid.",
          );
          return;
        }
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
  }, [token, logger]);

  // Once validation and identity are known, decide next step.
  useEffect(() => {
    if (!isLoaded || status !== "ready" || !validation?.isValid) return;

    const redirectTarget = `/accept-invite?token=${encodeURIComponent(token)}`;

    if (!user) {
      if (validation.userExists === false) {
        // Brand-new invitee: send to the create-and-accept page.
        navigate(`/accept-invite/register?token=${encodeURIComponent(token)}`, {
          replace: true,
        });
        return;
      }
      // User exists (or flag absent) — send to login and bounce back here.
      navigate(`/login?redirect=${encodeURIComponent(redirectTarget)}`, {
        replace: true,
      });
      return;
    }

    if (
      validation.email &&
      user.email &&
      validation.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      toast({
        title: "This invite is for a different email",
        description: `Sign in as ${validation.email} to accept.`,
        variant: "destructive",
      });
      navigate("/account", { replace: true });
    }
  }, [isLoaded, status, validation, user, token, navigate]);

  const handleAccept = async () => {
    setStatus("accepting");
    try {
      await tenantInviteApi.acceptInvite(token);
      await refreshTenants();
      if (validation?.tenantId) {
        await switchTenant(validation.tenantId);
      }
      setStatus("success");
      toast({ title: "Invite accepted" });
      setTimeout(() => navigate("/apps"), 1500);
    } catch (err) {
      logger.handleError(err, "acceptInvite");
      const detail = parseError(err).message || null;
      setStatus("invalid");
      setMessage(detail ?? "Failed to accept invite. Please try again.");
      toast({
        title: "Failed to accept invite",
        description: detail ?? undefined,
        variant: "destructive",
      });
    }
  };

  const showAcceptCard =
    status === "ready" &&
    isLoaded &&
    !!user &&
    (!validation?.email ||
      !user.email ||
      validation.email.toLowerCase() === user.email.toLowerCase());

  return (
    <AuthPageShell variant={user ? "authenticated" : "guest"}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Accept invite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex justify-center items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{message}</span>
            </div>
          )}

          {status === "invalid" && (
            <div className="flex flex-col items-center gap-3 text-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-foreground">{message}</p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => navigate("/")}
              >
                Go home
              </Button>
            </div>
          )}

          {showAcceptCard && validation && (
            <AcceptInviteBody
              validation={validation}
              status={status}
              onAccept={handleAccept}
            />
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-sm text-foreground">
                You've joined the workspace. Redirecting…
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}

export default AcceptInvitePage;

interface IAcceptInviteBodyProps {
  validation: IInviteValidationResponse;
  status: Status;
  onAccept: () => void;
}

function AcceptInviteBody({
  validation,
  status,
  onAccept,
}: Readonly<IAcceptInviteBodyProps>) {
  const isAccepting = status === "accepting";
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground text-center">
        You've been invited to join{" "}
        <strong>{validation.tenantDisplayName ?? "a workspace"}</strong>
        {validation.email ? ` as ${validation.email}` : ""}.
      </p>
      <AuthButton
        className="mt-2 w-full"
        onClick={onAccept}
        disabled={isAccepting}
      >
        {isAccepting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Accepting…
          </>
        ) : (
          "Accept invite"
        )}
      </AuthButton>
    </div>
  );
}
