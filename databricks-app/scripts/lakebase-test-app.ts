import type { ProjectSummary } from "../server/src/contracts.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
  ProjectJsonObject,
} from "../server/src/db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../server/src/db/project-workflow-contract.ts";
import { COMPONENT_DEFINITIONS } from "../server/src/component-registry/component-definitions.ts";
import { ProjectPreviewGenerator } from "../server/src/generation/project-preview-generator.ts";

const project: ProjectSummary = {
  id: "lakebase-runtime-test",
  name: "Lakebase runtime test",
  description: null,
  version: 1,
  createdBy: "local-test",
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
  callerRole: "owner",
};

const document: ProjectComponentsDocument = {
  projectId: project.id,
  version: project.version,
  components: [],
};

const workflow: ProjectWorkflowDefinition = {
  version: 1,
  workflows: [{
    codeName: "lakebaseSmoke",
    trigger: { componentKey: "save-form", eventKey: "onSubmit" },
    nodes: [
      {
        id: "build",
        actionType: "buildSql",
        schemaVersion: 1,
        params: {
          sqlSourceKind: "lakebaseAutoscaling",
          sqlTemplate: "SELECT customer_name, score FROM public.orders",
          lakebaseDatabaseName: "builder",
          lakebaseProjectId: "workspace-project",
          lakebaseBranchId: "production",
          lakebaseEndpointId: "read-write",
        },
      },
      {
        id: "run",
        actionType: "runSql",
        schemaVersion: 1,
        params: { statement: { sourceActionType: "buildSql", nodeId: "build" } },
      },
      {
        id: "save",
        actionType: "saveToTable",
        schemaVersion: 1,
        params: {
          sourceFormComponentKey: "save-form",
          targetTable: {
            tableType: "lakebaseAutoscaling",
            catalog: null,
            schema: "public",
            table: "orders",
            database: "builder",
            projectId: "workspace-project",
            branchId: "production",
            endpointId: "read-write",
          },
          columnMappings: [{
            formChildComponentKey: "customer-field",
            targetColumnName: "customer name",
          }],
        },
      },
    ],
    edges: [
      { fromNodeId: "build", toNodeId: "run", route: "onSuccess" },
      { fromNodeId: "run", toNodeId: "save", route: "onSuccess" },
    ],
  }],
};

const lakebaseReadComponentTypes: ReadonlyArray<ProjectComponent["type"]> = [
  "DataWindow",
  "BarChart",
  "LineChart",
  "PieChart",
  "DonutChart",
  "AmoebaStory",
  "FlowFieldStory",
  "HeatMapStory",
  "HoneycombStory",
  "NetworkWebStory",
  "PulseWaveStory",
  "SpiralStory",
  "TerrainStory",
];

const lakebaseFixtureColumns = [
  { name: "fixture_category", type: "STRING" },
  { name: "fixture_metric", type: "DOUBLE" },
  { name: "fixture_time", type: "TIMESTAMP" },
];

/** Returns a generated project used by offline and local PostgreSQL smoke tests. */
export function generateLakebaseTestApp(): {
  files: Array<{ path: string; content: string }>;
} {
  const preview = new ProjectPreviewGenerator().generate(project, document, workflow);
  return { files: preview.files };
}

/** Returns an assembled generated app that queries every Lakebase visual reader. */
export function generateLakebaseComponentTestApp(): {
  files: Array<{ path: string; content: string }>;
} {
  const components = lakebaseReadComponentTypes.map(createLakebaseReadComponent);
  const document: ProjectComponentsDocument = {
    projectId: project.id,
    version: project.version,
    components,
  };
  const preview = new ProjectPreviewGenerator().generate(project, document);
  return { files: preview.files };
}

function createLakebaseReadComponent(type: ProjectComponent["type"]): ProjectComponent {
  const definition = COMPONENT_DEFINITIONS.find((candidate) => candidate.type === type);
  if (definition === undefined) {
    throw new Error(`The component registry is missing ${type}.`);
  }
  const key = `lakebase-${type.toLowerCase()}`;
  return {
    key,
    type,
    schemaVersion: 1,
    componentVersion: 1,
    codeName: key.replaceAll("-", ""),
    description: null,
    properties: fillLakebaseFixtureAxes(structuredClone(definition.props)),
    bindings: createLakebaseFixtureBinding(),
    children: [],
    layout: null,
  };
}

function fillLakebaseFixtureAxes(
  properties: ProjectJsonObject,
  propertyName = "",
): ProjectJsonObject {
  const result: ProjectJsonObject = {};
  for (const [name, value] of Object.entries(properties)) {
    if (isRecord(value) && "field" in value && "scaleType" in value) {
      const field = value.scaleType === "continuous"
        ? "fixture_metric"
        : /time|date|timeline|period/i.test(name)
          ? "fixture_time"
          : "fixture_category";
      result[name] = { ...value, field, displayName: `${propertyName}${name}` };
    } else if (isRecord(value)) {
      result[name] = fillLakebaseFixtureAxes(value, `${propertyName}${name}.`);
    } else {
      result[name] = value;
    }
  }
  return result;
}

function createLakebaseFixtureBinding(): NonNullable<ProjectComponent["bindings"]> {
  return {
    lakebaseAutoscaling: {
      bindingType: "lakebaseAutoscaling",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "lakebaseAutoscaling",
          database: "builder",
          projectId: "workspace-project",
          branchId: "production",
          endpointId: "read-write",
          catalog: null,
          schema: "public",
          table: "lakebase_fixture",
          dataSourceFormat: null,
          primaryKeyColumn: null,
          columns: lakebaseFixtureColumns,
        },
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
