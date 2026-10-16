import AuditLogsGrid from "../../components/audit/AuditLogsGrid";
import { useIdentity } from "../../context/IdentityContext";
import {
  ACCOUNT_PAGE_CONTAINER_CLASS,
  ACCOUNT_PAGE_SECTION_CLASS,
  ACCOUNT_PAGE_SUBTITLE_CLASS,
  ACCOUNT_PAGE_TITLE_CLASS,
} from "./accountPageStyles.ts";

function AccountActivity() {
  const { user } = useIdentity();

  return (
    <section className={ACCOUNT_PAGE_SECTION_CLASS}>
      <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
        <header>
          <h1 className={ACCOUNT_PAGE_TITLE_CLASS}>My Activity Log</h1>
          <p className={ACCOUNT_PAGE_SUBTITLE_CLASS}>
            View, filter, and search your personal account activity.
          </p>
        </header>

        {user?.userId ? (
          <AuditLogsGrid
            scope={{
              kind: "user",
              userId: user.userId,
              tenantId: user.tenantId,
            }}
          />
        ) : (
          <div className="rounded-md border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-foreground">
            Unable to determine your user identity. Refresh the page and try
            again.
          </div>
        )}
      </div>
    </section>
  );
}

export default AccountActivity;
