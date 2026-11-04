import { Navigate } from "react-router-dom";

/** Sends the installed app's root URL to the primary project list route. */
function StandaloneProjectsHomeRoute() {
  return <Navigate to="/apps" replace />;
}

export default StandaloneProjectsHomeRoute;
