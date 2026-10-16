import {
  Building2,
  FileText,
  LayoutGrid,
  Mail,
  Receipt,
  Server,
  Sliders,
  Table2,
  UserCog,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { NavigationTile } from "../components/NavigationTile";
import { RecentSystemActivity } from "../components/RecentSystemActivity";
import { useSettings } from "../context/SettingsContext";
import {
  StatisticsTile,
  type StatisticsTileProps,
  type StatisticsTileTrend,
} from "../components/StatisticsTile";
import { Button } from "../components/ui/button";
import { useReportsStats } from "../hooks/useReportsStats";
import { useHealthStatus } from "../hooks/useHealthStatus";
import { HEALTH_STATUS, type HealthStatus } from "../types/HealthStatus";

function getHealthConfig(status: string): {
  trend: StatisticsTileTrend;
  iconClassName: string;
} {
  switch (status as HealthStatus) {
    case HEALTH_STATUS.Healthy:
      return {
        trend: "operational",
        iconClassName: "bg-success-subtle text-success",
      };

    case HEALTH_STATUS.Degraded:
      return {
        trend: "warning",
        iconClassName: "bg-warning-subtle text-warning",
      };

    case HEALTH_STATUS.Unhealthy:
      return {
        trend: "down",
        iconClassName: "bg-destructive-subtle text-destructive",
      };

    default:
      return {
        trend: "info",
        iconClassName: "bg-muted text-muted-foreground",
      };
  }
}

function AdministrationDashboard() {
  const { data, isLoading, isError, refetch } = useReportsStats();
  const { featureGates } = useSettings();
  const { data: healthData } = useHealthStatus();

  const stats: StatisticsTileProps[] = useMemo(() => {
    const activeUsers = data?.activeUsersCount ?? 0;
    const newUsers = data?.newUsersLast30DaysCount ?? 0;
    const activeTenants = data?.activeTenantsCount ?? 0;
    const newTenants = data?.newTenantsLast30DaysCount ?? 0;
    const pendingInvites = data?.pendingInvitesCount ?? 0;
    const activeApps = data?.activeAppsCount ?? 0;
    const systemHealth = healthData?.status ?? "Unknown";
    const healthConfig = getHealthConfig(systemHealth);

    return [
      {
        title: "Active Users",
        value: activeUsers.toLocaleString(),
        change: `${newUsers.toLocaleString()} new (30d)`,
        trend: "up",
        icon: Users,
        iconClassName: "bg-primary/10 text-primary",
      },
      {
        title: "Active Tenants",
        value: activeTenants.toLocaleString(),
        change: `${newTenants.toLocaleString()} new (30d)`,
        trend: "up",
        icon: Building2,
        iconClassName: "bg-primary/10 text-primary",
      },
      {
        title: "Pending Invites",
        value: pendingInvites.toLocaleString(),
        change: "Require approval",
        trend: pendingInvites > 0 ? "warning" : "none",
        icon: Mail,
        iconClassName: "bg-warning-subtle text-warning",
      },
      {
        title: "Active Apps",
        value: activeApps.toLocaleString(),
        change: "Across all tenants",
        trend: "info",
        icon: LayoutGrid,
        iconClassName: "bg-purple-50 text-purple-600",
      },
      {
        title: "System Health",
        value: systemHealth,
        change: "Platform status",
        trend: healthConfig.trend,
        icon: Server,
        iconClassName: healthConfig.iconClassName,
      },
    ];
  }, [data, healthData]);

  const quickAccess = [
    {
      title: "Tenant Management",
      description: "Manage tenants, org settings, and configurations.",
      icon: Building2,
      iconClass: "bg-primary/10 text-primary",
      to: "/administration/tenants",
      disabled: false,
    },
    {
      title: "User Management",
      description: "Manage accounts, roles, and permissions.",
      icon: UserCog,
      iconClass: "bg-primary/10 text-primary",
      to: "/administration/users",
      disabled: false,
    },
    {
      title: "Audit Logs",
      description: "Detailed security and compliance logs.",
      icon: FileText,
      iconClass: "bg-warning-subtle text-warning",
      to: "/administration/auditlogs",
      disabled: false,
    },
    {
      title: "Stripe History",
      description: "Review Stripe webhook events and processing status.",
      icon: Receipt,
      iconClass: "bg-blue-50 text-blue-600",
      to: "/administration/stripe-events",
      disabled: false,
    },
    {
      title: "Reports",
      description: "View and Export platform reports.",
      icon: Table2,
      iconClass: "bg-purple-50 text-purple-600",
      disabled: true,
    },
    {
      title: "Messaging & Notifications",
      description: "Configure system alerts and notifications.",
      icon: Mail,
      iconClass: "bg-warning-subtle text-warning",
      disabled: true,
    },
    {
      title: "System Settings",
      description: "Global platform settings and preferences.",
      icon: Sliders,
      iconClass: "bg-indigo-50 text-indigo-600",
      disabled: true,
    },
  ];

  const visibleQuickAccess = quickAccess.filter(
    (item) => !item.disabled || featureGates.enablePreRelease,
  );

  return (
    <section className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Administration Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage system settings, users, and security configurations.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
              loading={isLoading}
            />
          ))}
        </div>

        {isError && (
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive-foreground">
            <span>Failed to load platform statistics.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-destructive/40 text-destructive-foreground hover:bg-destructive-subtle"
            >
              Retry
            </Button>
          </div>
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Quick Access
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleQuickAccess.map((item) => (
              <NavigationTile
                key={item.title}
                title={item.title}
                description={item.description}
                icon={item.icon}
                iconClassName={item.iconClass}
                to={item.to}
                disabled={item.disabled}
              />
            ))}
          </div>
        </section>

        <RecentSystemActivity />
      </div>
    </section>
  );
}

export default AdministrationDashboard;
