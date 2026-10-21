import AppManagement from "./AppManagement";
import ProjectManagementPage from "./ProjectManagementPage";

/** Selects the install-local project experience only in the Databricks build. */
function ProjectManagementRoute() {
  return import.meta.env.VITE_VDAB_RUNTIME === "databricks" ? (
    <ProjectManagementPage />
  ) : (
    <AppManagement />
  );
}

export default ProjectManagementRoute;
