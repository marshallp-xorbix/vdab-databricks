import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const publicDirectory = resolve(import.meta.dirname, "..", ".build", "public");
const publicJavaScript = await readPublicJavaScript(publicDirectory);
const assetChecks = [
  {
    name: "standalone-assets-exclude-saas-telemetry",
    fingerprint: /applicationinsights|appInsights/i,
  },
  {
    name: "standalone-assets-exclude-external-connection-picker",
    fingerprint:
      /DatabricksConnections|CreateAppWizardDialog|databricksConnectionId/i,
  },
  {
    name: "standalone-assets-exclude-tenant-model-picker",
    fingerprint: /TenantAiModelsSection/i,
  },
  {
    name: "standalone-assets-exclude-saas-auth-and-account-surfaces",
    fingerprint:
      /IdentityApi|LoginPage|SignupPage|PasswordlessLogin|TwoFactor|ForgotPassword/i,
  },
  {
    name: "standalone-assets-exclude-saas-billing-and-tenant-apis",
    fingerprint:
      /StripeProvider|BillingApi|SubscriptionApi|TenantApi|TenantInvite/i,
  },
  {
    name: "standalone-assets-exclude-saas-admin-and-account-routes",
    fingerprint:
      /TenantManagement|TenantDetail|TenantEdit|UserManagement|UserEdit|AdministrationDashboard|AccountBilling|AccountDashboard|AuthenticatedLayout|StripeEventHistory/i,
  },
  {
    name: "standalone-assets-exclude-workspace-credentials",
    fingerprint:
      /DATABRICKS_(?:TOKEN|CLIENT_SECRET)|x-forwarded-access-token|access_token/i,
  },
];

for (const check of assetChecks) {
  assert.doesNotMatch(publicJavaScript, check.fingerprint, check.name);
}

process.stdout.write(
  `${JSON.stringify({
    event: "app.smoke.assets.passed",
    checks: assetChecks.map((check) => check.name),
  })}\n`,
);

async function readPublicJavaScript(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const fileContents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) return readPublicJavaScript(entryPath);
      if (!entry.isFile() || !entry.name.endsWith(".js")) return "";
      return readFile(entryPath, "utf8");
    }),
  );
  return fileContents.join("\n");
}
