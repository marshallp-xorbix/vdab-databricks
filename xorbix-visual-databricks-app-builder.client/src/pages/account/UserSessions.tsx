import { UserSessionsTab } from "../../components/UserSessionsTab";
import {
  ACCOUNT_PAGE_CONTAINER_CLASS,
  ACCOUNT_PAGE_SECTION_CLASS,
  ACCOUNT_PAGE_SUBTITLE_CLASS,
  ACCOUNT_PAGE_TITLE_CLASS,
} from "./accountPageStyles.ts";

function UserSessions() {
  return (
    <section className={ACCOUNT_PAGE_SECTION_CLASS}>
      <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
        <header>
          <h1 className={ACCOUNT_PAGE_TITLE_CLASS}>My Sessions</h1>
          <p className={ACCOUNT_PAGE_SUBTITLE_CLASS}>
            View your active sessions and manage device access.
          </p>
        </header>

        <UserSessionsTab isSelfService={true} />
      </div>
    </section>
  );
}

export default UserSessions;
