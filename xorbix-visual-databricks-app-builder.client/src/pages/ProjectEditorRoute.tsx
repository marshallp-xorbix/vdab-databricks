import AppBuilder from "./AppBuilder";
import ProjectEditorPage from "./ProjectEditorPage";

/** Selects project metadata for Databricks builds and the legacy builder otherwise. */
function ProjectEditorRoute() {
  return import.meta.env.VITE_VDAB_RUNTIME === "databricks" ? (
    <ProjectEditorPage />
  ) : (
    <AppBuilder />
  );
}

export default ProjectEditorRoute;
