import {
  useLocation,
  useParams,
  useSearchParams,
  Link,
} from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";

const crumbBaseClass = "text-white/90 hover:text-white transition-colors";
const crumbCurrentClass = "font-medium text-white";
const guidSegmentPattern =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const userDetailPathPattern = new RegExp(
  `^/administration/users/(${guidSegmentPattern})$`,
);
const userEditPathPattern = new RegExp(
  `^/administration/users/(${guidSegmentPattern})/edit$`,
);
const tenantDetailPathPattern = new RegExp(
  `^/administration/tenants/(${guidSegmentPattern})$`,
);
const tenantEditPathPattern = new RegExp(
  `^/administration/tenants/(${guidSegmentPattern})/edit$`,
);
const auditLogDetailPathPattern = new RegExp(
  `^/administration/tenants/(${guidSegmentPattern})$`,
);
const auditLogEditPathPattern = new RegExp(
  `^/administration/tenants/(${guidSegmentPattern})$`,
);

type CrumbItem = {
  label: string;
  to?: string;
};

type AdminEntityBreadcrumbConfig = {
  indexPath: string;
  collectionLabel: string;
  singularLabel: string;
  managementLabel: string;
  detailPathPattern: RegExp;
  editPathPattern: RegExp;
};

const singleCrumbPaths: Record<string, string> = {
  "/apps": "My Apps",
  "/databricks": "Databricks Connections",
  "/callback": "Databricks Connections",
  "/admin": "Admin Console",
  "/account": "Account",
  "/account/profile": "Profile",
  "/account/sessions": "Sessions",
  "/account/billing": "Billing & Plan",
  "/account/invoices": "Invoices",
  "/account/activity": "My Activity Log",
  "/account/team-activity": "Team Activity Log",
  "/administration": "Administration",
  "/administration/dashboard": "Administration",
};

const userAdminBreadcrumbConfig: AdminEntityBreadcrumbConfig = {
  indexPath: "/administration/users",
  collectionLabel: "Users",
  singularLabel: "User",
  managementLabel: "User Management",
  detailPathPattern: userDetailPathPattern,
  editPathPattern: userEditPathPattern,
};

const tenantAdminBreadcrumbConfig: AdminEntityBreadcrumbConfig = {
  indexPath: "/administration/tenants",
  collectionLabel: "Tenants",
  singularLabel: "Tenant",
  managementLabel: "Tenant Management",
  detailPathPattern: tenantDetailPathPattern,
  editPathPattern: tenantEditPathPattern,
};

const auditLogAdminBreadcrumbConfig: AdminEntityBreadcrumbConfig = {
  indexPath: "/administration/auditlogs",
  collectionLabel: "Audit Logs",
  singularLabel: "Audit Log",
  managementLabel: "Audit Logs",
  detailPathPattern: auditLogDetailPathPattern,
  editPathPattern: auditLogEditPathPattern,
};

const buildAdminEntityCrumbs = (
  path: string,
  baseAdminItems: CrumbItem[],
  config: AdminEntityBreadcrumbConfig,
): CrumbItem[] => {
  if (path === config.indexPath) {
    return [...baseAdminItems, { label: config.managementLabel }];
  }

  const adminItems: CrumbItem[] = [
    ...baseAdminItems,
    { label: config.collectionLabel, to: config.indexPath },
  ];

  if (path === `${config.indexPath}/new`) {
    return [...adminItems, { label: `Add ${config.singularLabel}` }];
  }

  const editMatch = config.editPathPattern.exec(path);
  if (editMatch) {
    const id = editMatch[1];
    return [
      ...adminItems,
      { label: config.singularLabel, to: `${config.indexPath}/${id}` },
      { label: `Edit ${config.singularLabel}` },
    ];
  }

  const detailMatch = config.detailPathPattern.exec(path);
  if (detailMatch) {
    return [...adminItems, { label: config.singularLabel }];
  }

  return [...adminItems, { label: config.managementLabel }];
};

const getAdministrationCrumbItems = (path: string): CrumbItem[] => {
  const baseAdminItems: CrumbItem[] = [
    { label: "Administration", to: "/administration/dashboard" },
  ];

  if (path === "/administration/dashboard" || path === "/administration") {
    return [...baseAdminItems, { label: "Dashboard" }];
  }

  if (path === "/administration/stripe-events") {
    return [...baseAdminItems, { label: "Stripe History" }];
  }

  if (path.startsWith(tenantAdminBreadcrumbConfig.indexPath)) {
    return buildAdminEntityCrumbs(
      path,
      baseAdminItems,
      tenantAdminBreadcrumbConfig,
    );
  }

  if (path.startsWith(userAdminBreadcrumbConfig.indexPath)) {
    return buildAdminEntityCrumbs(
      path,
      baseAdminItems,
      userAdminBreadcrumbConfig,
    );
  }

  if (path.startsWith(auditLogAdminBreadcrumbConfig.indexPath)) {
    return buildAdminEntityCrumbs(
      path,
      baseAdminItems,
      auditLogAdminBreadcrumbConfig,
    );
  }

  return baseAdminItems;
};

export const Breadcrumb = () => {
  const location = useLocation();
  const { appId } = useParams<{ appId?: string }>();
  const [searchParams] = useSearchParams();
  const appName = searchParams.get("name");
  const path = location.pathname;

  const crumbItems: CrumbItem[] | null = useMemo(() => {
    if (path.startsWith("/administration")) {
      return getAdministrationCrumbItems(path);
    }

    if (path.startsWith("/apps/") && appId) {
      return [
        { label: "My Apps", to: "/apps" },
        { label: appName || "Untitled App" },
      ];
    }

    const singleCrumbLabel = singleCrumbPaths[path];
    if (singleCrumbLabel) {
      return [{ label: singleCrumbLabel }];
    }

    return null;
  }, [path, appId, appName]);

  if (!crumbItems) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-2"
    >
      <ol className="flex items-center gap-2 text-sm text-white">
        {crumbItems?.map((item, idx) => (
          <li key={`${item.label}-${idx}`} className="flex items-center gap-2">
            {item.to ? (
              <Link to={item.to} className={crumbBaseClass}>
                {item.label}
              </Link>
            ) : (
              <span className={crumbCurrentClass} aria-current="page">
                {item.label}
              </span>
            )}

            {idx < (crumbItems?.length || 0) - 1 && (
              <ChevronRight className="h-4 w-4 text-white/60" aria-hidden />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
