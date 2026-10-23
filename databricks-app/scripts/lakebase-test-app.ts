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
          lakebaseDatabaseId: "database-one",
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
            databaseId: "database-one",
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
  const components = lakebaseReadComponentTypes.map((type) =>
    createLakebaseReadComponent(type),
  );
  const document: ProjectComponentsDocument = {
    projectId: project.id,
    version: project.version,
    components,
  };
  const preview = new ProjectPreviewGenerator().generate(project, document);
  return { files: preview.files };
}

/** Returns generated Provisioned readers, workflow actions, and editable tables. */
export function generateLakebaseProvisionedTestApp(): {
  files: Array<{ path: string; content: string }>;
} {
  const components = lakebaseReadComponentTypes.map((type) =>
    createLakebaseReadComponent(type, createLakebaseProvisionedFixtureBinding()),
  );
  components.push(createProvisionedEditableDataWindow());
  components.push(createProvisionedForm(), createProvisionedFormInput());
  const document: ProjectComponentsDocument = {
    projectId: project.id,
    version: project.version,
    components,
  };
  const preview = new ProjectPreviewGenerator().generate(
    project,
    document,
    provisionedWorkflow,
  );
  return { files: preview.files };
}

function createLakebaseReadComponent(
  type: ProjectComponent["type"],
  bindings: ProjectComponent["bindings"] = createLakebaseFixtureBinding(),
): ProjectComponent {
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
    bindings,
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
          databaseId: "database-one",
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

function createLakebaseProvisionedFixtureBinding(): NonNullable<ProjectComponent["bindings"]> {
  return {
    lakebaseProvisionedDatabase: {
      bindingType: "lakebaseProvisionedDatabase",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "lakebaseProvisionedDatabase",
          instanceName: "legacy-provisioned",
          database: "appdb",
          schema: "public",
          table: "lakebase_fixture",
          primaryKeyColumn: null,
          columns: lakebaseFixtureColumns,
        },
      },
    },
  };
}

function createProvisionedEditableDataWindow(): ProjectComponent {
  return {
    key: "provisioned-editable-data-window",
    type: "EditableDataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "provisionedEditableDataWindow",
    description: null,
    properties: {
      label: "Editable Provisioned customers",
      maxRows: 50,
      scrollable: true,
      placeholder: "No customers",
      disabled: false,
      numRows: "dynamic",
      hideIndex: true,
      width: "stretch",
      height: "content",
    },
    bindings: {
      lakebaseProvisionedDatabase: {
        bindingType: "lakebaseProvisionedDatabase",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "lakebaseProvisionedDatabase",
            instanceName: "legacy-provisioned",
            database: "appdb",
            schema: "public",
            table: "customers",
            primaryKeyColumn: "id",
            columns: [
              { name: "id", type: "bigint", dataType: "BIGINT" },
              { name: "display_name", type: "text", dataType: "TEXT" },
            ],
          },
        },
      },
    },
    children: [],
    layout: null,
  };
}

function createProvisionedForm(): ProjectComponent {
  const component = createLakebaseReadComponent("Form");
  return {
    ...component,
    key: "save-form",
    bindings: null,
    children: ["customer-field"],
  };
}

function createProvisionedFormInput(): ProjectComponent {
  const component = createLakebaseReadComponent("TextInput");
  return { ...component, key: "customer-field", bindings: null };
}

const provisionedWorkflow: ProjectWorkflowDefinition = {
  version: 1,
  workflows: [{
    codeName: "provisionedLakebaseSmoke",
    trigger: { componentKey: "save-form", eventKey: "onSubmit" },
    nodes: [
      {
        id: "build",
        actionType: "buildSql",
        schemaVersion: 1,
        params: {
          sqlSourceKind: "lakebaseProvisionedDatabase",
          sqlTemplate: "SELECT fixture_category, fixture_metric FROM public.lakebase_fixture",
          lakebaseDatabaseName: "appdb",
          lakebaseInstanceName: "legacy-provisioned",
          lakebaseAppResourceName: "legacy-resource",
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
            tableType: "lakebaseProvisionedDatabase",
            catalog: "appdb",
            schema: "public",
            table: "customers",
            database: "appdb",
            instanceName: "legacy-provisioned",
            workspaceConnectionId: 0,
          },
          columnMappings: [{
            formChildComponentKey: "customer-field",
            targetColumnName: "display_name",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
