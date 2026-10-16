import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Save } from "lucide-react";
import { useTenantManagement } from "../hooks/useTenantManagement";
import { userApi } from "../providers/UserApi";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "../components/ui/use-toast";
import UserOwnerCombobox from "../components/tenant/UserOwnerCombobox";
import { isValidEmail } from "../utils/authUtils";
import { SubscriptionTierSlug } from "../types/subscriptionTier";
import { ApplicationUser, CreateTenantRequest } from "../models";
import { useLogger } from "../logger/useLogger";

const TENANT_NAME_MAX = 200;
const DISPLAY_NAME_MAX = 200;
const BILLING_NAME_MAX = 200;
const BILLING_EMAIL_MAX = 255;

const SUPPORTED_TIER_OPTIONS = Object.values(SubscriptionTierSlug);

const toTierLabel = (tier: SubscriptionTierSlug): string =>
  tier.charAt(0).toUpperCase() + tier.slice(1);

function TenantEdit() {
  const navigate = useNavigate();
  const logger = useLogger("TenantEdit");
  const { createTenant, isCreatingTenant } = useTenantManagement();

  const [ownerOptions, setOwnerOptions] = useState<ApplicationUser[]>([]);

  const [tenantName, setTenantName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    userApi
      .getUsers()
      .then((users) => {
        if (cancelled) return;
        setOwnerOptions(users.map((user) => new ApplicationUser(user)));
      })
      .catch((err) => {
        logger.UI.error("Failed to load users for owner selection:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [logger]);

  const billingEmailTrimmed = billingEmail.trim();
  const billingEmailInvalid =
    billingEmailTrimmed.length > 0 && !isValidEmail(billingEmailTrimmed);

  const handleSave = async () => {
    if (!tenantName.trim()) {
      toast({
        title: "Validation error",
        description: "Tenant name is required.",
        variant: "destructive",
      });
      return;
    }
    if (!displayName.trim()) {
      toast({
        title: "Validation error",
        description: "Display name is required.",
        variant: "destructive",
      });
      return;
    }
    if (!ownerId) {
      toast({
        title: "Validation error",
        description: "An owner must be selected.",
        variant: "destructive",
      });
      return;
    }
    if (billingEmailInvalid) {
      toast({
        title: "Validation error",
        description: "Please enter a valid billing email address.",
        variant: "destructive",
      });
      return;
    }

    const request = new CreateTenantRequest({
      tenantName: tenantName.trim(),
      displayName: displayName.trim(),
      subscriptionTier: subscriptionTier || undefined,
      ownerId: ownerId || undefined,
      billingName: billingName.trim() || undefined,
      email: billingEmailTrimmed || undefined,
    });

    try {
      const created = await createTenant(request);
      toast({
        title: "Tenant created",
        description: "Tenant created successfully.",
      });
      setTimeout(
        () => navigate(`/administration/tenants/${created.tenantId}`),
        1000,
      );
    } catch (err) {
      logger.UI.error("Failed to create tenant:", err);
      toast({
        title: "Failed to create tenant",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-full p-6 pb-28 md:p-8 md:pb-32">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm md:p-7">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Add Tenant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new tenant account and assign its initial owner and tier.
          </p>
        </div>

        <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border bg-muted/50">
            <CardTitle className="text-lg font-medium text-foreground">
              Tenant Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="tenantName" className="text-sm text-foreground">
                  Tenant Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tenantName"
                  type="text"
                  value={tenantName}
                  maxLength={TENANT_NAME_MAX}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Company or workspace name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="displayName" className="text-sm text-foreground">
                  Display Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  maxLength={DISPLAY_NAME_MAX}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Name shown to users"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="owner" className="text-sm text-foreground">
                  Owner <span className="text-destructive">*</span>
                </Label>
                <UserOwnerCombobox
                  id="owner"
                  options={ownerOptions}
                  value={ownerId}
                  onChange={setOwnerId}
                  placeholder="Select owner"
                />
              </div>
              <div>
                <Label
                  htmlFor="subscriptionTier"
                  className="text-sm text-foreground"
                >
                  Subscription Tier
                </Label>
                <Select
                  value={subscriptionTier || "none"}
                  onValueChange={(value) =>
                    setSubscriptionTier(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger id="subscriptionTier" className="mt-1">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Default</SelectItem>
                    {SUPPORTED_TIER_OPTIONS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {toTierLabel(tier)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border bg-muted/50">
            <CardTitle className="text-lg font-medium text-foreground">
              Billing
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Optional billing contact details for the tenant.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="billingName" className="text-sm text-foreground">
                  Billing Name
                </Label>
                <Input
                  id="billingName"
                  type="text"
                  value={billingName}
                  maxLength={BILLING_NAME_MAX}
                  onChange={(e) => setBillingName(e.target.value)}
                  placeholder="Billing contact name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="billingEmail" className="text-sm text-foreground">
                  Billing Email
                </Label>
                <Input
                  id="billingEmail"
                  type="email"
                  value={billingEmail}
                  maxLength={BILLING_EMAIL_MAX}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="billing@example.com"
                  className="mt-1"
                />
                {billingEmailInvalid && (
                  <p className="mt-1 text-xs text-destructive">
                    Please enter a valid email address.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/90 bg-card/95 p-4 shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={isCreatingTenant}
            onClick={() => navigate("/administration/tenants")}
          >
            Cancel
          </Button>

          <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
            <Button
              onClick={handleSave}
              disabled={isCreatingTenant}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              <Save className="mr-2 h-4 w-4" />
              {isCreatingTenant ? "Creating..." : "Create Tenant"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TenantEdit;
