import assert from "node:assert/strict";
import test from "node:test";
import { AiBuilderCanvasSession } from "../src/ai-builder-canvas-session.ts";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "../src/generation/custom-modules-template.ts";

const definitions = new ComponentRegistryService().getRegistry().components;

test("AiBuilderCanvasSession_CompletesModalAndToastWorkflowsInOneTurn", () => {
  const session = new AiBuilderCanvasSession({
    components: [
      button("uuid-modal-button", "modalButton"),
      button("uuid-toast-button", "toastButton"),
    ],
    workflow: { version: 1, workflows: [] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  }, definitions);

  assert.equal(session.executeTool("addModal", {
    title: "Workflow Modal",
    codeName: "workflowModal",
  }), "workflowModal");
  assert.equal(session.executeTool("createWorkflow", {
    workflowCodeName: "openWorkflowModal",
    triggerComponentCodeName: "modalButton",
    triggerEventKey: "onClick",
  }), "openWorkflowModal");
  assert.equal(session.executeTool("addShowModalAction", {
    workflowCodeName: "openWorkflowModal",
    nodeId: "showModal1",
    modalCodeName: "workflowModal",
  }), "showModal1");
  assert.equal(session.executeTool("createWorkflow", {
    workflowCodeName: "toastTriggered",
    triggerComponentCodeName: "toastButton",
    triggerEventKey: "onClick",
  }), "toastTriggered");
  assert.equal(session.executeTool("addTriggerToastAction", {
    workflowCodeName: "toastTriggered",
    nodeId: "toast1",
    body: "Toast Triggered!",
    toastDuration: "short",
  }), "toast1");

  const proposal = session.buildProposal(1, definitions);
  assert.equal(proposal.components.some((component) => component.codeName === "workflowModal"), true);
  assert.deepEqual(proposal.workflow.workflows.map((workflow) => ({
    codeName: workflow.codeName,
    trigger: workflow.trigger,
    actionType: workflow.nodes[0]?.actionType,
    params: workflow.nodes[0]?.params,
  })), [
    {
      codeName: "openWorkflowModal",
      trigger: { componentKey: "uuid-modal-button", eventKey: "onClick" },
      actionType: "showModal",
      params: { modalComponentKey: "workflowModal" },
    },
    {
      codeName: "toastTriggered",
      trigger: { componentKey: "uuid-toast-button", eventKey: "onClick" },
      actionType: "triggerToast",
      params: { body: "Toast Triggered!", duration: { kind: "preset", value: "short" } },
    },
  ]);
});

test("AiBuilderCanvasSession_ReturnsActionableErrorsWithoutMutatingOnFailure", () => {
  const session = new AiBuilderCanvasSession({
    components: [button("uuid-toast-button", "toastButton")],
    workflow: { version: 1, workflows: [] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  }, definitions);

  assert.match(
    session.executeTool("addShowModalAction", {
      workflowCodeName: "missing",
      nodeId: "show1",
      modalCodeName: "workflowModal",
    }),
    /^ERROR: Workflow 'missing' not found/,
  );
  assert.equal(session.hasChanges(), false);
});

test("AiBuilderCanvasSession_RejectsFileUploadInsideFormWithoutMutating", () => {
  const session = new AiBuilderCanvasSession({
    components: [],
    workflow: { version: 1, workflows: [] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  }, definitions);

  assert.equal(session.executeTool("addForm", {
    codeName: "inspectionForm",
    submitButtonText: "Submit",
  }), "inspectionForm");
  assert.match(
    session.executeTool("addFileUpload", {
      codeName: "defectPhotos",
      label: "Defect photos",
      parentId: "inspectionForm",
    }),
    /ERROR: FileUpload cannot be nested inside Form/,
  );
  const proposal = session.buildProposal(1, definitions);
  assert.equal(proposal.components.some((component) => component.type === "FileUpload"), false);
  assert.deepEqual(
    proposal.components.find((component) => component.codeName === "inspectionForm")?.children,
    [],
  );
});

test("AiBuilderCanvasSession_BuildsShipmentInspectionAppWithValidBindings", () => {
  const session = new AiBuilderCanvasSession({
    components: [],
    workflow: { version: 1, workflows: [] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  }, definitions);

  assert.equal(session.executeTool("addForm", {
    codeName: "inspectionForm",
    submitButtonText: "Submit inspection",
  }), "inspectionForm");
  for (const field of [
    { tool: "addTextInput", codeName: "shipmentId", label: "Shipment ID" },
    { tool: "addTextInput", codeName: "supplierName", label: "Supplier name" },
    { tool: "addDatePicker", codeName: "inspectionDate", label: "Inspection date" },
    {
      tool: "addDropdown",
      codeName: "defectCategory",
      label: "Defect category",
      options: "None,Packaging,Damage,Quality,Other",
    },
    { tool: "addTextInput", codeName: "inspectionNotes", label: "Inspection notes" },
  ] as const) {
    assert.equal(session.executeTool(field.tool, {
      ...field,
      parentId: "inspectionForm",
    }), field.codeName);
  }
  assert.equal(session.executeTool("addFileUpload", {
    codeName: "defectPhotos",
    label: "Defect photos",
  }), "defectPhotos");
  assert.equal(session.executeTool("setStaticVolumeBinding", {
    componentCodeName: "defectPhotos",
    catalog: "dbdemos",
    schema: "vdab",
    volume: "inspection_data",
  }), "defectPhotos");
  assert.equal(session.executeTool("addButton", {
    codeName: "viewRecentButton",
    label: "View recent inspections",
  }), "viewRecentButton");
  assert.equal(session.executeTool("addModal", {
    codeName: "recentInspectionsModal",
    title: "Recent inspections",
  }), "recentInspectionsModal");
  assert.equal(session.executeTool("addDataWindow", {
    codeName: "recentInspectionsTable",
    label: "Recent inspections",
    parentId: "recentInspectionsModal",
    maxRows: 20,
  }), "recentInspectionsTable");
  assert.equal(session.executeTool("setStaticUnityCatalogBinding", {
    componentCodeName: "recentInspectionsTable",
    catalog: "dbdemos",
    schema: "vdab",
    table: "shipment_inspection",
  }), "recentInspectionsTable");
  assert.equal(session.executeTool("createWorkflow", {
    workflowCodeName: "submitInspectionForm",
    triggerComponentCodeName: "inspectionForm",
    triggerEventKey: "onSubmit",
  }), "submitInspectionForm");
  assert.equal(session.executeTool("addSaveToTableAction", {
    workflowCodeName: "submitInspectionForm",
    nodeId: "saveInspection",
    sourceFormComponentCodeName: "inspectionForm",
    catalog: "dbdemos",
    schema: "vdab",
    table: "shipment_inspection",
  }), "saveInspection");
  assert.equal(session.executeTool("createWorkflow", {
    workflowCodeName: "openRecentInspectionsModal",
    triggerComponentCodeName: "viewRecentButton",
    triggerEventKey: "onClick",
  }), "openRecentInspectionsModal");
  assert.equal(session.executeTool("addShowModalAction", {
    workflowCodeName: "openRecentInspectionsModal",
    nodeId: "showRecent",
    modalCodeName: "recentInspectionsModal",
  }), "showRecent");

  const proposal = session.buildProposal(1, definitions);
  const upload = proposal.components.find((component) => component.codeName === "defectPhotos");
  const table = proposal.components.find((component) => component.codeName === "recentInspectionsTable");
  assert.deepEqual(upload?.bindings, {
    databricksVolume: {
      bindingType: "databricksVolume",
      source: {
        kind: "resource",
        valueType: "file",
        resource: {
          type: "databricksVolume",
          catalog: "dbdemos",
          schema: "vdab",
          volume: "inspection_data",
          filePath: "",
        },
      },
    },
  });
  assert.deepEqual(table?.bindings, {
    unityCatalogTable: {
      bindingType: "unityCatalogTable",
      source: {
        kind: "resource",
        valueType: "table",
        resource: {
          type: "unityCatalogTable",
          catalog: "dbdemos",
          schema: "vdab",
          table: "shipment_inspection",
        },
      },
    },
  });
  assert.equal(proposal.workflow.workflows.length, 2);
  assert.equal(
    proposal.components.find((component) => component.codeName === "inspectionForm")?.children.length,
    5,
  );
});

function button(key: string, codeName: string) {
  const definition = definitions.find((item) => item.type === "Button");
  if (!definition) throw new Error("Missing Button definition.");
  return {
    key,
    type: "Button" as const,
    schemaVersion: 1,
    componentVersion: 1,
    codeName,
    description: null,
    properties: { ...definition.props },
    bindings: null,
    children: [],
    layout: null,
  };
}
