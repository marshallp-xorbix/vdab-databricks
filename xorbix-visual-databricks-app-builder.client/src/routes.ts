import databricksRoutes from "./route-config/databricksRoutes";
import saasRoutes from "./route-config/saasRoutes";

/** Selects the route graph at build time so each product ships only its own routes. */
const routes =
  import.meta.env.VITE_VDAB_RUNTIME === "databricks"
    ? databricksRoutes()
    : saasRoutes();

export default routes;
