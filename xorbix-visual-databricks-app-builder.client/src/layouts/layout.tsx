import { Outlet, useMatches } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";

const Layout = () => {
  const matches = useMatches();
  const isAuthDialog = matches.some((m) => m.id === "dialog-layout");

  const containerClasses = isAuthDialog
    ? "min-h-screen bg-transparent text-foreground flex flex-col"
    : "min-h-screen bg-background text-foreground flex flex-col";
  const mainClasses = "flex-1 flex flex-col";

  if (isAuthDialog) {
    return (
      <div className={containerClasses} data-public-auth-layout="">
        <main className={mainClasses}>
          <Outlet />
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <PublicHeader />
      <main className={mainClasses}>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
};

export default Layout;
