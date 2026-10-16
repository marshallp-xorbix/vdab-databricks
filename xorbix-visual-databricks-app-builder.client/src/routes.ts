import {
  type RouteConfig,
  route,
  layout,
  index,
} from "@react-router/dev/routes";

export default [
  // unsecure, minimal layout for auth and other full-page modals
  layout("layouts/layout.tsx", { id: "dialog-layout" }, [
    index("pages/LandingPage.tsx"),
    route("login", "pages/LoginPage.tsx"),
    route("passwordless", "pages/PasswordlessLoginPage.tsx"),
    route("confirm-email", "pages/ConfirmEmailPage.tsx"),
    route("reset-password", "pages/ResetPasswordPage.tsx"),
    route("confirm-email-change", "pages/ConfirmEmailChangePage.tsx"),
    route("forgot-password", "pages/ForgotPasswordPage.tsx"),
    route("verify-code", "pages/VerifyCodePage.tsx"),
    route("signup", "pages/SignUpPage.tsx"),
    route("beta-signup", "pages/BetaSignUpPage.tsx"),
    route("account-created", "pages/AccountCreatedPage.tsx"),
    route("accept-invite", "pages/AcceptInvitePage.tsx"),
    route("accept-invite/register", "pages/AcceptInviteRegisterPage.tsx"),
    route("set-password", "pages/account-setup/SetPasswordPage.tsx"),
  ]),

  layout("layouts/layout.tsx", [
    route("status", "pages/StatusPage.tsx", { id: "status" }),
  ]),

  // Account setup flow — requires authentication, standalone page
  route(
    "account/setup/billing",
    "pages/account-setup/AccountSetupBillingPage.tsx",
    { id: "account-setup-billing" },
  ),

  // Policy acceptance gate — requires authentication, standalone page
  route(
    "account/policy-acceptance",
    "pages/account-setup/PolicyAcceptancePage.tsx",
    { id: "policy-acceptance" },
  ),

  // Primary Layout, v1 - requires authentication
  layout("layouts/AuthenticatedLayout.tsx", { id: "app-layout" }, [
    route("apps", "pages/AppManagement.tsx", { id: "apps-list" }),
    route("apps/:appId", "pages/AppBuilder.tsx", { id: "app-builder" }),
    route("callback", "pages/DatabricksCallback.tsx", {
      id: "databricks-callback",
    }),
    route("databricks", "pages/DatabricksConnections.tsx", {
      id: "databricks-list",
    }),
  ]),

  // Primary Layout, v2 - requires authentication, account management and administration pages
  layout("layouts/AuthenticatedLayout.tsx", { id: "account-layout" }, [
    route("account", "pages/account/AccountDashboard.tsx", {
      id: "account-dashboard",
    }),
    route("account/profile", "pages/account/UserProfile.tsx", {
      id: "account-profile",
    }),
    route("account/sessions", "pages/account/UserSessions.tsx", {
      id: "account-sessions",
    }),
    route("account/billing", "pages/account/AccountBilling.tsx", {
      id: "account-billing",
    }),
    route("account/invoices", "pages/account/AccountInvoices.tsx", {
      id: "account-invoices",
    }),
    route("account/activity", "pages/account/AccountActivity.tsx", {
      id: "account-activity",
    }),
    route("account/team-activity", "pages/account/AccountTeamActivity.tsx", {
      id: "account-team-activity",
    }),
    route("account/seats", "pages/account/SeatManagement.tsx", {
      id: "account-seats",
    }),
    route("account/seats/users/:userId", "pages/UserDetail.tsx", {
      id: "tenant-user-detail",
    }),
  ]),

  // Primary Layout, v2 - requires authentication, administration pages
  layout("layouts/AuthenticatedLayout.tsx", { id: "admin-layout" }, [
    route("administration", "pages/AdministrationIndexRedirect.tsx"),
    route("administration/dashboard", "pages/AdministrationDashboard.tsx"),
    route("administration/health", "pages/HealthPage.tsx", {
      id: "administration-health",
    }),
    route("administration/tenants", "pages/TenantManagement.tsx"),
    route("administration/tenants/new", "pages/TenantEdit.tsx", {
      id: "tenant-new",
    }),
    route("administration/tenants/:tenantId", "pages/TenantDetail.tsx"),
    route("administration/auditlogs", "pages/AuditLogs.tsx"),
    route("administration/stripe-events", "pages/StripeEventHistory.tsx"),
    route("administration/users", "pages/UserManagement.tsx"),
    route("administration/users/:userId", "pages/UserDetail.tsx"),
    route("administration/users/:userId/edit", "pages/UserEdit.tsx", {
      id: "user-edit",
    }),
    route("administration/users/new", "pages/UserEdit.tsx", { id: "user-new" }),
  ]),
] satisfies RouteConfig;
