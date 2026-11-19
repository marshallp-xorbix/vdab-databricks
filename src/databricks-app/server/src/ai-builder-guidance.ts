import type { ComponentDefinition } from "./component-registry/contracts.ts";
import {
  PROJECT_WORKFLOW_ACTION_TYPES,
  PROJECT_WORKFLOW_ROUTES,
  type ProjectWorkflowActionType,
} from "./db/project-workflow-contract.ts";
import { PREBUILT_MODULES_LIBRARY_SOURCE } from "./generation/prebuilt-modules-library.ts";

const AI_STORY_COMPONENT_TYPES = [
  "AmoebaStory",
  "FlowFieldStory",
  "HeatMapStory",
  "HoneycombStory",
  "NetworkWebStory",
  "PulseWaveStory",
  "SpiralStory",
  "TerrainStory",
] as const;

const AI_WORKFLOW_ACTION_GUIDANCE: Record<ProjectWorkflowActionType, string> = {
  triggerToast: 'use addTriggerToastAction; duration short|long|infinite.',
  showModal: 'use addShowModalAction with an existing Modal codeName.',
  saveToTable: 'use addSaveToTableAction / Lakebase variants with Form codeName and table identity fields already present in context.',
  buildSql: 'use addBuildSqlAction with sqlTemplate and optional placeholdersJson.',
  runSql: 'use addRunSqlAction referencing a prior buildSql node id.',
  setBinding: 'use addSetBindingAction targeting a table/chart codeName from runSql rows.',
  startDatabricksJob: 'use addStartDatabricksJobAction with a listed job id/name.',
  callCustomModule: 'use addCallCustomModuleAction with a top-level custom function name.',
  callPrebuiltModule: 'use addCallPrebuiltModuleAction with exact namedArgumentsJson.',
};

/** Builds exact workflow, event, story, and prebuilt-module guidance from active contracts. */
export function buildAiBuilderContractGuidance(
  componentDefinitions: ComponentDefinition[],
): string {
  const eventMap = componentDefinitions
    .filter((definition) => definition.supportedEvents && definition.supportedEvents.length > 0)
    .map((definition) => `${definition.type}: ${definition.supportedEvents?.join(", ")}`)
    .join("; ");
  const actionGuidance = PROJECT_WORKFLOW_ACTION_TYPES
    .map((actionType) => `- ${actionType}: ${AI_WORKFLOW_ACTION_GUIDANCE[actionType]}`)
    .join("\n");
  const prebuiltSignatures = PREBUILT_MODULES_LIBRARY_SOURCE
    .split("\n")
    .filter((line) => /^def [A-Za-z_][A-Za-z0-9_]*\(/.test(line))
    .join("\n");
  const stories = AI_STORY_COMPONENT_TYPES.filter((type) =>
    componentDefinitions.some((definition) => definition.type === type))
    .join(", ");

  return [
    "Workflow contract:",
    `- Action types: ${PROJECT_WORKFLOW_ACTION_TYPES.join(", ")}.`,
    actionGuidance,
    `- Workflow routes are exactly: ${PROJECT_WORKFLOW_ROUTES.join(", ")}.`,
    `- Trigger event map from the active component registry: ${eventMap}.`,
    "- Create workflows with createWorkflow(workflowCodeName, triggerComponentCodeName, triggerEventKey), then add actions. Single-action workflows need no edges.",
    "- Button interactivity example: addModal(codeName=workflowModal) → createWorkflow(openWorkflowModal, modalButton, onClick) → addShowModalAction(..., workflowModal); createWorkflow(toastTriggered, toastButton, onClick) → addTriggerToastAction(..., \"Toast Triggered!\"). Complete every requested step in the same turn.",
    `- Prebuilt module signatures from the active library:\n${prebuiltSignatures || "(none)"}`,
    `Story visualizations: ${stories}. Choose only a story the user requested. Prefer setStaticXxxBinding after adding a story. If required field roles are unclear, ask before inventing column names.`,
    "Resource authority: project sharing does not grant Databricks resource access. Never invent catalog, schema, table, Volume, warehouse, Lakebase, endpoint, Genie space, or Job IDs/names. Reuse only references already present in the supplied project; ask the user to select a new workspace resource in VDAB first.",
  ].join("\n");
}
