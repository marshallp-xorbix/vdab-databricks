import type { ProjectComponent } from "../db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../db/project-workflow-contract.ts";
import { ASYNC_PG_REQUIREMENTS_CONTENT } from "./asyncpg-package-notice.ts";
import { projectUsesLakebase } from "./preview-lakebase-helpers.ts";

const BASELINE_REQUIREMENTS = [
  "streamlit>=1.56.0",
  "pandas>=2.3.3",
  "numpy>=2.4.3",
] as const;

const CHART_TYPES = new Set([
  "BarChart",
  "LineChart",
  "PieChart",
  "DonutChart",
]);

/** Builds the generated child App requirements.txt like SaaS, with Marketplace Lakebase asyncpg. */
export function generateRequirementsFile(
  components: readonly ProjectComponent[],
  workflow: ProjectWorkflowDefinition,
): string {
  const requirements = new Set<string>(BASELINE_REQUIREMENTS);
  const types = new Set(components.map((component) => component.type));

  if ([...types].some((type) => CHART_TYPES.has(type))) {
    requirements.add("plotly>=6.6.0");
  }

  const needsDatabricksSdk =
    types.has("FileUpload") ||
    types.has("GenieChat") ||
    types.has("ModelChat") ||
    types.has("DataWindow") ||
    types.has("EditableDataWindow") ||
    [...types].some((type) => CHART_TYPES.has(type)) ||
    [...types].some((type) => type.endsWith("Story")) ||
    workflow.workflows.some((definition) =>
      definition.nodes.some(
        (node) =>
          node.actionType === "startDatabricksJob" ||
          node.actionType === "runSql" ||
          node.actionType === "buildSql" ||
          node.actionType === "saveToTable",
      ),
    ) ||
    components.some(
      (component) =>
        component.bindings !== null &&
        Object.keys(component.bindings).length > 0,
    );

  if (needsDatabricksSdk) {
    requirements.add("databricks-sdk>=0.99.0");
  }

  if (
    components.some(
      (component) =>
        component.bindings !== null &&
        Object.hasOwn(component.bindings, "unityCatalogTable"),
    ) ||
    workflow.workflows.some((definition) =>
      definition.nodes.some(
        (node) =>
          (node.actionType === "buildSql" &&
            node.params.sqlSourceKind === "unityCatalogTable") ||
          node.actionType === "runSql" ||
          node.actionType === "saveToTable",
      ),
    )
  ) {
    requirements.add("databricks-sql-connector>=4.2.5");
  }

  if (projectUsesLakebase(components, workflow)) {
    for (const line of ASYNC_PG_REQUIREMENTS_CONTENT.split("\n")) {
      const packageLine = line.trim();
      if (packageLine) requirements.add(packageLine);
    }
  }

  return `${[...requirements].join("\n")}\n`;
}
