import AuditLogsGrid from "../../components/audit/AuditLogsGrid";
import { useIdentity } from "../../context/IdentityContext";
import { useSubscription } from "../../hooks/useSubscription";
import { canManageTenantSeats } from "../../types/tenantRole";
import {
  ACCOUNT_PAGE_CONTAINER_CLASS,
  ACCOUNT_PAGE_SECTION_CLASS,
  ACCOUNT_PAGE_SUBTITLE_CLASS,
  ACCOUNT_PAGE_TITLE_CLASS,
} from "./accountPageStyles.ts";

function AccountTeamActivity() {
  const { user } = useIdentity();
  const { canUseSeatManagement } = useSubscription();

  const hasTeamAccess =
    canUseSeatManagement &&
    canManageTenantSeats(user?.tenantRole) &&
    !!user?.tenantId;

  return (
    <section className={ACCOUNT_PAGE_SECTION_CLASS}>
      <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
        <header>
          <h1 className={ACCOUNT_PAGE_TITLE_CLASS}>Team Activity Log</h1>
          <p className={ACCOUNT_PAGE_SUBTITLE_CLASS}>
            View, filter, and search account activity across your team.
          </p>
        </header>

        {hasTeamAccess && user?.tenantId ? (
          <AuditLogsGrid scope={{ kind: "tenant", tenantId: user.tenantId }} />
        ) : (
          <div className="rounded-md border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-foreground">
            Team activity log is available for account admins on team-tier
            subscriptions.
          </div>
        )}
      </div>
    </section>
  );
}

export default AccountTeamActivity;
