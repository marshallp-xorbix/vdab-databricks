import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useIdentity } from "../../context/IdentityContext";
import {
  useAccountSetupStatus,
  useInvalidateAccountSetupStatus,
} from "../../hooks/useAccountSetupStatus";
import { identityApi } from "../../providers/IdentityApi";
import { AuthPageShell } from "../../components/AuthPageShell";
import PolicyDocumentPanel from "../../components/PolicyDocumentPanel";
import { Button } from "../../components/ui/button";
import { toast } from "../../components/ui/use-toast";
import { useLogger } from "../../logger/useLogger";
import {
  PRIVACY_POLICY_SLUG,
  PRIVACY_POLICY_URL,
  TERMS_AND_CONDITIONS_SLUG,
  TERMS_AND_CONDITIONS_URL,
} from "../../constants/legalLinks";
import { authSpinnerClassName } from "../../constants/authBranding";

type PolicyKind = "terms-of-service" | "privacy-policy";

interface PolicyDef {
  kind: PolicyKind;
  title: string;
  slug: string;
  externalUrl: string;
  versionDate: string;
}

export default function PolicyAcceptancePage() {
  const { user, isLoading, isLoaded } = useIdentity();
  const navigate = useNavigate();
  const logger = useLogger("PolicyAcceptancePage");
  const invalidateAccountSetupStatus = useInvalidateAccountSetupStatus();

  const setupStatusQuery = useAccountSetupStatus({
    userId: user?.userId,
    tenantId: user?.tenantId,
    enabled: isLoaded && !isLoading && !!user,
  });

  const status = setupStatusQuery.data;

  const pendingPolicies = useMemo<PolicyDef[]>(() => {
    if (!status) return [];
    const list: PolicyDef[] = [];
    if (status.needsTermsOfServiceAcceptance) {
      list.push({
        kind: "terms-of-service",
        title: "Terms and Conditions",
        slug: TERMS_AND_CONDITIONS_SLUG,
        externalUrl: TERMS_AND_CONDITIONS_URL,
        versionDate: status.latestTermsOfServiceVersionDate,
      });
    }
    if (status.needsPrivacyPolicyAcceptance) {
      list.push({
        kind: "privacy-policy",
        title: "Privacy Policy",
        slug: PRIVACY_POLICY_SLUG,
        externalUrl: PRIVACY_POLICY_URL,
        versionDate: status.latestPrivacyPolicyVersionDate,
      });
    }
    return list;
  }, [status]);

  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If user lands here but nothing needs acceptance, bounce back to apps.
  useEffect(() => {
    if (!status) return;
    if (!status.needsPolicyAcceptance) {
      navigate("/apps", { replace: true });
    }
  }, [status, navigate]);

  if (!isLoaded || isLoading || setupStatusQuery.isPending || !status) {
    return (
      <AuthPageShell variant="setup">
        <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
      </AuthPageShell>
    );
  }

  if (pendingPolicies.length === 0) {
    return null; // Redirect effect above will fire.
  }

  const isSingle = pendingPolicies.length === 1;

  const heading = isSingle
    ? `Updated ${pendingPolicies[0].title}`
    : "Updated Policies";

  const checkboxLabel = `I have read and agree to the ${pendingPolicies
    .map((p) => p.title)
    .join(" and ")}`;

  const handleSubmit = async () => {
    if (!checked || submitting) return;

    setSubmitting(true);
    try {
      const acceptTermsOfService = pendingPolicies.some(
        (p) => p.kind === "terms-of-service",
      );
      const acceptPrivacyPolicy = pendingPolicies.some(
        (p) => p.kind === "privacy-policy",
      );

      logger.UI.log("acceptPolicy: started", {
        acceptTermsOfService,
        acceptPrivacyPolicy,
      });
      await identityApi.acceptPolicies({
        acceptTermsOfService,
        acceptPrivacyPolicy,
      });
      logger.UI.log("acceptPolicy: succeeded", {
        acceptTermsOfService,
        acceptPrivacyPolicy,
      });

      logger.UI.log(
        "acceptPolicy: invalidating status and navigating to /apps",
      );
      await invalidateAccountSetupStatus();
      toast({
        title: "Thanks!",
        description: "Your acceptance has been recorded.",
      });
      // Let AuthenticatedLayout decide the next route based on refreshed status.
      navigate("/apps", { replace: true });
    } catch (error) {
      logger.handleError(error, "Failed to record policy acceptance");
      toast({
        title: "Something went wrong",
        description: "We couldn't record your acceptance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell variant="setup">
      <div
        className={`mx-auto flex w-full flex-col gap-4 ${
          isSingle ? "max-w-4xl" : "max-w-6xl"
        }`}
      >
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Before continuing, please review the latest version of our{" "}
            {pendingPolicies.map((p) => p.title).join(" and ")}.
          </p>
        </div>

        <div
          className={
            isSingle
              ? "grid grid-cols-1 gap-4"
              : "grid grid-cols-1 gap-4 lg:grid-cols-2"
          }
        >
          {pendingPolicies.map((policy) => (
            <PolicyDocumentPanel
              key={policy.kind}
              title={policy.title}
              slug={policy.slug}
              externalUrl={policy.externalUrl}
              versionDate={policy.versionDate}
              isSingle={isSingle}
            />
          ))}
        </div>

        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={submitting}
            />
            <span>{checkboxLabel}</span>
          </label>
          <Button
            onClick={handleSubmit}
            disabled={!checked || submitting}
            className="bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Accept and continue"
            )}
          </Button>
        </div>
      </div>
    </AuthPageShell>
  );
}
