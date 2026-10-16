import {
  AppWindow,
  Building,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  MonitorSmartphone,
  Receipt,
  ScrollText,
  Settings,
  Server,
  Users,
} from "lucide-react";
import { type ComponentType } from "react";

export type SectionSidebarItem = {
  title: string;
  url?: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  matchMode?: "exact" | "prefix";
  matchIds?: string[];
  requiredRoles?: string[];
  /**
   * When true, the item is only shown for users who can manage tenant seats on a
   * team-tier subscription. Mirrors the AccountDashboard "Seats & Users" tile.
   */
  requiresTenantSeatManagement?: boolean;
  /**
   * When true, the item is only shown for tenants that have a Stripe customer.
   * Hides billing and invoice entries for manually provisioned tenants that have
   * no Stripe billing account.
   */
  requiresStripeBilling?: boolean;
};

export type SectionSidebarGroup = {
  title: string;
  items: SectionSidebarItem[];
};

export type SectionSidebarType = "app" | "admin" | "account";

const appGroups: SectionSidebarGroup[] = [
  {
    title: "Navigation",
    items: [
      {
        title: "Apps",
        url: "/apps",
        icon: AppWindow,
        matchIds: ["apps-list", "app-builder", "app-edit"],
      },
      {
        title: "Databricks Connections",
        url: "/databricks",
        icon: Building2,
        matchIds: ["databricks-list", "databricks-callback"],
      },
      {
        title: "Administration",
        url: "/administration/dashboard",
        icon: Settings,
        matchIds: ["admin-layout", "admin-users", "admin-user-edit"],
        requiredRoles: ["Administrator"],
      },
    ],
  },
];

const adminGroups: SectionSidebarGroup[] = [
  {
    title: "Navigation",
    items: [
      {
        title: "Apps",
        url: "/apps",
        icon: AppWindow,
        matchIds: ["apps-list", "app-builder", "app-edit"],
      },
      {
        title: "Databricks Connections",
        url: "/databricks",
        icon: Building2,
        matchIds: ["databricks-list", "databricks-callback"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        title: "Dashboard",
        url: "/administration/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Tenant Management",
        url: "/administration/tenants",
        icon: Building,
      },
      {
        title: "User Management",
        url: "/administration/users",
        icon: Users,
      },
      {
        title: "Reports",
        icon: Settings,
        disabled: true,
      },
      {
        title: "Health",
        url: "/administration/health",
        icon: Server,
        matchIds: ["administration-health"],
      },
      {
        title: "Messaging",
        icon: Settings,
        disabled: true,
      },
      {
        title: "System Settings",
        icon: Settings,
        disabled: true,
      },
    ],
  },
  {
    title: "Security",
    items: [
      {
        title: "Audit Logs",
        url: "/administration/auditlogs",
        icon: ClipboardList,
      },
    ],
  },
  {
    title: "Billing",
    items: [
      {
        title: "Stripe History",
        url: "/administration/stripe-events",
        icon: Receipt,
      },
    ],
  },
];

const accountGroups: SectionSidebarGroup[] = [
  {
    title: "Account",
    items: [
      {
        title: "Dashboard",
        url: "/account",
        icon: LayoutDashboard,
        matchMode: "exact",
      },
      {
        title: "Profile",
        url: "/account/profile",
        icon: Settings,
      },
      {
        title: "Sessions",
        url: "/account/sessions",
        icon: MonitorSmartphone,
      },
      {
        title: "My Activity Log",
        url: "/account/activity",
        icon: ScrollText,
      },
    ],
  },
  {
    title: "Team",
    items: [
      {
        title: "Seats & Users",
        url: "/account/seats",
        icon: Users,
        requiresTenantSeatManagement: true,
      },
      {
        title: "Team Activity Log",
        url: "/account/team-activity",
        icon: ClipboardList,
        requiresTenantSeatManagement: true,
      },
    ],
  },
  {
    title: "Billing",
    items: [
      {
        title: "Billing & Plan",
        url: "/account/billing",
        icon: CreditCard,
        requiresStripeBilling: true,
      },
      {
        title: "Invoices",
        url: "/account/invoices",
        icon: FileText,
        requiresStripeBilling: true,
      },
    ],
  },
];

export function getSectionSidebarGroups(
  type: SectionSidebarType,
): SectionSidebarGroup[] {
  switch (type) {
    case "app":
      return appGroups;
    case "account":
      return accountGroups;
    case "admin":
    default:
      return adminGroups;
  }
}
