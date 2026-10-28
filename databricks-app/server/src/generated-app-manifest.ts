import type {
  ProjectDeploymentSourceFile,
  WorkspaceAppResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import { lakebaseResourceEnvironmentVariable } from "./lakebase-app-resource-binding.ts";
import { DEFAULT_SQL_WAREHOUSE_ENVIRONMENT_VARIABLE } from "./sql-warehouse-app-resource-binding.ts";
import { workspaceSecretEnvironmentVariable } from "./workspace-app-secret-resource-binding.ts";

const STREAMLIT_COMMAND = "command: ['streamlit', 'run', 'app.py']";

/** App manifest shown in Code before deployment resource bindings are resolved. */
export const PREVIEW_APP_MANIFEST_CONTENT = `${STREAMLIT_COMMAND}\n`;

/** Adds the generated Streamlit command and Databricks-managed resource references. */
export function addGeneratedAppManifest(
  files: ProjectDeploymentSourceFile[],
  resources: WorkspaceAppResource[],
): ProjectDeploymentSourceFile[] {
  const manifestIndex = files.findIndex((file) => file.path === "app.yaml");
  if (
    manifestIndex >= 0 &&
    files[manifestIndex]?.content !== PREVIEW_APP_MANIFEST_CONTENT
  ) {
    throw new ApplicationError(
      422,
      "generated_manifest_conflict",
      "Generated app manifest is invalid",
      "The generated project already contains an app.yaml file that VDAB cannot safely replace.",
    );
  }

  const lines = [STREAMLIT_COMMAND];
  if (resources.length > 0) {
    lines.push("env:");
    for (const resource of [...resources].sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      lines.push(
        `  - name: ${appResourceEnvironmentVariable(resource)}`,
        `    valueFrom: ${resource.name}`,
      );
    }
  }
  const manifest = { path: "app.yaml", content: `${lines.join("\n")}\n` };
  if (manifestIndex < 0) return [manifest, ...files];
  return files.map((file, index) => (index === manifestIndex ? manifest : file));
}

function appResourceEnvironmentVariable(
  resource: WorkspaceAppResource,
): string {
  if ("sql_warehouse" in resource)
    return DEFAULT_SQL_WAREHOUSE_ENVIRONMENT_VARIABLE;
  if ("secret" in resource) return workspaceSecretEnvironmentVariable(resource);
  return lakebaseResourceEnvironmentVariable(resource);
}
