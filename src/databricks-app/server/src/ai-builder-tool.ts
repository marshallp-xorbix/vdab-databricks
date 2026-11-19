/** OpenAI-compatible typed tools mirroring the SaaS CanvasToolPlugin surface. */

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties: false;
    };
  };
} {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

const stringProp = (description: string): { type: "string"; description: string } => ({
  type: "string",
  description,
});
const booleanProp = (description: string): { type: "boolean"; description: string } => ({
  type: "boolean",
  description,
});
const numberProp = (description: string): { type: "number"; description: string } => ({
  type: "number",
  description,
});

const parentProps = {
  parentId: stringProp("Optional parent component key or codeName for nesting."),
  tabIndex: numberProp("Optional tab index when nesting under Tabs."),
};

/** Typed AI Builder tools exposed to customer chat endpoints. */
export const AI_BUILDER_TOOLS = [
  tool("addLabel", "Add a Label component.", {
    text: stringProp("Display text"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    fontSize: stringProp("small, medium, or large"),
    bold: booleanProp("Whether the text is bold"),
  }),
  tool("addTextInput", "Add a TextInput component.", {
    label: stringProp("Label"),
    placeholder: stringProp("Placeholder"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
  }),
  tool("addButton", "Add a Button component.", {
    label: stringProp("Button label"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    variant: stringProp("primary or secondary"),
  }),
  tool("addCheckbox", "Add a Checkbox component.", {
    label: stringProp("Label"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    defaultChecked: booleanProp("Default checked state"),
  }),
  tool("addToggle", "Add a Toggle component.", {
    label: stringProp("Label"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    defaultValue: booleanProp("Default on/off value"),
  }),
  tool("addDropdown", "Add a Dropdown component.", {
    label: stringProp("Label"),
    options: stringProp("Comma-separated option values"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    placeholder: stringProp("Placeholder"),
    multiselect: booleanProp("Allow multiple selections"),
  }),
  tool("addDatePicker", "Add a DatePicker component.", {
    label: stringProp("Label"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
  }),
  tool("addTimePicker", "Add a TimePicker component.", {
    label: stringProp("Label"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
  }),
  tool("addSlider", "Add a Slider component.", {
    label: stringProp("Label"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    minValue: numberProp("Minimum"),
    maxValue: numberProp("Maximum"),
    defaultValue: numberProp("Default"),
    step: numberProp("Step"),
  }),
  tool("addForm", "Add a Form container.", {
    submitButtonText: stringProp("Submit button text"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
  }),
  tool("addModal", "Add a Modal dialog. Keep Modals as root-level components.", {
    title: stringProp("Modal title"),
    codeName: stringProp("Unique camelCase codeName"),
  }),
  tool("addColumns", "Add a Columns layout container.", {
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    columnCount: numberProp("Exact number of planned children"),
  }),
  tool("addRows", "Add a Rows layout container.", {
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    rowCount: numberProp("Exact number of planned children"),
  }),
  tool("addTabs", "Add a Tabs layout container.", {
    tabNames: stringProp("Comma-separated tab names"),
    codeName: stringProp("Unique camelCase codeName"),
    parentId: stringProp("Optional parent key or codeName"),
  }),
  tool("addExpander", "Add an Expander container.", {
    sectionTitle: stringProp("Section title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    defaultExpanded: booleanProp("Expanded by default"),
  }),
  tool("addDataWindow", "Add a DataWindow table.", {
    label: stringProp("Label"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    maxRows: numberProp("Max rows"),
    scrollable: booleanProp("Scrollable"),
    placeholder: stringProp("Placeholder"),
  }),
  tool("addEditableDataWindow", "Add an EditableDataWindow table.", {
    label: stringProp("Label"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    maxRows: numberProp("Max rows"),
    scrollable: booleanProp("Scrollable"),
    disabled: booleanProp("Disabled"),
  }),
  tool("addFileUpload", "Add a FileUpload component.", {
    label: stringProp("Label"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
  }),
  tool("addBarChart", "Add a BarChart.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    seriesColor: stringProp("Series color"),
  }),
  tool("addLineChart", "Add a LineChart.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    seriesColor: stringProp("Series color"),
  }),
  tool("addPieChart", "Add a PieChart.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    seriesColor: stringProp("Series color"),
  }),
  tool("addDonutChart", "Add a DonutChart.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    seriesColor: stringProp("Series color"),
  }),
  tool("addAmoebaStory", "Add an AmoebaStory visualization.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    fieldMappingsJson: stringProp("Optional JSON role→column map"),
  }),
  tool("addNetworkWebStory", "Add a NetworkWebStory visualization.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    fieldMappingsJson: stringProp("Optional JSON role→column map"),
  }),
  tool("addTerrainStory", "Add a TerrainStory visualization.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    fieldMappingsJson: stringProp("Optional JSON role→column map"),
  }),
  tool("addHeatMapStory", "Add a HeatMapStory visualization.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    fieldMappingsJson: stringProp("Optional JSON role→column map"),
  }),
  tool("addPulseWaveStory", "Add a PulseWaveStory visualization.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    fieldMappingsJson: stringProp("Optional JSON role→column map"),
  }),
  tool("addFlowFieldStory", "Add a FlowFieldStory visualization.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    fieldMappingsJson: stringProp("Optional JSON role→column map"),
  }),
  tool("addHoneycombStory", "Add a HoneycombStory visualization.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    fieldMappingsJson: stringProp("Optional JSON role→column map"),
  }),
  tool("addSpiralStory", "Add a SpiralStory visualization.", {
    title: stringProp("Title"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    fieldMappingsJson: stringProp("Optional JSON role→column map"),
  }),
  tool("addDashboardEmbed", "Add a DashboardEmbed component.", {
    src: stringProp("Dashboard embed URL or path"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    height: numberProp("Height in pixels"),
  }),
  tool("addGenieChat", "Add a GenieChat component.", {
    genieSpaceAppResourceName: stringProp("Genie space app resource name"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    title: stringProp("Title"),
    chatTotalHeightPixels: numberProp("Height"),
    showBorder: booleanProp("Show border"),
  }),
  tool("addModelChat", "Add a ModelChat component.", {
    servingEndpointAppResourceName: stringProp("Serving endpoint app resource name"),
    codeName: stringProp("Unique camelCase codeName"),
    ...parentProps,
    title: stringProp("Title"),
    chatTotalHeightPixels: numberProp("Height"),
    showBorder: booleanProp("Show border"),
  }),
  tool("modifyComponent", "Modify an existing component's properties.", {
    componentId: stringProp("Component key"),
    codeName: stringProp("Existing codeName if key unknown"),
    newCodeName: stringProp("Optional replacement codeName"),
    propsJson: stringProp("JSON object of properties to merge"),
  }),
  tool("deleteComponent", "Delete a component by key or codeName.", {
    componentId: stringProp("Component key"),
    codeName: stringProp("Existing codeName if key unknown"),
  }),
  tool("createWorkflow", "Create a workflow for one component event. Call before adding actions.", {
    workflowCodeName: stringProp("Unique camelCase workflow name"),
    triggerComponentCodeName: stringProp("Trigger component codeName"),
    triggerEventKey: stringProp("onClick, onChange, or onSubmit"),
  }, ["workflowCodeName", "triggerComponentCodeName", "triggerEventKey"]),
  tool("addTriggerToastAction", "Add a toast action to a workflow.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    body: stringProp("Toast body text"),
    toastDuration: stringProp("short, long, or infinite"),
  }, ["workflowCodeName", "nodeId", "body"]),
  tool("addShowModalAction", "Add a showModal action. The Modal must already exist.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    modalCodeName: stringProp("Modal component codeName"),
  }, ["workflowCodeName", "nodeId", "modalCodeName"]),
  tool("addBuildSqlAction", "Add a buildSql action.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    sqlTemplate: stringProp("SQL template"),
    sqlSourceKind: stringProp("unityCatalogTable, lakebaseProvisionedDatabase, or lakebaseAutoscaling"),
    placeholdersJson: stringProp("JSON array of placeholders"),
  }, ["workflowCodeName", "nodeId", "sqlTemplate"]),
  tool("addRunSqlAction", "Add a runSql action referencing a prior buildSql node.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    buildSqlNodeId: stringProp("Prior buildSql node id"),
  }, ["workflowCodeName", "nodeId", "buildSqlNodeId"]),
  tool("addSetBindingAction", "Add a setBinding action from runSql rows.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    runSqlNodeId: stringProp("Prior runSql node id"),
    targetComponentCodeName: stringProp("Target component codeName"),
    bindingType: stringProp("unityCatalogTable or chartData"),
  }, ["workflowCodeName", "nodeId", "runSqlNodeId", "targetComponentCodeName"]),
  tool("addSaveToTableAction", "Save a Form to a Unity Catalog table.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    sourceFormComponentCodeName: stringProp("Form codeName"),
    catalog: stringProp("Catalog"),
    schema: stringProp("Schema"),
    table: stringProp("Table"),
  }, ["workflowCodeName", "nodeId", "sourceFormComponentCodeName", "catalog", "schema", "table"]),
  tool("addSaveToLakebaseProvisionedAction", "Save a Form to Lakebase Provisioned.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    sourceFormComponentCodeName: stringProp("Form codeName"),
    instanceName: stringProp("Instance name"),
    database: stringProp("Database"),
    catalog: stringProp("Catalog"),
    schema: stringProp("Schema"),
    table: stringProp("Table"),
  }, ["workflowCodeName", "nodeId", "sourceFormComponentCodeName", "instanceName", "database", "catalog", "schema", "table"]),
  tool("addSaveToLakebaseAutoscalingAction", "Save a Form to Lakebase Autoscaling.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    sourceFormComponentCodeName: stringProp("Form codeName"),
    projectId: stringProp("Project id"),
    branchId: stringProp("Branch id"),
    endpointId: stringProp("Endpoint id"),
    database: stringProp("Database"),
    catalog: stringProp("Catalog"),
    schema: stringProp("Schema"),
    table: stringProp("Table"),
  }, ["workflowCodeName", "nodeId", "sourceFormComponentCodeName", "projectId", "branchId", "endpointId", "database", "catalog", "schema", "table"]),
  tool("addStartDatabricksJobAction", "Start a Databricks Job.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    jobId: stringProp("Job id"),
    jobName: stringProp("Job display name"),
  }, ["workflowCodeName", "nodeId", "jobId", "jobName"]),
  tool("addCallCustomModuleAction", "Call a custom_modules.py function.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    functionName: stringProp("Function name"),
  }, ["workflowCodeName", "nodeId", "functionName"]),
  tool("addCallPrebuiltModuleAction", "Call a prebuilt module function.", {
    workflowCodeName: stringProp("Workflow codeName"),
    nodeId: stringProp("Unique action id"),
    functionName: stringProp("Function name"),
    namedArgumentsJson: stringProp("JSON object of string arguments"),
  }, ["workflowCodeName", "nodeId", "functionName"]),
  tool("connectWorkflowNodes", "Connect two workflow actions.", {
    workflowCodeName: stringProp("Workflow codeName"),
    fromNodeId: stringProp("Source node id"),
    toNodeId: stringProp("Target node id"),
    route: stringProp("onSuccess, onError, or always"),
  }, ["workflowCodeName", "fromNodeId", "toNodeId"]),
  tool("deleteWorkflow", "Delete a workflow by codeName.", {
    workflowCodeName: stringProp("Workflow codeName"),
  }, ["workflowCodeName"]),
  tool("updateCustomModulesCode", "Replace custom_modules.py source.", {
    pythonSource: stringProp("Full Python source"),
  }, ["pythonSource"]),
  tool("setStaticVolumeBinding", "Bind FileUpload to a Databricks Volume.", {
    componentCodeName: stringProp("FileUpload codeName"),
    catalog: stringProp("Catalog"),
    schema: stringProp("Schema"),
    volume: stringProp("Volume"),
    filePath: stringProp("Optional subfolder"),
  }, ["componentCodeName", "catalog", "schema", "volume"]),
  tool("setStaticUnityCatalogBinding", "Bind a table/chart/story to Unity Catalog.", {
    componentCodeName: stringProp("Component codeName"),
    catalog: stringProp("Catalog"),
    schema: stringProp("Schema"),
    table: stringProp("Table"),
  }, ["componentCodeName", "catalog", "schema", "table"]),
  tool("setStaticLakebaseProvisionedBinding", "Bind a table/chart/story to Lakebase Provisioned.", {
    componentCodeName: stringProp("Component codeName"),
    instanceName: stringProp("Instance name"),
    database: stringProp("Database"),
    catalog: stringProp("Catalog"),
    schema: stringProp("Schema"),
    table: stringProp("Table"),
  }, ["componentCodeName", "instanceName", "database", "catalog", "schema", "table"]),
  tool("setStaticLakebaseAutoscalingBinding", "Bind a table/chart/story to Lakebase Autoscaling.", {
    componentCodeName: stringProp("Component codeName"),
    projectId: stringProp("Project id"),
    branchId: stringProp("Branch id"),
    endpointId: stringProp("Endpoint id"),
    database: stringProp("Database"),
    catalog: stringProp("Catalog"),
    schema: stringProp("Schema"),
    table: stringProp("Table"),
  }, ["componentCodeName", "projectId", "branchId", "endpointId", "database", "catalog", "schema", "table"]),
] as const;

/** Set of supported typed tool names. */
export const AI_BUILDER_TOOL_NAMES = new Set(AI_BUILDER_TOOLS.map((item) => item.function.name));
