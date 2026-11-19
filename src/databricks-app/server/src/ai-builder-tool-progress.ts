/** User-visible progress labels for typed AI Builder tools. */
export const AI_BUILDER_TOOL_PROGRESS_LABELS: Record<string, string> = {
  addLabel: "Adding label",
  addTextInput: "Adding text input",
  addButton: "Adding button",
  addCheckbox: "Adding checkbox",
  addToggle: "Adding toggle",
  addDropdown: "Adding dropdown",
  addDatePicker: "Adding date picker",
  addTimePicker: "Adding time picker",
  addSlider: "Adding slider",
  addForm: "Adding form",
  addTabs: "Adding tabs",
  addExpander: "Adding expander",
  addModal: "Adding modal",
  addColumns: "Adding columns layout",
  addRows: "Adding rows layout",
  addDataWindow: "Adding data table",
  addEditableDataWindow: "Adding editable data table",
  addFileUpload: "Adding file upload",
  addBarChart: "Adding bar chart",
  addLineChart: "Adding line chart",
  addPieChart: "Adding pie chart",
  addDonutChart: "Adding donut chart",
  addAmoebaStory: "Adding amoeba story",
  addNetworkWebStory: "Adding network web story",
  addTerrainStory: "Adding terrain story",
  addHeatMapStory: "Adding heat map story",
  addPulseWaveStory: "Adding pulse wave story",
  addFlowFieldStory: "Adding flow field story",
  addHoneycombStory: "Adding honeycomb story",
  addSpiralStory: "Adding spiral story",
  addDashboardEmbed: "Embedding dashboard",
  addGenieChat: "Adding Genie Chat",
  addModelChat: "Adding Model Chat",
  modifyComponent: "Updating component",
  deleteComponent: "Removing component",
  createWorkflow: "Creating workflow",
  addTriggerToastAction: "Adding toast action",
  addShowModalAction: "Adding show-modal action",
  addBuildSqlAction: "Adding SQL query action",
  addRunSqlAction: "Adding run SQL action",
  addSetBindingAction: "Adding set binding action",
  connectWorkflowNodes: "Connecting workflow nodes",
  deleteWorkflow: "Removing workflow",
  addSaveToTableAction: "Adding save-to-table action",
  addSaveToLakebaseProvisionedAction: "Adding Lakebase save-to-table action",
  addSaveToLakebaseAutoscalingAction: "Adding Lakebase autoscaling save-to-table action",
  addStartDatabricksJobAction: "Adding start-job action",
  addCallCustomModuleAction: "Adding custom module action",
  addCallPrebuiltModuleAction: "Adding prebuilt module action",
  updateCustomModulesCode: "Updating custom modules",
  setStaticVolumeBinding: "Binding Databricks Volume",
  setStaticUnityCatalogBinding: "Binding table data",
  setStaticLakebaseProvisionedBinding: "Binding Lakebase data",
  setStaticLakebaseAutoscalingBinding: "Binding Lakebase autoscaling data",
};

/** Builds a short progress line for one tool invocation. */
export function buildAiBuilderToolProgressMessage(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const base = AI_BUILDER_TOOL_PROGRESS_LABELS[toolName] ?? toolName;
  const codeName = typeof args.codeName === "string" && args.codeName.trim()
    ? args.codeName.trim()
    : typeof args.workflowCodeName === "string" && args.workflowCodeName.trim()
    ? args.workflowCodeName.trim()
    : typeof args.label === "string" && args.label.trim()
    ? args.label.trim()
    : null;
  return codeName ? `${base} "${codeName}"…` : `${base}…`;
}
