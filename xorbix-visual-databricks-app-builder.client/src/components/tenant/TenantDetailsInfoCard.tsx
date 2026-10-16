import { useState, type ReactNode } from "react";
import { Edit, Info, Save, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { isValidEmail } from "../../utils/authUtils";
import type { Tenant, ApplicationUser } from "../../models";
import type { IUpdateTenantRequest } from "../../api/TenantApi";
import { SubscriptionTierSlug } from "../../types/subscriptionTier";
import TenantTrialExtendField from "./TenantTrialExtendField";
import UserOwnerCombobox from "./UserOwnerCombobox";

const TENANT_NAME_MAX = 200;
const DISPLAY_NAME_MAX = 200;
const INVOICE_NAME_MAX = 200;
const INVOICE_EMAIL_MAX = 255;

const SUPPORTED_TIER_OPTIONS = Object.values(SubscriptionTierSlug);

const toTierLabel = (tier: SubscriptionTierSlug): string =>
  tier.charAt(0).toUpperCase() + tier.slice(1);

const normalizeTierSlug = (tier: string | undefined): string => {
  const normalized = (tier ?? "").trim().toLowerCase();
  return SUPPORTED_TIER_OPTIONS.includes(normalized as SubscriptionTierSlug)
    ? normalized
    : "";
};

interface ITenantDetailsInfoCardProps {
  tenant: Tenant;
  ownerOptions: ApplicationUser[];
  ownerDisplay: string;
  saving: boolean;
  onSave: (data: IUpdateTenantRequest) => Promise<void>;
  canExtendTrial?: boolean;
  extendingTrial?: boolean;
  onExtendTrial?: (newTrialEndDate: Date) => Promise<void>;
}

interface IFieldLabelProps {
  htmlFor?: string;
  children: ReactNode;
  tooltip?: string;
}

const FieldLabel = ({
  htmlFor,
  children,
  tooltip,
}: Readonly<IFieldLabelProps>) => (
  <div className="flex items-center gap-1.5">
    <Label htmlFor={htmlFor} className="text-sm text-muted-foreground">
      {children}
    </Label>
    {tooltip && (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs px-3 py-2 text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    )}
  </div>
);

const formatDate = (
  value: string | Date | undefined,
  withTime = false,
): string => {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
};

const stripeSubscriptionUrl = (id: string): string =>
  `https://dashboard.stripe.com/subscriptions/${id}`;

const stripeCustomerUrl = (id: string): string =>
  `https://dashboard.stripe.com/customers/${id}`;

const formatCancelAtPeriodEnd = (value: boolean | undefined): string => {
  if (value === undefined) return "N/A";
  return value ? "Yes" : "No";
};

const TenantDetailsInfoCard = ({
  tenant,
  ownerOptions,
  ownerDisplay,
  saving,
  onSave,
  canExtendTrial = false,
  extendingTrial = false,
  onExtendTrial,
}: Readonly<ITenantDetailsInfoCardProps>) => {
  const [editing, setEditing] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("");
  const [maxUsers, setMaxUsers] = useState<number>(0);
  const [maxPublishedApps, setMaxPublishedApps] = useState<number>(0);
  const [maxWorkspaceConnections, setMaxWorkspaceConnections] =
    useState<number>(0);

  const invoiceEmailTrimmed = invoiceEmail.trim();
  const invoiceEmailInvalid =
    invoiceEmailTrimmed.length > 0 && !isValidEmail(invoiceEmailTrimmed);

  const canSave =
    tenantName.trim().length > 0 &&
    tenantName.length <= TENANT_NAME_MAX &&
    displayName.trim().length > 0 &&
    displayName.length <= DISPLAY_NAME_MAX &&
    invoiceName.length <= INVOICE_NAME_MAX &&
    invoiceEmail.length <= INVOICE_EMAIL_MAX &&
    !invoiceEmailInvalid &&
    maxUsers >= 0 &&
    maxPublishedApps >= 0 &&
    maxWorkspaceConnections >= 0;

  const startEditing = () => {
    setTenantName(tenant.tenantName ?? "");
    setDisplayName(tenant.displayName ?? "");
    setInvoiceName(tenant.invoiceName ?? "");
    setInvoiceEmail(tenant.invoiceEmail ?? "");
    setOwnerId(tenant.ownerId ?? "");
    setSubscriptionTier(normalizeTierSlug(tenant.subscriptionTier));
    setMaxUsers(tenant.maxUsers ?? 0);
    setMaxPublishedApps(tenant.maxPublishedApps ?? 0);
    setMaxWorkspaceConnections(tenant.maxWorkspaceConnections ?? 0);
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const handleSave = async () => {
    if (!canSave) return;
    await onSave({
      tenantName: tenantName.trim(),
      displayName: displayName.trim(),
      invoiceName: invoiceName.trim() || null,
      invoiceEmail: invoiceEmailTrimmed || null,
      ownerId: ownerId || null,
      subscriptionTier: subscriptionTier || null,
      maxUsers,
      maxPublishedApps,
      maxWorkspaceConnections,
    });
    setEditing(false);
  };

  return (
    <Card
      id="tenant-basic-information"
      className="rounded-xl border border-border bg-card shadow-sm"
    >
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Tenant Details
          </CardTitle>
          {!editing && (
            <Button
              title="Edit"
              variant="ghost"
              size="icon"
              onClick={startEditing}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Section 1: Basic Information */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
          {editing ? (
            <div>
              <FieldLabel
                htmlFor="tenantName"
                tooltip="Unique name/identifier for the tenant (e.g., company name or subdomain). Max 200 characters."
              >
                Tenant Name
              </FieldLabel>
              <Input
                id="tenantName"
                value={tenantName}
                maxLength={TENANT_NAME_MAX}
                onChange={(e) => setTenantName(e.target.value)}
                className="mt-1"
              />
            </div>
          ) : (
            <div>
              <FieldLabel tooltip="Unique name/identifier for the tenant (e.g., company name or subdomain).">
                Tenant Name
              </FieldLabel>
              <p className="mt-1 text-sm font-medium text-foreground">
                {tenant.tenantName || "N/A"}
              </p>
            </div>
          )}

          {editing ? (
            <div>
              <FieldLabel
                htmlFor="tenantDisplayName"
                tooltip="The name that will be displayed to users. Max 200 characters."
              >
                Display Name
              </FieldLabel>
              <Input
                id="tenantDisplayName"
                value={displayName}
                maxLength={DISPLAY_NAME_MAX}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1"
              />
            </div>
          ) : (
            <div>
              <FieldLabel tooltip="The name that will be displayed to users.">
                Display Name
              </FieldLabel>
              <p className="mt-1 text-sm font-medium text-foreground">
                {tenant.displayName || "N/A"}
              </p>
            </div>
          )}

          {editing ? (
            <div>
              <FieldLabel tooltip="The user who owns this tenant.">
                Owner
              </FieldLabel>
              <UserOwnerCombobox
                options={ownerOptions}
                value={ownerId}
                onChange={setOwnerId}
                allowNone
                noneLabel="No owner"
                placeholder="Select owner"
              />
            </div>
          ) : (
            <div>
              <FieldLabel tooltip="The user who owns this tenant.">
                Owner
              </FieldLabel>
              <p className="mt-1 text-sm font-medium text-foreground">
                {ownerDisplay}
              </p>
            </div>
          )}

          <div>
            <Label className="text-sm text-muted-foreground">Created On</Label>
            <p className="mt-1 text-sm text-foreground">
              {formatDate(tenant.createdOn)}
            </p>
          </div>

          <div className="md:col-span-2">
            <FieldLabel tooltip="System-generated unique identifier for the tenant.">
              Tenant ID
            </FieldLabel>
            <p className="mt-1 truncate font-mono text-sm text-foreground">
              {tenant.tenantId || "N/A"}
            </p>
          </div>
        </div>

        {/* Section 2: Tier & Limits */}
        <div className="mt-6 border-t border-border pt-6">
          <h4 className="mb-4 text-sm font-semibold text-foreground">
            Tier & Limits
          </h4>
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
            {editing ? (
              <div>
                <FieldLabel tooltip="Manually override the subscription tier for support scenarios. Does not update Stripe billing.">
                  Subscription Tier Override
                </FieldLabel>
                <Select
                  value={subscriptionTier || "none"}
                  onValueChange={(value) =>
                    setSubscriptionTier(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No override</SelectItem>
                    {SUPPORTED_TIER_OPTIONS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {toTierLabel(tier)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 rounded border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-foreground">
                  Overriding the subscription tier here does not update Stripe
                  billing. Use only for support scenarios.
                </p>
              </div>
            ) : (
              <div>
                <Label className="text-sm text-muted-foreground">
                  Subscription Tier
                </Label>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {tenant.subscriptionTier || "N/A"}
                </p>
              </div>
            )}

            {editing ? (
              <div>
                <FieldLabel
                  htmlFor="maxUsers"
                  tooltip="Maximum number of users allowed for this tenant."
                >
                  Max Users
                </FieldLabel>
                <Input
                  id="maxUsers"
                  type="number"
                  min={0}
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <FieldLabel tooltip="Maximum number of users allowed for this tenant.">
                  Max Users
                </FieldLabel>
                <p className="mt-1 text-sm text-foreground">{tenant.maxUsers}</p>
              </div>
            )}

            {editing ? (
              <div>
                <FieldLabel
                  htmlFor="maxPublishedApps"
                  tooltip="Maximum number of published apps allowed for this tenant."
                >
                  Max Published Apps
                </FieldLabel>
                <Input
                  id="maxPublishedApps"
                  type="number"
                  min={0}
                  value={maxPublishedApps}
                  onChange={(e) => setMaxPublishedApps(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <FieldLabel tooltip="Maximum number of published apps allowed for this tenant.">
                  Max Published Apps
                </FieldLabel>
                <p className="mt-1 text-sm text-foreground">
                  {tenant.maxPublishedApps}
                </p>
              </div>
            )}

            {editing ? (
              <div>
                <FieldLabel
                  htmlFor="maxWorkspaceConnections"
                  tooltip="Maximum number of Databricks workspace connections allowed."
                >
                  Max Workspace Connections
                </FieldLabel>
                <Input
                  id="maxWorkspaceConnections"
                  type="number"
                  min={0}
                  value={maxWorkspaceConnections}
                  onChange={(e) =>
                    setMaxWorkspaceConnections(Number(e.target.value))
                  }
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <FieldLabel tooltip="Maximum number of Databricks workspace connections allowed.">
                  Max Workspace Connections
                </FieldLabel>
                <p className="mt-1 text-sm text-foreground">
                  {tenant.maxWorkspaceConnections}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Subscription */}
        <div className="mt-6 border-t border-border pt-6">
          <h4 className="mb-4 text-sm font-semibold text-foreground">
            Subscription
          </h4>
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
            {editing ? (
              <div>
                <FieldLabel
                  htmlFor="tenantInvoiceName"
                  tooltip="Name that appears on invoices. Max 200 characters."
                >
                  Invoice Name
                </FieldLabel>
                <Input
                  id="tenantInvoiceName"
                  value={invoiceName}
                  maxLength={INVOICE_NAME_MAX}
                  onChange={(e) => setInvoiceName(e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <FieldLabel tooltip="Name that appears on invoices.">
                  Invoice Name
                </FieldLabel>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {tenant.invoiceName || "Not set"}
                </p>
              </div>
            )}

            {editing ? (
              <div>
                <FieldLabel
                  htmlFor="tenantInvoiceEmail"
                  tooltip="Email address that receives invoices. Max 255 characters."
                >
                  Invoice Email
                </FieldLabel>
                <Input
                  id="tenantInvoiceEmail"
                  type="email"
                  value={invoiceEmail}
                  maxLength={INVOICE_EMAIL_MAX}
                  onChange={(e) => setInvoiceEmail(e.target.value)}
                  className="mt-1"
                  aria-invalid={invoiceEmailInvalid}
                />
                {invoiceEmailInvalid && (
                  <p className="mt-1 text-xs text-destructive">
                    Enter a valid email address.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <FieldLabel tooltip="Email address that receives invoices.">
                  Invoice Email
                </FieldLabel>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {tenant.invoiceEmail || "Not set"}
                </p>
              </div>
            )}

            <div>
              <Label className="text-sm text-muted-foreground">Billing Cycle</Label>
              <p className="mt-1 text-sm text-foreground">
                {tenant.billingCycle || "N/A"}
              </p>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">
                Subscription Status
              </Label>
              <p className="mt-1 text-sm text-foreground">
                {tenant.subscriptionStatus || "Unknown"}
              </p>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">
                Subscription Start Date
              </Label>
              <p className="mt-1 text-sm text-foreground">
                {formatDate(tenant.subscriptionStartDate)}
              </p>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">
                Subscription End Date
              </Label>
              <p className="mt-1 text-sm text-foreground">
                {formatDate(tenant.subscriptionEndDate)}
              </p>
            </div>

            <TenantTrialExtendField
              trialEndDate={tenant.trialEndDate}
              subscriptionStatus={tenant.subscriptionStatus}
              canExtend={canExtendTrial && !!onExtendTrial}
              extending={extendingTrial}
              onExtend={onExtendTrial ?? (async () => {})}
            />

            <div>
              <Label className="text-sm text-muted-foreground">Auto Renew</Label>
              <p className="mt-1 text-sm text-foreground">
                {tenant.autoRenew ? "Yes" : "No"}
              </p>
            </div>

            <div>
              <FieldLabel tooltip="Whether the subscription is set to cancel at the end of the current period.">
                Cancel at Period End
              </FieldLabel>
              <p className="mt-1 text-sm text-foreground">
                {formatCancelAtPeriodEnd(tenant.cancelAtPeriodEnd)}
              </p>
            </div>

            <div>
              <FieldLabel tooltip="Stripe customer ID associated with this tenant.">
                Billing Customer ID
              </FieldLabel>
              <div className="mt-1 truncate font-mono text-sm text-foreground">
                {tenant.billingCustomerId ? (
                  <a
                    href={stripeCustomerUrl(tenant.billingCustomerId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 truncate font-mono text-sm text-primary hover:underline"
                    title={`View customer ${tenant.billingCustomerId} in Stripe Dashboard`}
                  >
                    {tenant.billingCustomerId}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="truncate font-mono text-sm text-foreground">
                    Not linked
                  </span>
                )}
              </div>
            </div>

            <div>
              <FieldLabel tooltip="Stripe subscription ID associated with this tenant.">
                Stripe Subscription ID
              </FieldLabel>
              {tenant.stripeSubscriptionId ? (
                <a
                  href={stripeSubscriptionUrl(tenant.stripeSubscriptionId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 truncate font-mono text-sm text-primary hover:underline"
                  title={`View subscription ${tenant.stripeSubscriptionId} in Stripe Dashboard`}
                >
                  {tenant.stripeSubscriptionId}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="mt-1 truncate font-mono text-sm text-foreground">
                  Not linked
                </p>
              )}
            </div>
          </div>
        </div>

        {editing && (
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelEditing}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving || !canSave}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TenantDetailsInfoCard;
