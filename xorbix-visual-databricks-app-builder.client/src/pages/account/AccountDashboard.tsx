import {
  Bug,
  ClipboardList,
  CreditCard,
  FileText,
  MonitorSmartphone,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Mail,
  Users,
} from "lucide-react";
import { useIdentity } from "../../context/IdentityContext";
import { NavigationTile } from "../../components/NavigationTile";
import { RecentSystemActivity } from "../../components/RecentSystemActivity";
import {
  StatisticsTile,
  type StatisticsTileProps,
} from "../../components/StatisticsTile";
import {
  SUPPORT_PORTAL_URL,
  WHATS_NEW_URL,
} from "../../constants/supportLinks";
import { useSubscription } from "../../hooks/useSubscription";
import { useTeamSeats } from "../../hooks/useTeamSeats";
import { type AuditScope } from "../../types/auditLog";
import { canManageSeatsAsAdminOrGlobal } from "../../types/tenantRole";
import { isGlobalAdministrator } from "../../utils/roles";
import {
  ACCOUNT_PAGE_CONTAINER_CLASS,
  ACCOUNT_PAGE_SECTION_CLASS,
  ACCOUNT_PAGE_SUBTITLE_CLASS,
  ACCOUNT_PAGE_TITLE_CLASS,
} from "./accountPageStyles.ts";

interface IQuickAccessItem {
  title: string;
  description: string;
  icon: typeof Users;
  iconClass: string;
  to?: string;
  href?: string;
  disabled?: boolean;
  disabledLabel?: string;
}

interface ITeamStats {
  canUseSeatManagement: boolean;
  loading: boolean;
  teamStatsLoading: boolean;
  teamSeatCount: number;
  teamSeatsFilled: number;
  pendingInviteCount: number;
  openSeatCount: number;
}

function getCurrentPlanStatus(
  hasSubscription: boolean,
  cancelAtPeriodEnd: boolean,
  renewalDate: string | null,
  hasStripeCustomer: boolean,
  promoEndDate: string | null,
): string {
  if (!hasSubscription) {
    return "Not subscribed";
  }

  if (!hasStripeCustomer) {
    return "Managed plan";
  }

  if (cancelAtPeriodEnd) {
    return `Ends as of ${renewalDate ?? "-"}`;
  }

  if (promoEndDate) {
    return `Promo active until ${promoEndDate}`;
  }

  return `Renews on ${renewalDate ?? "-"}`;
}

function buildTeamStatsTiles({
  canUseSeatManagement,
  loading,
  teamStatsLoading,
  teamSeatCount,
  teamSeatsFilled,
  pendingInviteCount,
  openSeatCount,
}: ITeamStats): StatisticsTileProps[] {
  if (!canUseSeatManagement) {
    return [];
  }

  const openSeatLabel = openSeatCount === 1 ? "seat" : "seats";
  const seatAvailabilityText =
    openSeatCount > 0
      ? `${openSeatCount} open ${openSeatLabel}`
      : "All seats assigned";
  const seatTrend: StatisticsTileProps["trend"] =
    openSeatCount > 0 ? "info" : "operational";
  const teamTiles: StatisticsTileProps[] = [
    {
      title: "Users / Seats",
      value: `${teamSeatsFilled}/${teamSeatCount}`,
      change: seatAvailabilityText,
      trend: seatTrend,
      icon: Users,
      iconClassName: "bg-info-subtle text-info",
      loading: loading || teamStatsLoading,
    },
  ];

  if (openSeatCount > 0) {
    teamTiles.push({
      title: "Pending Invites",
      value: pendingInviteCount.toString(),
      change: "",
      trend: "none",
      icon: Mail,
      iconClassName: "bg-warning-subtle text-warning",
      loading: loading || teamStatsLoading,
    });
  }

  return teamTiles;
}

function buildManageTeam(canManageSeats: boolean): IQuickAccessItem[] {
  if (!canManageSeats) {
    return [];
  }

  return [
    {
      title: "Seats & Users",
      description:
        "Manage teammates and seat assignments for your organization.",
      icon: Users,
      iconClass: "bg-info-subtle text-info",
      to: "/account/seats",
    },
    {
      title: "Team Activity Log",
      description:
        "Review team-level security and account activity across members.",
      icon: ClipboardList,
      iconClass: "bg-violet-50 text-violet-600",
      to: "/account/team-activity",
    },
  ];
}

function buildMySettings(): IQuickAccessItem[] {
  return [
    {
      title: "My Profile",
      description:
        "Manage your profile, security, and notification preferences.",
      icon: Settings,
      iconClass: "bg-blue-50 text-blue-600",
      to: "/account/profile",
    },
    {
      title: "My Sessions",
      description: "View active sessions and manage device access.",
      icon: MonitorSmartphone,
      iconClass: "bg-indigo-50 text-indigo-600",
      to: "/account/sessions",
    },
    {
      title: "My Activity Log",
      description: "Review your personal security and account activity.",
      icon: ScrollText,
      iconClass: "bg-destructive-subtle text-destructive",
      to: "/account/activity",
    },
  ];
}

function buildSubscriptionAndBilling(
  hasStripeCustomer: boolean,
): IQuickAccessItem[] {
  const billingDisabled = !hasStripeCustomer;
  const billingDisabledLabel = "No billing account";

  return [
    {
      title: "Billing & Plan",
      description: "Manage your subscription and payment methods.",
      icon: CreditCard,
      iconClass: "bg-success-subtle text-success",
      to: "/account/billing",
      disabled: billingDisabled,
      disabledLabel: billingDisabledLabel,
    },
    {
      title: "Invoices",
      description: "View and download your billing invoices.",
      icon: FileText,
      iconClass: "bg-warning-subtle text-warning",
      to: "/account/invoices",
      disabled: billingDisabled,
      disabledLabel: billingDisabledLabel,
    },
  ];
}

function buildHelpAndResources(): IQuickAccessItem[] {
  return [
    {
      title: "What's New?",
      description:
        "View release notes and learn about the latest platform improvements.",
      icon: Sparkles,
      iconClass: "bg-info-subtle text-info",
      href: WHATS_NEW_URL,
    },
    {
      title: "Report A Bug",
      description: "Submit a bug report or request help from the support team.",
      icon: Bug,
      iconClass: "bg-destructive-subtle text-destructive",
      href: SUPPORT_PORTAL_URL,
    },
  ];
}

function AccountDashboard() {
  const { user } = useIdentity();
  const {
    subscription,
    canUseSeatManagement,
    loading,
    hasStripeCustomer,
    hasActivePromo,
  } = useSubscription();
  const {
    seatsLoading,
    invitesLoading,
    teamSeatCount,
    teamSeatsFilled,
    pendingInviteCount,
    openSeatCount,
  } = useTeamSeats({
    mode: canUseSeatManagement ? "tenantContext" : "disabled",
  });
  const teamStatsLoading = seatsLoading || invitesLoading;

  const renewalDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const promoEndDate =
    hasActivePromo && subscription?.discount?.discountEndsAt
      ? new Date(subscription.discount.discountEndsAt).toLocaleDateString(
          undefined,
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        )
      : null;

  const currentPlanStatus = getCurrentPlanStatus(
    !!subscription,
    !!subscription?.cancelAtPeriodEnd,
    renewalDate,
    hasStripeCustomer,
    promoEndDate,
  );

  const stats: StatisticsTileProps[] = [
    {
      title: "Current Plan",
      value: subscription?.tier ?? "No Plan",
      change: currentPlanStatus,
      change2: subscription?.status ?? "",
      trend: subscription?.cancelAtPeriodEnd ? "warning" : "info",
      icon: ShieldCheck,
      iconClassName: "bg-blue-50 text-blue-600",
    },
  ];

  stats.push(
    ...buildTeamStatsTiles({
      canUseSeatManagement,
      loading,
      teamStatsLoading,
      teamSeatCount,
      teamSeatsFilled,
      pendingInviteCount,
      openSeatCount,
    }),
  );

  const canManageSeats =
    canUseSeatManagement &&
    canManageSeatsAsAdminOrGlobal(
      user?.tenantRole,
      isGlobalAdministrator(user),
    );
  const userIsGlobalAdministrator = isGlobalAdministrator(user);
  let recentActivityScope: AuditScope = {
    kind: "user",
    userId: user?.userId ?? "",
    tenantId: user?.tenantId,
  };

  if (userIsGlobalAdministrator) {
    recentActivityScope = { kind: "all" };
  } else if (canManageSeats && user?.tenantId) {
    recentActivityScope = { kind: "tenant", tenantId: user.tenantId };
  }

  let recentActivityViewAllHref = "/account/activity";

  if (userIsGlobalAdministrator) {
    recentActivityViewAllHref = "/administration/auditlogs";
  } else if (canManageSeats) {
    recentActivityViewAllHref = "/account/team-activity";
  }

  const manageTeam = buildManageTeam(canManageSeats);
  const mySettings = buildMySettings();
  const subscriptionAndBilling = buildSubscriptionAndBilling(hasStripeCustomer);
  const helpAndResources = buildHelpAndResources();

  const sections: { title: string; items: IQuickAccessItem[] }[] = [
    { title: "Manage Team", items: manageTeam },
    { title: "My Account", items: mySettings },
    { title: "Subscription & Billing", items: subscriptionAndBilling },
    { title: "Help and Resources", items: helpAndResources },
  ].filter((section) => section.items.length > 0);

  return (
    <section className={ACCOUNT_PAGE_SECTION_CLASS}>
      <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
        <header>
          <h1 className={ACCOUNT_PAGE_TITLE_CLASS}>Account Dashboard</h1>
          <p className={ACCOUNT_PAGE_SUBTITLE_CLASS}>
            Welcome back, {user?.fullName ?? user?.firstName ?? "User"}.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {stats.map((stat) => (
            <StatisticsTile
              key={stat.title}
              title={stat.title}
              value={stat.value}
              change={stat.change}
              change2={stat.change2}
              trend={stat.trend}
              icon={stat.icon}
              iconClassName={stat.iconClassName}
              loading={stat.loading ?? loading}
            />
          ))}
        </div>

        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => (
                <NavigationTile
                  key={item.title}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  iconClassName={item.iconClass}
                  to={item.to}
                  href={item.href}
                  disabled={item.disabled}
                  disabledLabel={item.disabledLabel}
                />
              ))}
            </div>
          </section>
        ))}

        {user?.userId ? (
          <RecentSystemActivity
            scope={recentActivityScope}
            viewAllHref={recentActivityViewAllHref}
          />
        ) : null}
      </div>
    </section>
  );
}

export default AccountDashboard;
